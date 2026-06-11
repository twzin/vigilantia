import os
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import FastAPI, HTTPException, status, Depends
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from passlib.context import CryptContext
import jwt
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change_me_in_production")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

app = FastAPI(title="Vigilantia - Auth Service")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# BD de credenciais em memória — substituído por banco real na Phase 3
USERS_DB: dict[str, dict] = {
    "admin_user": {
        "username": "admin_user",
        "hashed_password": pwd_context.hash("senha123"),
        "role": "admin",
        "active": True,
    },
    "cliente_user": {
        "username": "cliente_user",
        "hashed_password": pwd_context.hash("senha123"),
        "role": "cliente",
        "active": True,
    },
}


class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "cliente"


class UserUpdate(BaseModel):
    active: Optional[bool] = None
    role: Optional[str] = None
    password: Optional[str] = None


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=15))
    to_encode["exp"] = expire
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok", "service": "auth"}


@app.post("/login", tags=["Autenticação"])
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = USERS_DB.get(form_data.username)
    if not user or not pwd_context.verify(form_data.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais incorretas",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.get("active", True):
        raise HTTPException(status_code=403, detail="Conta desativada")

    token = create_access_token(
        data={"sub": user["username"], "role": user["role"]},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {"access_token": token, "token_type": "bearer"}


@app.get("/admin/users", tags=["Administração"])
async def list_users():
    return [
        {"username": u["username"], "role": u["role"], "active": u["active"]}
        for u in USERS_DB.values()
    ]


@app.post("/admin/users", status_code=201, tags=["Administração"])
async def create_user(payload: UserCreate):
    if payload.username in USERS_DB:
        raise HTTPException(status_code=409, detail="Usuário já existe")
    USERS_DB[payload.username] = {
        "username": payload.username,
        "hashed_password": pwd_context.hash(payload.password),
        "role": payload.role,
        "active": True,
    }
    return {"username": payload.username, "role": payload.role, "active": True}


@app.put("/admin/users/{username}", tags=["Administração"])
async def update_user(username: str, payload: UserUpdate):
    user = USERS_DB.get(username)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    if payload.active is not None:
        user["active"] = payload.active
    if payload.role is not None:
        user["role"] = payload.role
    if payload.password is not None:
        user["hashed_password"] = pwd_context.hash(payload.password)
    return {"username": username, "role": user["role"], "active": user["active"]}


@app.delete("/admin/users/{username}", status_code=204, tags=["Administração"])
async def delete_user(username: str):
    if username not in USERS_DB:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    del USERS_DB[username]
