# Gap Analysis — Vigilantia SIEM

Documento vivo: atualizado ao fim de cada fase.

## Requisitos Funcionais

| ID | Requisito | Status | Arquivo(s) |
|---|---|---|---|
| RF01 | POST /ingest com API key | ✅ DONE | gateway/main.py:ingest, parser/main.py:ingest |
| RF02 | Auth user/password + JWT | ✅ DONE | auth/main.py:login |
| RF03 | Search & filtering | ✅ DONE | parser/main.py:search, gateway/main.py:search |
| RF04 | Statistics panel | ✅ DONE | parser/main.py:stats, gateway/main.py:stats |
| RF05 | Alert configuration | ⏳ Phase 3 | — |
| RF06 | User management | ✅ PARTIAL | auth/main.py (CRUD em memória; banco real na Phase 3) |
| RF07 | Alert history | ⏳ Phase 3 | — |
| RF08 | Email notification | ⏳ Phase 3 | — |
| RF09 | Regex search | ✅ DONE | parser/main.py:search (parâmetro regex=true) |
| RF10 | Severity classification | ✅ DONE | parser/main.py:classify_severity |

## Requisitos Não-Funcionais

| ID | Requisito | Status | Arquivo(s) |
|---|---|---|---|
| RNF01 | Perf ≤500ms / 1k events + load test | ⏳ Phase 4 | parser usa bulk indexing |
| RNF02 | Secrets via .env / K8s Secrets | ✅ PARTIAL | .env.example criado; K8s na Phase 6 |
| RNF03 | Audit log imutável | ⏳ Phase 4 | índice vigilantia-audit criado no parser |

## Rubrica

| Item | Pts | Status |
|---|---|---|
| Architecture (microservices + API Gateway) | 1 | ✅ Phase 1 concluída |
| Solution Implementation (todos RF+RNF) | 1 | 🔄 Phase 2–4 |
| Deployment (K8s Deployments + HA) | 1 | ⏳ Phase 6 |
| Application Security (STRIDE + SAST/SCA) | 1 | 🔄 Phase 4–5 |
| Infrastructure Security (NetworkPolicy + PSA + Secrets) | 1 | ⏳ Phase 6 |
| Pipelines (CI + CD + K8s deploy) | 1 | 🔄 Phase 5 |
| Delivery (repo + relatório) | 1 | ⏳ Phase 7 |
