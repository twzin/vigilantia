# Vigilantia SIEM

![CI/CD](https://github.com/twzin/vigilantia/actions/workflows/ci.yml/badge.svg)

Sistema de **Security Information and Event Management (SIEM)** desenvolvido como projeto acadêmico de DevSecOps. Arquitetura de microsserviços com pipeline de segurança automatizado, deploy em Docker Compose e Kubernetes.

---

## Arquitetura

```
[Dispositivos / OS] ──syslog UDP/TCP 5140──► [Filebeat] ─► [syslog-raw-*]
                                                                    │
                                                          (normaliza a cada 5s)
                                                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  Rede Externa                                                            │
│   [Navegador] ──► [Frontend React :3000]                                │
│   [Analista]  ──► [API Gateway :8000]                                   │
└────────────────────────────┬─────────────────────────────────────────────┘
                             │ Rede Interna
                   ┌─────────┴──────────┐
                   ▼                    ▼
         [Auth Service :8001]  [Parser Service :8002]
                   │                    │
                   ▼                    ▼
             [PostgreSQL]        [Elasticsearch]
                                 vigilantia-logs
                                 vigilantia-alerts
                                 syslog-raw-*
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
kubectl apply -f k8s/filebeat-deployment.yaml
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

## Ingestão via Syslog em Tempo Real (Filebeat)

O Filebeat escuta syslog em UDP/TCP e grava os eventos brutos no Elasticsearch (`syslog-raw-*`). O Parser Service normaliza esses eventos para `vigilantia-logs` a cada 5 segundos, classificando severidade automaticamente.

```
[Firewall / Servidor / SO] ──syslog UDP/TCP──► [Filebeat] ──► [syslog-raw-*]
                                                                      │
                                                           [Parser — a cada 5s]
                                                                      │
                                                           [vigilantia-logs → Dashboard]
```

### Para onde apontar o syslog

O endereço de destino depende do ambiente de execução e de onde está o dispositivo que envia os logs:

#### Docker Compose

| Origem dos logs | Endereço de destino | Porta |
|---|---|---|
| Mesma máquina que roda o Docker | `127.0.0.1` | `5140` |
| Outro dispositivo na rede local (firewall, switch, servidor) | `<IP da máquina com Docker>` | `5140` |

Para descobrir o IP da máquina na rede local:
```bash
# Linux/macOS
ip route get 1 | awk '{print $7; exit}'

# Windows
ipconfig | findstr "IPv4"
```

Exemplo: se sua máquina tem IP `192.168.1.50`, configure o firewall para enviar syslog para `192.168.1.50:5140`.

#### Kubernetes (kind — desenvolvimento local)

No kind, o NodePort não fica em `127.0.0.1` — ele fica no IP do node (um container Docker). Descubra o IP:

```bash
kubectl get nodes -o wide
# ou
docker inspect vigilantia-control-plane \
  --format '{{.NetworkSettings.Networks.kind.IPAddress}}'
```

O dispositivo deve apontar para `<IP_DO_NODE>:30514` (UDP) ou `<IP_DO_NODE>:30515` (TCP).

#### Kubernetes (cluster real / produção)

Aponte para o IP de qualquer node do cluster na porta NodePort:

```
<IP_DO_NODE>:30514   # UDP
<IP_DO_NODE>:30515   # TCP
```

Para expor globalmente sem fixar um node, use um `LoadBalancer` ou `Ingress UDP` no lugar do NodePort.

---

### Testar com uma mensagem manual

Substitua `<HOST>` e `<PORTA>` conforme a tabela acima.

```bash
# Linux/macOS — via logger (mais simples)
logger -n <HOST> -P <PORTA> --udp "Teste de log syslog do servidor web"

# Linux/macOS — via netcat, formato RFC 3164
echo "<34>$(date +'%b %d %H:%M:%S') meuservidor sshd[1234]: Failed password for root from 10.0.0.1" \
  | nc -u -w1 <HOST> <PORTA>

# Windows — via PowerShell
$udp = New-Object System.Net.Sockets.UdpClient
$udp.Connect("<HOST>", <PORTA>)
$msg = "<34>$(Get-Date -Format 'MMM dd HH:mm:ss') winhost audit: Login failed for Administrator"
$bytes = [System.Text.Encoding]::ASCII.GetBytes($msg)
$udp.Send($bytes, $bytes.Length)
$udp.Close()
```

Após enviar, aguarde até 5 segundos e o evento aparece no dashboard em **http://localhost:3000**.

---

### Configurar dispositivos reais

#### Firewall (pfSense / OPNsense)

`Status → System Logs → Settings → Remote Logging`:
- **Remote log servers**: `<IP_DA_MAQUINA>:<PORTA>`
- **Syslog Contents**: escolha as categorias desejadas (Firewall, VPN, Auth, etc.)

#### Servidor Linux (rsyslog)

Crie `/etc/rsyslog.d/vigilantia.conf`:

```
# Encaminha todos os logs para o Vigilantia via UDP
*.* @<IP_DA_MAQUINA>:<PORTA>

# Para usar TCP (mais confiável):
# *.* @@<IP_DA_MAQUINA>:<PORTA>
```

Reinicie: `sudo systemctl restart rsyslog`

#### Servidor Linux (syslog-ng)

```
destination d_vigilantia {
  network("<IP_DA_MAQUINA>" port(<PORTA>) transport("udp"));
};
log { source(s_src); destination(d_vigilantia); };
```

#### Cisco IOS / NX-OS

```
logging host <IP_DA_MAQUINA> transport udp port <PORTA>
logging trap informational
```

#### Windows (NXLog)

```xml
<Output out_vigilantia>
  Module  om_udpsyslog
  Host    <IP_DA_MAQUINA>
  Port    <PORTA>
</Output>
```

---

### Como os eventos aparecem no Vigilantia

O Filebeat parseia o syslog e extrai automaticamente:

| Campo syslog | Campo no Vigilantia | Exemplo |
|---|---|---|
| `program` / `process` | `source` | `sshd`, `nginx`, `kernel` |
| `message` | `message` | `Failed password for root` |
| Severity (PRI) + keywords | `severity` | `ERROR`, `CRITICAL`, `WARNING` |
| Timestamp da mensagem | `@timestamp` | `2026-06-14T22:00:00Z` |

Classificação de severidade automática (além do campo syslog):

| Keywords na mensagem | Severidade atribuída |
|---|---|
| `exploit`, `breach`, `ransomware`, `fatal` | `CRITICAL` |
| `error`, `failed`, `unauthorized`, `denied` | `ERROR` |
| `warn`, `timeout`, `retry` | `WARNING` |
| demais | `INFO` |

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
