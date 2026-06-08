import os
import jwt
from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from dotenv import load_dotenv

# Carrega as variáveis de ambiente
load_dotenv()
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "default_insecure_key")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")

# Configura o Rate Limiter para mitigar DoS
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="Vigilantia - Serviço de Parser e API Gateway")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

security = HTTPBearer()

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Valida o token JWT e retorna o payload"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")

def require_admin(token_payload: dict = Depends(verify_token)):
    """Dependência para RBAC: Valida se o usuário logado tem perfil de administrador"""
    if token_payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado: Requer privilégios de administrador")
    return token_payload

def classify_severity(message: str) -> str:
    """Classificação de Severidade Automática [RF10]"""
    msg_lower = message.lower()
    if any(keyword in msg_lower for keyword in ["fatal", "c2 beaconing", "breach"]):
        return "CRITICAL"
    elif any(keyword in msg_lower for keyword in ["error", "failed", "unauthorized"]):
        return "ERROR"
    elif any(keyword in msg_lower for keyword in ["warn", "deprecated"]):
        return "WARNING"
    return "INFO"

@app.post("/ingest", tags=["Ingestão"])
@limiter.limit("10/minute")
async def ingest_logs(request: Request, log_data: dict, token_payload: dict = Depends(verify_token)):
    """Recebe eventos e classifica a severidade antes do armazenamento"""
    sender = token_payload.get("sub")
    raw_message = log_data.get("message", "")
    
    # Aplica a regra de negócio do [RF10]
    severity = classify_severity(raw_message)
    
    processed_log = {
        "status": "processado",
        "ingested_by": sender,
        "event_severity": severity,
        "original_data": log_data
    }
    
    # Futuramente: enviar ao Elasticsearch
    return processed_log

@app.get("/admin/system-status", tags=["Administração"])
async def admin_dashboard(token_payload: dict = Depends(require_admin)):
    """Rota restrita: Apenas administradores podem acessar"""
    return {
        "message": f"Bem-vindo ao painel de controle, {token_payload.get('sub')}.",
        "active_alerts": 3,
        "system_health": "Stable"
    }