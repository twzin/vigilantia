import os
import re
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import FastAPI, Query, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
from elasticsearch import AsyncElasticsearch, NotFoundError

load_dotenv()

ES_URL       = os.getenv("ELASTICSEARCH_URL", "http://elasticsearch:9200")
ES_USER      = os.getenv("ELASTICSEARCH_USER", "elastic")
ES_PASSWORD  = os.getenv("ELASTICSEARCH_PASSWORD", "change_me")
LOGS_INDEX   = "vigilantia-logs"
AUDIT_INDEX  = "vigilantia-audit"
RULES_INDEX  = "vigilantia-alert-rules"
ALERTS_INDEX = "vigilantia-alerts"

app = FastAPI(title="Vigilantia - Parser Service")
es: Optional[AsyncElasticsearch] = None

SEVERITY_PATTERNS = {
    "CRITICAL": ["fatal", "c2 beaconing", "breach", "ransomware", "exploit"],
    "ERROR":    ["error", "failed", "unauthorized", "denied", "exception"],
    "WARNING":  ["warn", "deprecated", "slow", "retry", "timeout"],
}


@app.on_event("startup")
async def startup():
    global es
    es = AsyncElasticsearch(ES_URL, basic_auth=(ES_USER, ES_PASSWORD), verify_certs=False)
    await _ensure_indices()


@app.on_event("shutdown")
async def shutdown():
    if es:
        await es.close()


async def _ensure_indices():
    indices = {
        LOGS_INDEX: {
            "mappings": {"properties": {
                "@timestamp": {"type": "date"},
                "source":     {"type": "keyword"},
                "level":      {"type": "keyword"},
                "message":    {"type": "text"},
                "severity":   {"type": "keyword"},
            }}
        },
        AUDIT_INDEX: {
            "mappings": {"properties": {
                "@timestamp": {"type": "date"},
                "user":       {"type": "keyword"},
                "action":     {"type": "keyword"},
                "detail":     {"type": "text"},
            }}
        },
        RULES_INDEX: {
            "mappings": {"properties": {
                "name":           {"type": "keyword"},
                "severity":       {"type": "keyword"},
                "source":         {"type": "keyword"},
                "threshold":      {"type": "integer"},
                "window_minutes": {"type": "integer"},
                "active":         {"type": "boolean"},
                "created_by":     {"type": "keyword"},
                "created_at":     {"type": "date"},
            }}
        },
        ALERTS_INDEX: {
            "mappings": {"properties": {
                "@timestamp":     {"type": "date"},
                "rule_id":        {"type": "keyword"},
                "rule_name":      {"type": "keyword"},
                "severity":       {"type": "keyword"},
                "source":         {"type": "keyword"},
                "event_count":    {"type": "integer"},
                "threshold":      {"type": "integer"},
                "window_minutes": {"type": "integer"},
                "acknowledged":   {"type": "boolean"},
            }}
        },
    }
    for index, body in indices.items():
        if not await es.indices.exists(index=index):
            await es.indices.create(index=index, body=body)


def classify_severity(message: str) -> str:
    msg_lower = message.lower()
    for level, keywords in SEVERITY_PATTERNS.items():
        if any(kw in msg_lower for kw in keywords):
            return level
    return "INFO"


# ── Health ─────────────────────────────────────────────────────────────────────

@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok", "service": "parser"}


# ── Ingestão (RF01 + RF10) ─────────────────────────────────────────────────────

class LogBatch(BaseModel):
    events: list[dict]


@app.post("/ingest", tags=["Ingestão"])
async def ingest(batch: LogBatch):
    if not batch.events:
        return {"status": "ok", "indexed": 0}

    operations = []
    for event in batch.events:
        severity = classify_severity(event.get("message", ""))
        doc = {
            "@timestamp": event.get("@timestamp", datetime.now(timezone.utc).isoformat()),
            "source":  event.get("source", "unknown"),
            "level":   event.get("level", "info"),
            "message": event.get("message", ""),
            "severity": severity,
        }
        operations.append({"index": {"_index": LOGS_INDEX}})
        operations.append(doc)

    await es.bulk(operations=operations, refresh=True)
    await _evaluate_alert_rules()
    return {"status": "ok", "indexed": len(batch.events)}


# ── Motor de alertas (RF05) ────────────────────────────────────────────────────

async def _evaluate_alert_rules():
    try:
        result = await es.search(index=RULES_INDEX, query={"term": {"active": True}}, size=100)
        rules  = result["hits"]["hits"]
    except Exception:
        return

    for rule_hit in rules:
        rule    = rule_hit["_source"]
        rule_id = rule_hit["_id"]
        window  = timedelta(minutes=rule.get("window_minutes", 10))
        since   = (datetime.now(timezone.utc) - window).isoformat()

        must = [{"range": {"@timestamp": {"gte": since}}}]
        if rule.get("severity"):
            must.append({"term": {"severity": rule["severity"]}})
        if rule.get("source"):
            must.append({"term": {"source": rule["source"]}})

        count_result = await es.count(index=LOGS_INDEX, query={"bool": {"must": must}})
        count = count_result["count"]

        if count < rule.get("threshold", 1):
            continue

        # Anti-spam: não dispara o mesmo alerta duas vezes na mesma janela
        recent = await es.count(index=ALERTS_INDEX, query={"bool": {"must": [
            {"term": {"rule_id": rule_id}},
            {"range": {"@timestamp": {"gte": since}}},
        ]}})
        if recent["count"] > 0:
            continue

        await es.index(index=ALERTS_INDEX, document={
            "@timestamp":     datetime.now(timezone.utc).isoformat(),
            "rule_id":        rule_id,
            "rule_name":      rule.get("name", ""),
            "severity":       rule.get("severity", ""),
            "source":         rule.get("source", ""),
            "event_count":    count,
            "threshold":      rule.get("threshold", 1),
            "window_minutes": rule.get("window_minutes", 10),
            "acknowledged":   False,
        })


# ── Busca e filtragem (RF03 + RF09) ───────────────────────────────────────────

@app.get("/search", tags=["Consulta"])
async def search(
    q:          str            = Query(default=""),
    severity:   Optional[str]  = Query(default=None),
    source:     Optional[str]  = Query(default=None),
    from_date:  Optional[str]  = Query(default=None, alias="from"),
    to_date:    Optional[str]  = Query(default=None, alias="to"),
    regex:      bool           = Query(default=False),
    size:       int            = Query(default=50, ge=1, le=500),
):
    if regex and q:
        try:
            re.compile(q)
        except re.error:
            raise HTTPException(status_code=400, detail="Expressão regular inválida")

    must: list[dict] = []
    if q:
        must.append({"regexp": {"message": {"value": q}}} if regex else {"match": {"message": q}})
    if severity:
        must.append({"term": {"severity": severity.upper()}})
    if source:
        must.append({"term": {"source": source}})
    if from_date or to_date:
        r: dict = {}
        if from_date: r["gte"] = from_date
        if to_date:   r["lte"] = to_date
        must.append({"range": {"@timestamp": r}})

    query  = {"bool": {"must": must}} if must else {"match_all": {}}
    result = await es.search(index=LOGS_INDEX, query=query, size=size, sort=[{"@timestamp": {"order": "desc"}}])
    hits   = [{"id": h["_id"], **h["_source"]} for h in result["hits"]["hits"]]
    return {"total": result["hits"]["total"]["value"], "events": hits}


# ── Estatísticas (RF04) ────────────────────────────────────────────────────────

@app.get("/stats", tags=["Estatísticas"])
async def stats():
    result = await es.search(index=LOGS_INDEX, size=0, aggs={
        "severity_distribution": {"terms": {"field": "severity", "size": 10}},
        "volume_over_time":      {"date_histogram": {"field": "@timestamp", "calendar_interval": "hour"}},
        "top_sources":           {"terms": {"field": "source", "size": 10}},
    })
    aggs = result.get("aggregations", {})
    return {
        "total_events": result["hits"]["total"]["value"],
        "severity_distribution": {b["key"]: b["doc_count"] for b in aggs.get("severity_distribution", {}).get("buckets", [])},
        "volume_over_time":      [{"time": b["key_as_string"], "count": b["doc_count"]} for b in aggs.get("volume_over_time", {}).get("buckets", [])],
        "top_sources":           {b["key"]: b["doc_count"] for b in aggs.get("top_sources", {}).get("buckets", [])},
    }


# ── Regras de alerta (RF05) ────────────────────────────────────────────────────

class AlertRule(BaseModel):
    name:           str
    severity:       Optional[str] = None
    source:         Optional[str] = None
    threshold:      int           = 5
    window_minutes: int           = 10
    active:         bool          = True
    created_by:     str           = "admin"


@app.get("/admin/alert-rules", tags=["Alertas"])
async def list_alert_rules():
    result = await es.search(index=RULES_INDEX, query={"match_all": {}}, size=100,
                              sort=[{"created_at": {"order": "desc"}}])
    return [{"id": h["_id"], **h["_source"]} for h in result["hits"]["hits"]]


@app.post("/admin/alert-rules", status_code=201, tags=["Alertas"])
async def create_alert_rule(rule: AlertRule):
    doc = {**rule.model_dump(), "created_at": datetime.now(timezone.utc).isoformat()}
    result = await es.index(index=RULES_INDEX, document=doc, refresh=True)
    return {"id": result["_id"], **doc}


@app.put("/admin/alert-rules/{rule_id}", tags=["Alertas"])
async def update_alert_rule(rule_id: str, rule: AlertRule):
    try:
        doc = {**rule.model_dump(), "created_at": datetime.now(timezone.utc).isoformat()}
        await es.index(index=RULES_INDEX, id=rule_id, document=doc, refresh=True)
        return {"id": rule_id, **doc}
    except NotFoundError:
        raise HTTPException(status_code=404, detail="Regra não encontrada")


@app.delete("/admin/alert-rules/{rule_id}", status_code=204, tags=["Alertas"])
async def delete_alert_rule(rule_id: str):
    try:
        await es.delete(index=RULES_INDEX, id=rule_id, refresh=True)
    except NotFoundError:
        raise HTTPException(status_code=404, detail="Regra não encontrada")


# ── Histórico de alertas (RF07) ────────────────────────────────────────────────

@app.get("/alerts", tags=["Alertas"])
async def list_alerts(
    acknowledged: Optional[bool] = Query(default=None),
    severity:     Optional[str]  = Query(default=None),
    size:         int             = Query(default=50, ge=1, le=200),
):
    must: list[dict] = []
    if acknowledged is not None:
        must.append({"term": {"acknowledged": acknowledged}})
    if severity:
        must.append({"term": {"severity": severity.upper()}})

    query  = {"bool": {"must": must}} if must else {"match_all": {}}
    result = await es.search(index=ALERTS_INDEX, query=query, size=size,
                              sort=[{"@timestamp": {"order": "desc"}}])
    return {"total": result["hits"]["total"]["value"],
            "alerts": [{"id": h["_id"], **h["_source"]} for h in result["hits"]["hits"]]}


@app.patch("/alerts/{alert_id}/acknowledge", tags=["Alertas"])
async def acknowledge_alert(alert_id: str):
    try:
        await es.update(index=ALERTS_INDEX, id=alert_id,
                         doc={"acknowledged": True}, refresh=True)
        return {"acknowledged": True}
    except NotFoundError:
        raise HTTPException(status_code=404, detail="Alerta não encontrado")


# ── Status do sistema (admin) ──────────────────────────────────────────────────

@app.get("/admin/system-status", tags=["Administração"])
async def system_status():
    info         = await es.info()
    count_result = await es.count(index=LOGS_INDEX)
    alerts_open  = await es.count(index=ALERTS_INDEX, query={"term": {"acknowledged": False}})
    return {
        "message":                "Sistema operacional",
        "elasticsearch_version":  info["version"]["number"],
        "total_events":           count_result["count"],
        "active_alerts":          alerts_open["count"],
        "system_health":          "Stable",
    }
