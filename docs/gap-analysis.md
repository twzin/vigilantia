# Gap Analysis — Vigilantia SIEM

Documento vivo: atualizado ao fim de cada fase.

## Requisitos Funcionais

| ID | Requisito | Status | Arquivo(s) |
|---|---|---|---|
| RF01 | POST /ingest com API key | ✅ DONE | gateway/main.py, parser/main.py |
| RF02 | Auth user/password + JWT | ✅ DONE | auth/main.py |
| RF03 | Search & filtering | ✅ DONE | parser/main.py, gateway/main.py, frontend/src/Logs.jsx |
| RF04 | Statistics panel | ✅ DONE | parser/main.py, gateway/main.py, frontend/src/Dashboard.jsx |
| RF05 | Alert configuration | ✅ DONE | parser/main.py (rules CRUD + motor), gateway/main.py, frontend/src/AlertRules.jsx |
| RF06 | User management | ✅ DONE | auth/main.py (PostgreSQL), gateway/main.py, frontend/src/Users.jsx |
| RF07 | Alert history | ✅ DONE | parser/main.py (vigilantia-alerts), gateway/main.py, frontend/src/AlertHistory.jsx |
| RF08 | Email notification | ⏳ PENDENTE | — (SMTP vars em .env.example) |
| RF09 | Regex search | ✅ DONE | parser/main.py (parâmetro regex=true) |
| RF10 | Severity classification | ✅ DONE | parser/main.py:classify_severity |

## Requisitos Não-Funcionais

| ID | Requisito | Status | Arquivo(s) |
|---|---|---|---|
| RNF01 | Perf ≤500ms / 1k events + load test | ✅ DONE | tests/locustfile.py — p95=6ms em /ingest |
| RNF02 | Secrets via .env / K8s Secrets | ✅ DONE | .env.example, k8s/secret.yaml, k8s/sealed-secret.yaml |
| RNF03 | Audit log imutável | ✅ DONE | auth/main.py:write_audit → vigilantia-audit (ES) |

## Rubrica

| Item | Pts | Status | Evidência |
|---|---|---|---|
| Architecture (microservices + API Gateway) | 1 | ✅ DONE | 5 serviços distintos, gateway como único ponto de entrada externo |
| Solution Implementation (todos RF+RNF) | 1 | 🔄 PARTIAL | RF08 (email) pendente; demais RFs e RNFs completos |
| Deployment (K8s Deployments + HA) | 1 | ✅ DONE | k8s/*.yaml, HPA, readiness/liveness probes, replicas ≥ 2 nos stateless |
| Application Security (STRIDE + SAST/SCA) | 1 | ✅ DONE | docs/stride-analysis.md, Bandit (SAST), Trivy (SCA), Gitleaks (secret scan) |
| Infrastructure Security (NetworkPolicy + securityContext + Sealed Secrets) | 1 | ✅ DONE | k8s/networkpolicy.yaml, securityContext em todos os deployments, k8s/sealed-secret.yaml |
| Pipelines (CI + CD delivery + CD deployment) | 1 | ✅ DONE | .github/workflows/ci.yml — secret scan + SAST + SCA + build/push + deploy job |
| Delivery (repo + relatório) | 1 | ⏳ PENDENTE | Relatório acadêmico fora do codebase |
