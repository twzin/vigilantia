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
| RF08 | Email notification | ⏳ Adiado | — (SMTP vars em .env.example) |
| RF09 | Regex search | ✅ DONE | parser/main.py (parâmetro regex=true) |
| RF10 | Severity classification | ✅ DONE | parser/main.py:classify_severity |

## Requisitos Não-Funcionais

| ID | Requisito | Status | Arquivo(s) |
|---|---|---|---|
| RNF01 | Perf ≤500ms / 1k events + load test | ⏳ Phase 4 | parser usa bulk indexing |
| RNF02 | Secrets via .env / K8s Secrets | ✅ PARTIAL | .env.example criado; K8s na Phase 6 |
| RNF03 | Audit log imutável | ✅ DONE | auth/main.py:write_audit → vigilantia-audit (ES) |

## Rubrica

| Item | Pts | Status |
|---|---|---|
| Architecture (microservices + API Gateway) | 1 | ✅ Phase 1 concluída |
| Solution Implementation (todos RF+RNF) | 1 | 🔄 Phase 2–3 concluídas / Phase 4 pendente |
| Deployment (K8s Deployments + HA) | 1 | ⏳ Phase 6 |
| Application Security (STRIDE + SAST/SCA) | 1 | 🔄 Phase 4–5 |
| Infrastructure Security (NetworkPolicy + PSA + Secrets) | 1 | ⏳ Phase 6 |
| Pipelines (CI + CD + K8s deploy) | 1 | 🔄 Phase 5 |
| Delivery (repo + relatório) | 1 | ⏳ Phase 7 |
