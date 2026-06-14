# Análise de Ameaças STRIDE — Vigilantia SIEM

## 1. Escopo

Sistema: Vigilantia SIEM  
Versão: Phase 3  
Data: 2026-06  
Metodologia: STRIDE (Microsoft Threat Modeling)

---

## 2. Diagrama de Fluxo de Dados

```
[Filebeat / Cliente]
        │ HTTPS  X-API-Key
        ▼
  ┌─────────────┐      JWT      ┌──────────────┐
  │  API Gateway│◄─────────────►│  Auth Service│──► PostgreSQL
  │  (porta 8000)│              │  (porta 8001) │
  └──────┬──────┘              └──────────────┘
         │ HTTP interno
         ▼
  ┌──────────────┐
  │Parser Service│──► Elasticsearch (vigilantia-logs)
  │ (porta 8002) │──► Elasticsearch (vigilantia-alerts)
  └──────────────┘──► Elasticsearch (vigilantia-audit)

[Navegador]
    │ HTTP
    ▼
[Frontend React]──► [API Gateway]
```

**Fronteiras de confiança:**
- Rede externa (`vigilantia-external`): gateway + frontend acessíveis pelo usuário
- Rede interna (`vigilantia-internal`): auth, parser, Elasticsearch, PostgreSQL — inacessíveis externamente

---

## 3. Ativos e Nível de Criticidade

| Ativo | Criticidade | Descrição |
|---|---|---|
| JWT_SECRET_KEY | CRÍTICO | Comprometimento permite forjar qualquer token |
| INGEST_API_KEY | ALTO | Permite injetar dados falsos no SIEM |
| ELASTICSEARCH_PASSWORD | ALTO | Acesso direto a todos os logs |
| POSTGRES_PASSWORD | ALTO | Acesso à base de usuários |
| Índice `vigilantia-logs` | MÉDIO | Confidencialidade dos eventos monitorados |
| Índice `vigilantia-audit` | MÉDIO | Integridade do log imutável |

---

## 4. Análise STRIDE por Componente

### 4.1 API Gateway

| Categoria | Ameaça | Mitigação Implementada | Status |
|---|---|---|---|
| **S**poofing | Requisição com API Key roubada para /ingest | Rate limiting (slowapi: 100 req/min) + rotação periódica da key | ✅ Parcial |
| **S**poofing | Token JWT forjado para acessar endpoints protegidos | Verificação de assinatura HS256 com `SECRET_KEY`; tokens expiram em 60 min | ✅ |
| **T**ampering | Modificação do body em trânsito (MITM) | TLS deve ser terminado no load balancer (K8s Ingress); internamente HTTP | ⚠️ Phase 6 |
| **R**epudiation | Ações administrativas sem rastreamento | Audit log imutável no Elasticsearch via `write_audit()` | ✅ |
| **I**nformation Disclosure | Stack traces expostos em erros 500 | FastAPI retorna mensagens genéricas; detalhe interno não vaza | ✅ |
| **D**enial of Service | Flood de requisições em /ingest | Rate limiting 100/min por IP no gateway | ✅ Parcial |
| **E**levation of Privilege | Cliente acessa endpoints `/admin/*` | `require_admin()` verifica `role` dentro do JWT antes de qualquer proxy | ✅ |

### 4.2 Auth Service

| Categoria | Ameaça | Mitigação Implementada | Status |
|---|---|---|---|
| **S**poofing | Brute-force de senha no /login | Rate limiting herdado do gateway; bcrypt com fator de custo alto | ✅ Parcial |
| **T**ampering | Alteração de `role` no token JWT | JWT assinado com HMAC-SHA256; qualquer alteração invalida a assinatura | ✅ |
| **T**ampering | SQL Injection no cadastro de usuários | SQLAlchemy ORM com parâmetros vinculados; nunca SQL raw | ✅ |
| **R**epudiation | Criação/exclusão de usuário sem evidência | `write_audit()` registra toda operação CRUD de usuários | ✅ |
| **I**nformation Disclosure | Hash de senha exposto na API | Endpoint `/admin/users` retorna apenas `username`, `role`, `active` — nunca o hash | ✅ |
| **D**enial of Service | Exaustão de conexões PostgreSQL | SQLAlchemy connection pool com limite padrão (5 conexões) | ✅ |
| **E**levation of Privilege | Acesso direto à porta 8001 sem JWT | Porta 8001 na rede `vigilantia-internal`; somente gateway alcança | ✅ |

### 4.3 Parser Service

| Categoria | Ameaça | Mitigação Implementada | Status |
|---|---|---|---|
| **S**poofing | Log injection — mensagem forjada para poluir índice | Gateway valida API Key antes de repassar; payload sanitizado no parser | ✅ Parcial |
| **T**ampering | Modificação de regras de alerta por não-admin | Endpoint `/admin/alert-rules` exige role=admin no gateway | ✅ |
| **T**ampering | Injection em campos de busca (Elasticsearch query injection) | Parâmetros de busca tratados com `Q()` do elasticsearch-py; regex validado | ✅ Parcial |
| **R**epudiation | Alerta disparado sem registro rastreável | Cada alerta salvo no índice `vigilantia-alerts` com timestamp e rule_id | ✅ |
| **I**nformation Disclosure | Logs sensíveis expostos para role=cliente | Todos os endpoints de busca exigem JWT; cliente vê os mesmos logs que admin | ⚠️ Sem RBAC por severidade |
| **D**enial of Service | Ingestão massiva sobrecarrega Elasticsearch | Bulk indexing; rate limiting no gateway (100/min) | ✅ Parcial |
| **E**levation of Privilege | Acesso direto à porta 8002 | Porta 8002 na rede interna; inacessível externamente | ✅ |

### 4.4 Elasticsearch

| Categoria | Ameaça | Mitigação Implementada | Status |
|---|---|---|---|
| **S**poofing | Acesso sem autenticação ao Elasticsearch | `xpack.security.enabled=true`; credenciais em variável de ambiente | ✅ |
| **T**ampering | Exclusão ou alteração de logs de auditoria | Índice `vigilantia-audit` somente via append (sem endpoint de delete exposto) | ✅ |
| **I**nformation Disclosure | Porta 9200 acessível externamente | Elasticsearch na rede `vigilantia-internal`; sem porta mapeada no host | ✅ |
| **D**enial of Service | Índice com crescimento ilimitado | ILM (Index Lifecycle Management) não configurado ainda | ⚠️ Phase 6 |

### 4.5 Frontend

| Categoria | Ameaça | Mitigação Implementada | Status |
|---|---|---|---|
| **S**poofing | XSS para roubo de token JWT do localStorage | React escapa HTML por padrão; `dangerouslySetInnerHTML` não utilizado | ✅ |
| **I**nformation Disclosure | Token JWT visível no localStorage (vs. HttpOnly cookie) | Aceitável para projeto acadêmico; produção deveria usar HttpOnly cookie | ⚠️ Aceitável |
| **E**levation of Privilege | URL admin acessada por role=cliente | `ProtectedRoute` com `requiredRole="admin"` redireciona para /dashboard | ✅ |

---

## 5. Riscos Residuais

| Risco | Probabilidade | Impacto | Ação Recomendada |
|---|---|---|---|
| Brute-force sem bloqueio de conta | Média | Alto | Adicionar lockout após 5 tentativas falhas |
| JWT sem revogação | Baixa | Médio | Implementar token blocklist no Redis (pós-acadêmico) |
| TLS apenas no load balancer | Média | Médio | Configurar TLS no Ingress K8s (Phase 6) |
| RBAC sem distinção por severidade de log | Baixa | Baixo | Filtrar CRITICAL/ERROR para role=admin apenas |
| Sem ILM no Elasticsearch | Alta | Baixo | Configurar retenção automática de 90 dias |

---

## 6. Controles de Segurança Implementados (Resumo)

| Controle | Onde | STRIDE coberto |
|---|---|---|
| Autenticação JWT HS256 | Gateway + Auth | Spoofing, EoP |
| RBAC (admin/cliente) | Gateway + Frontend | EoP |
| API Key para ingestão | Gateway | Spoofing |
| Rate limiting (100/min) | Gateway | DoS |
| bcrypt para senhas | Auth | Spoofing |
| ORM parametrizado | Auth | Tampering |
| Audit log imutável | Auth → Elasticsearch | Repudiation |
| Rede interna isolada | Docker / K8s | ID, Spoofing |
| SAST (Bandit) | CI/CD | Tampering |
| SCA (Trivy) | CI/CD | Tampering |
| Secrets em .env / K8s Secrets | Infra | ID |
