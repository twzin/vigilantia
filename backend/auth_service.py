import os
from datetime import datetime, timedelta, timezone
from fastapi import FastAPI, HTTPException, status, Depends
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from passlib.context import CryptContext
import jwt
from dotenv import load_dotenv

# Carrega as variáveis de ambiente do .env para não expor credenciais
load_dotenv()

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "default_insecure_key")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60))

app = FastAPI(title="Vigilantia - Serviço de Autenticação")

# Configuração de Hash de senhas
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

# BD de Credenciais Simulado (Substituirá o banco real por enquanto)
# As senhas abaixo são o hash para a palavra "senha123"
MOCK_USERS_DB = {
    "admin_user": {
        "username": "admin_user",
        "hashed_password": pwd_context.hash("senha123"),
        "role": "admin"
    },
    "cliente_user": {
        "username": "cliente_user",
        "hashed_password": pwd_context.hash("senha123"),
        "role": "cliente"
    }
}

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

@app.post("/login", tags=["Autenticação"])
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    user = MOCK_USERS_DB.get(form_data.username)
    if not user or not verify_password(form_data.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais incorretas",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Define a expiração de 1 hora conforme o modelo da arquitetura
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    # Embutimos o 'role' no JWT para facilitar a validação RBAC no API Gateway futuramente
    access_token = create_access_token(
        data={"sub": user["username"], "role": user["role"]}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me", tags=["Teste de Autenticação"])
async def read_users_me(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        role: str = payload.get("role")
        if username is None:
            raise HTTPException(status_code=401, detail="Token inválido")
        return {"username": username, "role": role, "message": "Autenticado com sucesso!"}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")