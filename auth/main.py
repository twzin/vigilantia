import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException, status, Depends
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from passlib.context import CryptContext
import jwt
from dotenv import load_dotenv

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, mapped_column, Mapped
from sqlalchemy import String, Boolean, select, delete
from elasticsearch import AsyncElasticsearch

load_dotenv()

SECRET_KEY                 = os.getenv("JWT_SECRET_KEY", "change_me_in_production")
ALGORITHM                  = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
DATABASE_URL               = os.getenv("DATABASE_URL", "postgresql+asyncpg://vigilantia:change_me@postgres:5432/vigilantia")
ES_URL                     = os.getenv("ELASTICSEARCH_URL", "http://elasticsearch:9200")
ES_USER                    = os.getenv("ELASTICSEARCH_USER", "elastic")
ES_PASSWORD                = os.getenv("ELASTICSEARCH_PASSWORD", "change_me")
AUDIT_INDEX                = "vigilantia-audit"

app = FastAPI(title="Vigilantia - Auth Service")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ── Banco de dados ─────────────────────────────────────────────────────────────

engine       = create_async_engine(DATABASE_URL, echo=False)
AsyncSession_ = async_sessionmaker(engine, expire_on_commit=False)

class Base(DeclarativeBase): pass

class User(Base):
    __tablename__ = "users"
    username:         Mapped[str]  = mapped_column(String(64), primary_key=True)
    hashed_password:  Mapped[str]  = mapped_column(String(256))
    role:             Mapped[str]  = mapped_column(String(32), default="cliente")
    active:           Mapped[bool] = mapped_column(Boolean, default=True)

async def get_db():
    async with AsyncSession_() as session:
        yield session

# ── Elasticsearch (audit log) ──────────────────────────────────────────────────

es: Optional[AsyncElasticsearch] = None

async def write_audit(user: str, action: str, detail: str):
    if not es:
        return
    try:
        await es.index(index=AUDIT_INDEX, document={
            "@timestamp": datetime.now(timezone.utc).isoformat(),
            "user": user, "action": action, "detail": detail,
        })
    except Exception:
        pass  # audit nunca deve derrubar a operação principal

# ── Startup ────────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup():
    global es
    es = AsyncElasticsearch(ES_URL, basic_auth=(ES_USER, ES_PASSWORD), verify_certs=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Seed de usuários padrão se a tabela estiver vazia
    async with AsyncSession_() as session:
        result = await session.execute(select(User))
        if not result.scalars().first():
            session.add_all([
                User(username="admin_user",  hashed_password=pwd_context.hash("senha123"), role="admin",   active=True),
                User(username="cliente_user", hashed_password=pwd_context.hash("senha123"), role="cliente", active=True),
            ])
            await session.commit()

@app.on_event("shutdown")
async def shutdown():
    if es:
        await es.close()

# ── Helpers ────────────────────────────────────────────────────────────────────

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=15))
    to_encode["exp"] = expire
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# ── Schemas ────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "cliente"

class UserUpdate(BaseModel):
    active:   Optional[bool] = None
    role:     Optional[str]  = None
    password: Optional[str]  = None

# ── Endpoints ──────────────────────────────────────────────────────────────────

@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok", "service": "auth"}


@app.post("/login", tags=["Autenticação"])
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == form_data.username))
    user = result.scalars().first()

    if not user or not pwd_context.verify(form_data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciais incorretas",
                            headers={"WWW-Authenticate": "Bearer"})
    if not user.active:
        raise HTTPException(status_code=403, detail="Conta desativada")

    token = create_access_token(
        data={"sub": user.username, "role": user.role},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {"access_token": token, "token_type": "bearer"}


@app.get("/admin/users", tags=["Administração"])
async def list_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User))
    return [{"username": u.username, "role": u.role, "active": u.active} for u in result.scalars().all()]


@app.post("/admin/users", status_code=201, tags=["Administração"])
async def create_user(payload: UserCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.username == payload.username))
    if existing.scalars().first():
        raise HTTPException(status_code=409, detail="Usuário já existe")

    user = User(username=payload.username, hashed_password=pwd_context.hash(payload.password),
                role=payload.role, active=True)
    db.add(user)
    await db.commit()
    await write_audit("system", "user_create", f"Usuário '{payload.username}' criado com role '{payload.role}'")
    return {"username": user.username, "role": user.role, "active": user.active}


@app.put("/admin/users/{username}", tags=["Administração"])
async def update_user(username: str, payload: UserUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    changes = []
    if payload.active is not None:
        user.active = payload.active
        changes.append(f"active={payload.active}")
    if payload.role is not None:
        user.role = payload.role
        changes.append(f"role={payload.role}")
    if payload.password is not None:
        user.hashed_password = pwd_context.hash(payload.password)
        changes.append("password=***")

    await db.commit()
    await write_audit("system", "user_update", f"Usuário '{username}' atualizado: {', '.join(changes)}")
    return {"username": username, "role": user.role, "active": user.active}


@app.delete("/admin/users/{username}", status_code=204, tags=["Administração"])
async def delete_user(username: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == username))
    if not result.scalars().first():
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    await db.execute(delete(User).where(User.username == username))
    await db.commit()
    await write_audit("system", "user_delete", f"Usuário '{username}' removido")
