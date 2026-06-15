import os
import jwt
import httpx
from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from dotenv import load_dotenv

load_dotenv()

def _require(key: str) -> str:
    value = os.getenv(key)
    if not value:
        raise RuntimeError(f"Variável de ambiente obrigatória não definida: {key}")
    return value

SECRET_KEY         = _require("JWT_SECRET_KEY")
INGEST_API_KEY     = _require("INGEST_API_KEY")
ALGORITHM          = os.getenv("JWT_ALGORITHM", "HS256")
AUTH_SERVICE_URL   = os.getenv("AUTH_SERVICE_URL", "http://auth:8001")
PARSER_SERVICE_URL = os.getenv("PARSER_SERVICE_URL", "http://parser:8002")

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="Vigilantia - API Gateway")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

security = HTTPBearer()


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")


def require_admin(token_payload: dict = Depends(verify_token)):
    if token_payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado: requer perfil de administrador")
    return token_payload


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok", "service": "gateway"}


# ── Auth proxy ─────────────────────────────────────────────────────────────────

@app.post("/login", tags=["Autenticação"])
async def login(request: Request):
    body = await request.body()
    content_type = request.headers.get("content-type", "application/x-www-form-urlencoded")
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{AUTH_SERVICE_URL}/login",
            content=body,
            headers={"content-type": content_type},
        )
    return Response(
        content=resp.content,
        status_code=resp.status_code,
        media_type=resp.headers.get("content-type"),
    )


# ── Ingest: autenticado por API Key (RF01) + rate limiting anti-DoS ────────────

@app.post("/ingest", tags=["Ingestão"])
@limiter.limit("100/minute")
async def ingest(request: Request):
    api_key = request.headers.get("X-API-Key")
    if api_key != INGEST_API_KEY:
        raise HTTPException(status_code=401, detail="API key inválida ou ausente")
    body = await request.body()
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{PARSER_SERVICE_URL}/ingest",
            content=body,
            headers={"content-type": "application/json"},
        )
    return Response(
        content=resp.content,
        status_code=resp.status_code,
        media_type=resp.headers.get("content-type"),
    )


# ── Search & stats: JWT obrigatório (RF03, RF04, RF09) ─────────────────────────

@app.get("/search", tags=["Consulta"])
async def search(request: Request, token_payload: dict = Depends(verify_token)):
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{PARSER_SERVICE_URL}/search",
            params=dict(request.query_params),
        )
    return Response(
        content=resp.content,
        status_code=resp.status_code,
        media_type=resp.headers.get("content-type"),
    )


@app.get("/stats", tags=["Consulta"])
async def stats(token_payload: dict = Depends(verify_token)):
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{PARSER_SERVICE_URL}/stats")
    return Response(
        content=resp.content,
        status_code=resp.status_code,
        media_type=resp.headers.get("content-type"),
    )


# ── Admin: JWT com role=admin obrigatório (RBAC) ───────────────────────────────

@app.get("/admin/system-status", tags=["Administração"])
async def system_status(token_payload: dict = Depends(require_admin)):
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{PARSER_SERVICE_URL}/admin/system-status")
    return Response(
        content=resp.content,
        status_code=resp.status_code,
        media_type=resp.headers.get("content-type"),
    )


@app.get("/admin/users", tags=["Administração"])
async def list_users(token_payload: dict = Depends(require_admin)):
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{AUTH_SERVICE_URL}/admin/users")
    return Response(
        content=resp.content,
        status_code=resp.status_code,
        media_type=resp.headers.get("content-type"),
    )


@app.post("/admin/users", tags=["Administração"])
async def create_user(request: Request, token_payload: dict = Depends(require_admin)):
    body = await request.body()
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{AUTH_SERVICE_URL}/admin/users",
            content=body,
            headers={"content-type": "application/json"},
        )
    return Response(
        content=resp.content,
        status_code=resp.status_code,
        media_type=resp.headers.get("content-type"),
    )


@app.put("/admin/users/{username}", tags=["Administração"])
async def update_user(username: str, request: Request, token_payload: dict = Depends(require_admin)):
    body = await request.body()
    async with httpx.AsyncClient() as client:
        resp = await client.put(
            f"{AUTH_SERVICE_URL}/admin/users/{username}",
            content=body,
            headers={"content-type": "application/json"},
        )
    return Response(
        content=resp.content,
        status_code=resp.status_code,
        media_type=resp.headers.get("content-type"),
    )


@app.delete("/admin/users/{username}", tags=["Administração"])
async def delete_user(username: str, token_payload: dict = Depends(require_admin)):
    async with httpx.AsyncClient() as client:
        resp = await client.delete(f"{AUTH_SERVICE_URL}/admin/users/{username}")
    return Response(content=resp.content, status_code=resp.status_code, media_type=resp.headers.get("content-type"))


# ── Alert rules (RF05) — admin only ───────────────────────────────────────────

@app.get("/admin/alert-rules", tags=["Alertas"])
async def list_alert_rules(token_payload: dict = Depends(require_admin)):
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{PARSER_SERVICE_URL}/admin/alert-rules")
    return Response(content=resp.content, status_code=resp.status_code, media_type=resp.headers.get("content-type"))


@app.post("/admin/alert-rules", tags=["Alertas"])
async def create_alert_rule(request: Request, token_payload: dict = Depends(require_admin)):
    body = await request.body()
    async with httpx.AsyncClient() as client:
        resp = await client.post(f"{PARSER_SERVICE_URL}/admin/alert-rules",
                                  content=body, headers={"content-type": "application/json"})
    return Response(content=resp.content, status_code=resp.status_code, media_type=resp.headers.get("content-type"))


@app.put("/admin/alert-rules/{rule_id}", tags=["Alertas"])
async def update_alert_rule(rule_id: str, request: Request, token_payload: dict = Depends(require_admin)):
    body = await request.body()
    async with httpx.AsyncClient() as client:
        resp = await client.put(f"{PARSER_SERVICE_URL}/admin/alert-rules/{rule_id}",
                                 content=body, headers={"content-type": "application/json"})
    return Response(content=resp.content, status_code=resp.status_code, media_type=resp.headers.get("content-type"))


@app.delete("/admin/alert-rules/{rule_id}", tags=["Alertas"])
async def delete_alert_rule(rule_id: str, token_payload: dict = Depends(require_admin)):
    async with httpx.AsyncClient() as client:
        resp = await client.delete(f"{PARSER_SERVICE_URL}/admin/alert-rules/{rule_id}")
    return Response(content=resp.content, status_code=resp.status_code, media_type=resp.headers.get("content-type"))


# ── Alert history (RF07) — todos os usuários autenticados ─────────────────────

@app.get("/alerts", tags=["Alertas"])
async def list_alerts(request: Request, token_payload: dict = Depends(verify_token)):
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{PARSER_SERVICE_URL}/alerts", params=dict(request.query_params))
    return Response(content=resp.content, status_code=resp.status_code, media_type=resp.headers.get("content-type"))


@app.patch("/alerts/{alert_id}/acknowledge", tags=["Alertas"])
async def acknowledge_alert(alert_id: str, token_payload: dict = Depends(verify_token)):
    async with httpx.AsyncClient() as client:
        resp = await client.patch(f"{PARSER_SERVICE_URL}/alerts/{alert_id}/acknowledge")
    return Response(content=resp.content, status_code=resp.status_code, media_type=resp.headers.get("content-type"))
