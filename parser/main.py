import os
import re
from datetime import datetime, timezone
from typing import Optional
from fastapi import FastAPI, Query, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
from elasticsearch import AsyncElasticsearch, NotFoundError

load_dotenv()

ES_URL = os.getenv("ELASTICSEARCH_URL", "http://elasticsearch:9200")
ES_USER = os.getenv("ELASTICSEARCH_USER", "elastic")
ES_PASSWORD = os.getenv("ELASTICSEARCH_PASSWORD", "change_me")
LOGS_INDEX = "vigilantia-logs"
AUDIT_INDEX = "vigilantia-audit"

app = FastAPI(title="Vigilantia - Parser Service")

es: Optional[AsyncElasticsearch] = None

# Padrões de classificação de severidade (RF10) — configuráveis via ENV futuramente
SEVERITY_PATTERNS = {
    "CRITICAL": ["fatal", "c2 beaconing", "breach", "ransomware", "exploit"],
    "ERROR":    ["error", "failed", "unauthorized", "denied", "exception"],
    "WARNING":  ["warn", "deprecated", "slow", "retry", "timeout"],
}


@app.on_event("startup")
async def startup():
    global es
    es = AsyncElasticsearch(
        ES_URL,
        basic_auth=(ES_USER, ES_PASSWORD),
        verify_certs=False,
    )
    await _ensure_indices()


@app.on_event("shutdown")
async def shutdown():
    if es:
        await es.close()


async def _ensure_indices():
    logs_mapping = {
        "mappings": {
            "properties": {
                "@timestamp": {"type": "date"},
                "source":     {"type": "keyword"},
                "level":      {"type": "keyword"},
                "message":    {"type": "text"},
                "severity":   {"type": "keyword"},
            }
        }
    }
    audit_mapping = {
        "mappings": {
            "properties": {
                "@timestamp": {"type": "date"},
                "user":       {"type": "keyword"},
                "action":     {"type": "keyword"},
                "detail":     {"type": "text"},
            }
        }
    }
    for index, mapping in [(LOGS_INDEX, logs_mapping), (AUDIT_INDEX, audit_mapping)]:
        exists = await es.indices.exists(index=index)
        if not exists:
            await es.indices.create(index=index, body=mapping)


def classify_severity(message: str) -> str:
    """Classifica severidade por palavras-chave (RF10)."""
    msg_lower = message.lower()
    for level, keywords in SEVERITY_PATTERNS.items():
        if any(kw in msg_lower for kw in keywords):
            return level
    return "INFO"


class LogBatch(BaseModel):
    events: list[dict]


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok", "service": "parser"}


# ── Ingestão (RF01 + RF10) ─────────────────────────────────────────────────────

@app.post("/ingest", tags=["Ingestão"])
async def ingest(batch: LogBatch):
    if not batch.events:
        return {"status": "ok", "indexed": 0}

    operations = []
    for event in batch.events:
        severity = classify_severity(event.get("message", ""))
        doc = {
            "@timestamp": event.get("@timestamp", datetime.now(timezone.utc).isoformat()),
            "source":    event.get("source", "unknown"),
            "level":     event.get("level", "info"),
            "message":   event.get("message", ""),
            "severity":  severity,
        }
        operations.append({"index": {"_index": LOGS_INDEX}})
        operations.append(doc)

    await es.bulk(operations=operations, refresh=False)
    return {"status": "ok", "indexed": len(batch.events)}


# ── Busca e filtragem (RF03 + RF09) ───────────────────────────────────────────

@app.get("/search", tags=["Consulta"])
async def search(
    q: str = Query(default="", description="Texto livre ou regex"),
    severity: Optional[str] = Query(default=None, description="CRITICAL|ERROR|WARNING|INFO"),
    source: Optional[str] = Query(default=None, description="Nome da fonte do log"),
    from_date: Optional[str] = Query(default=None, alias="from", description="ISO 8601 início"),
    to_date: Optional[str] = Query(default=None, alias="to", description="ISO 8601 fim"),
    regex: bool = Query(default=False, description="Tratar 'q' como expressão regular"),
    size: int = Query(default=50, ge=1, le=500),
):
    if regex and q:
        try:
            re.compile(q)
        except re.error:
            raise HTTPException(status_code=400, detail="Expressão regular inválida")

    must: list[dict] = []

    if q:
        if regex:
            must.append({"regexp": {"message": {"value": q}}})
        else:
            must.append({"match": {"message": q}})

    if severity:
        must.append({"term": {"severity": severity.upper()}})

    if source:
        must.append({"term": {"source": source}})

    if from_date or to_date:
        range_clause: dict = {}
        if from_date:
            range_clause["gte"] = from_date
        if to_date:
            range_clause["lte"] = to_date
        must.append({"range": {"@timestamp": range_clause}})

    query = {"bool": {"must": must}} if must else {"match_all": {}}

    result = await es.search(
        index=LOGS_INDEX,
        query=query,
        size=size,
        sort=[{"@timestamp": {"order": "desc"}}],
    )
    hits = [{"id": h["_id"], **h["_source"]} for h in result["hits"]["hits"]]
    return {"total": result["hits"]["total"]["value"], "events": hits}


# ── Estatísticas (RF04) ────────────────────────────────────────────────────────

@app.get("/stats", tags=["Estatísticas"])
async def stats():
    result = await es.search(
        index=LOGS_INDEX,
        size=0,
        aggs={
            "severity_distribution": {
                "terms": {"field": "severity", "size": 10}
            },
            "volume_over_time": {
                "date_histogram": {
                    "field": "@timestamp",
                    "calendar_interval": "hour",
                }
            },
            "top_sources": {
                "terms": {"field": "source", "size": 10}
            },
        },
    )
    aggs = result.get("aggregations", {})
    return {
        "total_events": result["hits"]["total"]["value"],
        "severity_distribution": {
            b["key"]: b["doc_count"]
            for b in aggs.get("severity_distribution", {}).get("buckets", [])
        },
        "volume_over_time": [
            {"time": b["key_as_string"], "count": b["doc_count"]}
            for b in aggs.get("volume_over_time", {}).get("buckets", [])
        ],
        "top_sources": {
            b["key"]: b["doc_count"]
            for b in aggs.get("top_sources", {}).get("buckets", [])
        },
    }


# ── Status do sistema (admin) ──────────────────────────────────────────────────

@app.get("/admin/system-status", tags=["Administração"])
async def system_status():
    info = await es.info()
    count_result = await es.count(index=LOGS_INDEX)
    return {
        "message": "Sistema operacional",
        "elasticsearch_version": info["version"]["number"],
        "total_events": count_result["count"],
        "system_health": "Stable",
    }
