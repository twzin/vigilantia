# Vigilantia SIEM

![CI/CD](https://github.com/twzin/vigilantia/actions/workflows/ci.yml/badge.svg)

Sistema de **Security Information and Event Management (SIEM)** desenvolvido como projeto acadêmico de DevSecOps. Arquitetura de microsserviços com pipeline de segurança automatizado, deploy em Docker Compose e Kubernetes.

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│                    Rede Externa                          │
│                                                         │
│   [Navegador] ──► [Frontend React :3000]                │
│                          │                              │
│   [Filebeat]  ──► [API Gateway :8000] ◄── [Analista]   │
└──────────────────────────┼──────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────┐
│                    Rede Interna                          │
│                          │                              │
│              ┌───────────┴───────────┐                  │
│              ▼                       ▼                   │
│     [Auth Service :8001]   [Parser Service :8002]       │
│              │                       │                   │
│              ▼                       ▼                   │
│         [PostgreSQL]          [Elasticsearch]            │
└─────────────────────────────────────────────────────────┘
```

| Serviço | Tecnologia | Porta | Função |
|---|---|---|---|
| Frontend | React 19 + Vite + Nginx | 3000 | Interface web RBAC |
| API Gateway | FastAPI + slowapi | 8000 | Ponto de entrada único, autenticação, rate limiting |
| Auth Service | FastAPI + PostgreSQL | 8001 | JWT, gestão de usuários, audit log |
| Parser Service | FastAPI + Elasticsearch | 8002 | Ingestão, busca, alertas |
| Elasticsearch | 8.13.4 | 9200 | Storage de logs, alertas e audit |
| PostgreSQL | 16-alpine | 5432 | Persistência de usuários |

---

## Funcionalidades

- **RF01** — Ingestão de logs via API Key (`POST /ingest`)
- **RF02** — Autenticação com usuário/senha + JWT
- **RF03** — Busca e filtragem de logs (texto, severidade, fonte, data, regex)
- **RF04** — Dashboard com estatísticas (volume, distribuição por severidade, top fontes)
- **RF05** — Configuração de regras de alerta (threshold + janela de tempo)
- **RF06** — Gestão de usuários com roles (admin / cliente)
- **RF07** — Histórico de alertas com reconhecimento
- **RF09** — Busca com expressões regulares
- **RF10** — Classificação automática de severidade (CRITICAL / ERROR / WARNING / INFO)
- **RNF02** — Secrets via `.env` / Kubernetes Secrets
- **RNF03** — Audit log imutável (append-only no Elasticsearch)

---

## Pré-requisitos

- Docker + Docker Compose
- Git

---

## Rodando com Docker Compose

### 1. Clone o repositório
```bash
git clone git@github.com:twzin/vigilantia.git
cd vigilantia
```

### 2. Configure as variáveis de ambiente
```bash
cp .env.example .env
# Edite o .env e preencha as senhas reais
```

### 3. Suba o ambiente
```bash
docker compose up -d
```

### 4. Aguarde os serviços inicializarem (~2 min)
```bash
docker compose ps
```

### 5. Acesse
| Serviço | URL |
|---|---|
| Frontend | http://localhost:3000 |
| API Gateway | http://localhost:8000 |
| Docs API | http://localhost:8000/docs |

### Credenciais padrão
| Usuário | Senha | Role |
|---|---|---|
| admin_user | senha123 | Admin |
| cliente_user | senha123 | Cliente |

### Parar o ambiente
```bash
docker compose down
# Para remover volumes (apaga todos os dados):
docker compose down -v
```

---

## Rodando com Kubernetes (kind)

### 1. Instale o kind e kubectl
```bash
curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.23.0/kind-linux-amd64
chmod +x ./kind && sudo mv ./kind /usr/local/bin/kind

curl -LO "https://dl.k8s.io/release/$(curl -sL https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl && sudo mv kubectl /usr/local/bin/kubectl
```

### 2. Crie o cluster
```bash
kind create cluster --name vigilantia
# Ajuste necessário para o Elasticsearch:
docker exec vigilantia-control-plane sysctl -w vm.max_map_count=262144
```

### 3. Aplique os manifests
```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/networkpolicy.yaml
kubectl apply -f k8s/elasticsearch-statefulset.yaml
kubectl apply -f k8s/postgres-statefulset.yaml

# Aguarda storage subir
kubectl wait --for=condition=ready pod -l app=postgres -n vigilantia --timeout=60s

kubectl apply -f k8s/auth-deployment.yaml
kubectl apply -f k8s/parser-deployment.yaml
kubectl apply -f k8s/gateway-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/hpa.yaml
```

### 4. Acesse via port-forward
```bash
# Terminal 1
kubectl port-forward service/gateway 8000:8000 -n vigilantia
# Terminal 2
kubectl port-forward service/frontend 3000:80 -n vigilantia
```

Acesse http://localhost:3000

---

## Load Test (RNF01)

Valida que o endpoint `/ingest` suporta carga com latência ≤500ms no p95.

```bash
pip install locust
INGEST_API_KEY=<sua_key> locust -f tests/locustfile.py \
  --host=http://localhost:8000 \
  --headless -u 50 -r 10 --run-time 60s \
  --html tests/load-test-report.html
```

---

## Pipeline CI/CD

| Evento | Jobs |
|---|---|
| Push em `development` ou PR para `main` | SAST (Bandit) + SCA (Trivy) |
| Push em `main` | SAST + SCA + CD (build e push das imagens para ghcr.io) |

**Imagens publicadas:**
- `ghcr.io/twzin/vigilantia-auth:latest`
- `ghcr.io/twzin/vigilantia-parser:latest`
- `ghcr.io/twzin/vigilantia-gateway:latest`
- `ghcr.io/twzin/vigilantia-frontend:latest`

---

## Segurança

- **SAST**: Bandit analisa o código Python em cada push
- **SCA**: Trivy escaneia dependências e bloqueia CVEs HIGH/CRITICAL
- **STRIDE**: Modelagem de ameaças documentada em [docs/stride-analysis.md](docs/stride-analysis.md)
- **Rede isolada**: serviços internos inacessíveis externamente (Docker e K8s NetworkPolicy)
- **Secrets**: nunca commitados — gerenciados via `.env` (local) e Kubernetes Secrets (produção)
- **Audit log**: todas as ações administrativas registradas no Elasticsearch (append-only)

---

## Estrutura do Projeto

```
vigilantia/
├── auth/               # Auth Service (FastAPI + PostgreSQL)
├── parser/             # Parser Service (FastAPI + Elasticsearch)
├── gateway/            # API Gateway (FastAPI)
├── frontend/           # Frontend (React + Vite)
├── k8s/                # Manifests Kubernetes
├── tests/              # Load test (Locust)
├── docs/               # Documentação técnica e STRIDE
├── .github/workflows/  # Pipeline CI/CD
├── docker-compose.yml
└── .env.example
```
