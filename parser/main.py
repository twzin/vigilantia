import asyncio
import os
import re
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from typing import Optional
import aiosmtplib
from fastapi import FastAPI, Query, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
from elasticsearch import AsyncElasticsearch, NotFoundError

load_dotenv()

ES_URL       = os.getenv("ELASTICSEARCH_URL", "http://elasticsearch:9200")
ES_USER      = os.getenv("ELASTICSEARCH_USER", "elastic")
ES_PASSWORD  = os.getenv("ELASTICSEARCH_PASSWORD", "change_me")
LOGS_INDEX    = "vigilantia-logs"
AUDIT_INDEX   = "vigilantia-audit"
RULES_INDEX   = "vigilantia-alert-rules"
ALERTS_INDEX  = "vigilantia-alerts"
SYSLOG_INDEX  = "syslog-raw-*"  # Índice gravado pelo Filebeat

SMTP_HOST         = os.getenv("SMTP_HOST", "")
SMTP_PORT         = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER         = os.getenv("SMTP_USER", "")
SMTP_PASSWORD     = os.getenv("SMTP_PASSWORD", "")
ALERT_EMAIL_FROM  = os.getenv("ALERT_EMAIL_FROM", "")
ALERT_EMAIL_TO    = os.getenv("ALERT_EMAIL_TO", "")
FRONTEND_URL      = os.getenv("FRONTEND_URL", "http://localhost:3000")

# Set de IDs de documentos syslog já normalizados (evita re-processamento).
_processed_syslog_ids: set = set()

app = FastAPI(title="Vigilantia - Parser Service")
es: Optional[AsyncElasticsearch] = None
_normalizer_task: Optional[asyncio.Task] = None  # evita GC do background task

SEVERITY_PATTERNS = {
    "CRITICAL": ["fatal", "c2 beaconing", "breach", "ransomware", "exploit"],
    "ERROR":    ["error", "failed", "unauthorized", "denied", "exception"],
    "WARNING":  ["warn", "deprecated", "slow", "retry", "timeout"],
}

# Ordem crescente de severidade — usada para filtros "≥ X"
SEVERITY_ORDER = ["INFO", "WARNING", "ERROR", "CRITICAL"]

# Extratores de campos estruturados a partir do texto da mensagem
_RE_CLIENT_IP = re.compile(r'(?:from|src|source|client)\s+(\d{1,3}(?:\.\d{1,3}){3})', re.I)
_RE_USERNAME  = re.compile(r'(?:for user|for|user|login|account)\s+([\w@.\-]{1,50}?)(?:\s|$)', re.I)

def _extract_ip(message: str) -> Optional[str]:
    m = _RE_CLIENT_IP.search(message)
    return m.group(1) if m else None

_USERNAME_STOPWORDS = {"the", "a", "an", "by", "invalid", "unknown", "failed", "user"}

def _extract_username(message: str) -> Optional[str]:
    m = _RE_USERNAME.search(message)
    u = m.group(1) if m else None
    return u if u and u.lower() not in _USERNAME_STOPWORDS else None


async def _send_alert_email(alert_doc: dict) -> None:
    """Envia email ao admin quando um alerta é disparado (RF08).
    Silencioso se SMTP não estiver configurado."""
    if not SMTP_HOST or not ALERT_EMAIL_TO:
        return

    subject = f"[Vigilantia] Alerta: {alert_doc.get('rule_name', '')} — {alert_doc.get('severity', '')}"

    ips   = ", ".join(alert_doc.get("client_ips", []))      or "—"
    users = ", ".join(alert_doc.get("usernames", []))        or "—"
    hosts = ", ".join(alert_doc.get("reporting_hosts", [])) or "—"

    body = (
        f"Alerta disparado: {alert_doc.get('rule_name', '')}\n"
        f"\n"
        f"Severidade : {alert_doc.get('severity', '')}\n"
        f"Eventos    : {alert_doc.get('event_count', 0)} (threshold: {alert_doc.get('threshold', 0)})\n"
        f"Janela     : {alert_doc.get('window_minutes', 0)} minutos\n"
        f"Fonte      : {alert_doc.get('source', '') or 'qualquer'}\n"
        f"Keyword    : {alert_doc.get('keyword', '') or 'nenhuma'}\n"
        f"Horário    : {alert_doc.get('@timestamp', '')}\n"
        f"\n"
        f"IPs detectados   : {ips}\n"
        f"Usuários visados : {users}\n"
        f"Hosts            : {hosts}\n"
        f"\n"
        f"Amostra da mensagem:\n{alert_doc.get('sample_message', '')}\n"
        f"\n"
        f"Ver alertas: {FRONTEND_URL}/alerts\n"
    )

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"]    = ALERT_EMAIL_FROM or SMTP_USER
    msg["To"]      = ALERT_EMAIL_TO
    msg.set_content(body)

    try:
        use_tls   = SMTP_PORT == 465
        start_tls = SMTP_PORT != 465
        await aiosmtplib.send(
            msg,
            hostname=SMTP_HOST,
            port=SMTP_PORT,
            username=SMTP_USER or None,
            password=SMTP_PASSWORD or None,
            use_tls=use_tls,
            start_tls=start_tls,
        )
        print(f"[email] Notificação enviada para {ALERT_EMAIL_TO} — alerta: {alert_doc.get('rule_name')}", flush=True)
    except Exception as exc:
        print(f"[email] Falha ao enviar notificação: {exc}", flush=True)


@app.on_event("startup")
async def startup():
    global es, _normalizer_task
    es = AsyncElasticsearch(ES_URL, basic_auth=(ES_USER, ES_PASSWORD), verify_certs=False)
    await _ensure_indices()
    _normalizer_task = asyncio.create_task(_syslog_normalizer_loop())


@app.on_event("shutdown")
async def shutdown():
    if es:
        await es.close()


async def _ensure_indices():
    indices = {
        LOGS_INDEX: {
            "mappings": {"properties": {
                "@timestamp":     {"type": "date"},
                "source":         {"type": "keyword"},
                "level":          {"type": "keyword"},
                "message":        {"type": "text"},
                "severity":       {"type": "keyword"},
                "client_ip":      {"type": "ip",      "ignore_malformed": True},
                "username":       {"type": "keyword"},
                "reporting_host": {"type": "keyword"},
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
                "keyword":        {"type": "keyword"},
                "threshold":      {"type": "integer"},
                "window_minutes": {"type": "integer"},
                "active":         {"type": "boolean"},
                "created_by":     {"type": "keyword"},
                "created_at":     {"type": "date"},
            }}
        },
        ALERTS_INDEX: {
            "mappings": {"properties": {
                "@timestamp":      {"type": "date"},
                "rule_id":         {"type": "keyword"},
                "rule_name":       {"type": "keyword"},
                "severity":        {"type": "keyword"},
                "source":          {"type": "keyword"},
                "keyword":         {"type": "keyword"},
                "event_count":     {"type": "integer"},
                "threshold":       {"type": "integer"},
                "window_minutes":  {"type": "integer"},
                "acknowledged":    {"type": "boolean"},
                "client_ips":      {"type": "ip",      "ignore_malformed": True},
                "usernames":       {"type": "keyword"},
                "reporting_hosts": {"type": "keyword"},
                "sample_message":  {"type": "text"},
            }}
        },
    }
    for index, body in indices.items():
        if not await es.indices.exists(index=index):
            await es.indices.create(index=index, body=body)


# ── Normalizador Filebeat syslog (background task) ────────────────────────────

_SYSLOG_SEV_MAP = {
    "emerg": "CRITICAL", "alert": "CRITICAL", "crit": "CRITICAL", "critical": "CRITICAL",
    "err": "ERROR", "error": "ERROR",
    "warning": "WARNING", "warn": "WARNING",
    "notice": "INFO", "info": "INFO", "debug": "INFO",
}


async def _normalize_syslog_events() -> int:
    """Lê documentos não-processados do índice syslog-raw-* (Filebeat) e normaliza para vigilantia-logs."""
    global _processed_syslog_ids

    try:
        result = await es.search(
            index=SYSLOG_INDEX,
            query={"match_all": {}},
            size=500,
            sort=[{"@timestamp": {"order": "asc"}}],
            ignore_unavailable=True,
            allow_no_indices=True,
        )
    except Exception:
        return 0

    # Filtra apenas documentos ainda não processados
    new_hits = [h for h in result["hits"]["hits"] if h["_id"] not in _processed_syslog_ids]
    if not new_hits:
        return 0

    operations = []
    for hit in new_hits:
        src = hit["_source"]
        msg = src.get("message", "")

        syslog_sev = (((src.get("log") or {}).get("syslog") or {}).get("severity") or {}).get("name", "")
        severity = _SYSLOG_SEV_MAP.get(syslog_sev.lower(), None) if syslog_sev else None
        if not severity:
            severity = classify_severity(msg)

        proc = src.get("process") or {}
        source = (
            proc.get("program") or proc.get("name") or
            (src.get("host") or {}).get("name") or
            "syslog"
        )
        # hostname do syslog = dispositivo que enviou o log (≠ host do agente Filebeat)
        reporting_host = src.get("hostname") or (src.get("host") or {}).get("hostname") or source

        _processed_syslog_ids.add(hit["_id"])
        operations.append({"index": {"_index": LOGS_INDEX}})
        operations.append({
            "@timestamp":     src.get("@timestamp", datetime.now(timezone.utc).isoformat()),
            "source":         source,
            "level":          severity.lower(),
            "message":        msg,
            "severity":       severity,
            "client_ip":      _extract_ip(msg),
            "username":       _extract_username(msg),
            "reporting_host": reporting_host,
        })

    # Limpa o set quando fica grande (eventos antigos não serão revisitados de qualquer forma)
    if len(_processed_syslog_ids) > 50_000:
        _processed_syslog_ids.clear()

    await es.bulk(operations=operations, refresh=True)
    await _evaluate_alert_rules()
    return len(new_hits)


async def _syslog_normalizer_loop():
    """Loop infinito: normaliza eventos Filebeat a cada 5 segundos."""
    print("[syslog-normalizer] Background task iniciado")
    while True:
        await asyncio.sleep(5)
        try:
            count = await _normalize_syslog_events()
            if count:
                print(f"[syslog-normalizer] {count} evento(s) normalizados do Filebeat")
        except Exception as exc:
            print(f"[syslog-normalizer] Erro: {exc}", flush=True)


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
        msg      = event.get("message", "")
        severity = classify_severity(msg)
        doc = {
            "@timestamp":     event.get("@timestamp", datetime.now(timezone.utc).isoformat()),
            "source":         event.get("source", "unknown"),
            "level":          event.get("level", "info"),
            "message":        msg,
            "severity":       severity,
            "client_ip":      event.get("client_ip") or _extract_ip(msg),
            "username":       event.get("username")  or _extract_username(msg),
            "reporting_host": event.get("reporting_host") or event.get("source", "unknown"),
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

        # Severidade: filtra por faixa "≥ severity" (ex: ERROR inclui ERROR + CRITICAL)
        if rule.get("severity"):
            min_sev = rule["severity"].upper()
            try:
                idx = SEVERITY_ORDER.index(min_sev)
                must.append({"terms": {"severity": SEVERITY_ORDER[idx:]}})
            except ValueError:
                must.append({"term": {"severity": min_sev}})

        if rule.get("source"):
            must.append({"term": {"source": rule["source"]}})

        # Keyword: busca o termo na mensagem (case-insensitive via analisador padrão ES)
        if rule.get("keyword"):
            must.append({"match": {"message": rule["keyword"]}})

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

        # Busca amostra dos eventos disparadores para extrair metadados
        try:
            sample = await es.search(
                index=LOGS_INDEX,
                query={"bool": {"must": must}},
                size=20,
                sort=[{"@timestamp": {"order": "desc"}}],
            )
            hits = sample["hits"]["hits"]
            client_ips      = list({h["_source"]["client_ip"]      for h in hits if h["_source"].get("client_ip")})[:10]
            usernames       = list({h["_source"]["username"]        for h in hits if h["_source"].get("username")})[:10]
            reporting_hosts = list({h["_source"]["reporting_host"]  for h in hits if h["_source"].get("reporting_host")})[:10]
            sample_message  = hits[0]["_source"].get("message", "") if hits else ""
        except Exception:
            client_ips = usernames = reporting_hosts = []
            sample_message = ""

        alert_doc = {
            "@timestamp":      datetime.now(timezone.utc).isoformat(),
            "rule_id":         rule_id,
            "rule_name":       rule.get("name", ""),
            "severity":        rule.get("severity", ""),
            "source":          rule.get("source", ""),
            "keyword":         rule.get("keyword", ""),
            "event_count":     count,
            "threshold":       rule.get("threshold", 1),
            "window_minutes":  rule.get("window_minutes", 10),
            "acknowledged":    False,
            "client_ips":      client_ips,
            "usernames":       usernames,
            "reporting_hosts": reporting_hosts,
            "sample_message":  sample_message,
        }
        await es.index(index=ALERTS_INDEX, document=alert_doc)
        await _send_alert_email(alert_doc)


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
    severity:       Optional[str] = None   # severidade mínima: dispara em ≥ este nível
    source:         Optional[str] = None
    keyword:        Optional[str] = None   # palavra-chave obrigatória na mensagem
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
