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

# Configura o Rate Limiter usando o IP do cliente
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="Vigilantia - Serviço de Parser e API Gateway")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

security = HTTPBearer()

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Valida o token JWT recebido no cabeçalho Authorization"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")

@app.post("/ingest", tags=["Ingestão"])
@limiter.limit("10/minute") # Limita a 10 requisições por minuto por IP para mitigar DoS
async def ingest_logs(request: Request, log_data: dict, token_payload: dict = Depends(verify_token)):
    """
    Recebe lotes de eventos.
    Nesta fase inicial, apenas simula o processamento antes de integrarmos o Elasticsearch.
    """
    # Extrai quem enviou o log a partir do token
    sender = token_payload.get("sub")
    
    # Mock do processamento e normalização
    processed_log = {
        "status": "sucesso",
        "message": "Log ingerido e validado pelo Parser",
        "ingested_by": sender,
        "raw_size": len(str(log_data)),
        "data": log_data
    }
    
    # Futuramente: enviar "processed_log" para o Elasticsearch
    
    return processed_log