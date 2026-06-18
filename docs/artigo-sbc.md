# Vigilantia SIEM: uma solução acadêmica DevSecOps para ingestão, análise e alerta de eventos de segurança

**Autores:** Guilherme Lobo, Nicolas Tosin, Lucas Aiolf Evangelista  
**Disciplina:** DevSecOps  
**Instituição:** PUCPR – Bacharelado em Cibersegurança  
**Repositório:** `twzin/vigilantia`  

> Documento formal em Markdown, estruturado de forma compatível com artigo acadêmico no padrão SBC. Para submissão em formato estritamente oficial, recomenda-se converter este conteúdo para o template LaTeX/Word da SBC e revisar autores, afiliação, e-mail e formatação final.

---

## Resumo

O Vigilantia SIEM é uma solução acadêmica de *Security Information and Event Management* desenvolvida com arquitetura de microsserviços e práticas de DevSecOps. O sistema centraliza a ingestão de eventos de segurança, realiza normalização e classificação automática de severidade, permite busca e filtragem de logs, disponibiliza dashboard operacional, gerencia regras de alerta e aplica autenticação e autorização com perfis distintos. A solução utiliza Frontend React, API Gateway em FastAPI, Auth Service, Parser Service, PostgreSQL, Elasticsearch e Filebeat. A implantação é documentada para Docker Compose e Kubernetes, incluindo Deployments, Services, StatefulSets, Secrets, SealedSecrets, NetworkPolicies, HorizontalPodAutoscaler e políticas de segurança de Pods. A pipeline de GitHub Actions contempla SAST, SCA, build e publicação de imagens Docker, além de etapa de implantação em ambiente Kubernetes com cluster kind. Este documento consolida os requisitos funcionais, não funcionais, de segurança, de arquitetura, de implantação e de pipeline, relacionando-os às principais evidências encontradas no repositório.

**Palavras-chave:** SIEM, DevSecOps, Kubernetes, STRIDE, GitHub Actions, Segurança de Aplicação.

---

## 1. Introdução

Aplicações modernas precisam coletar, correlacionar e analisar eventos de segurança para apoiar atividades de monitoramento, detecção e resposta. Um SIEM centraliza logs de diferentes fontes, permite consulta estruturada, geração de alertas e análise de comportamento, funcionando como componente relevante em ambientes de segurança operacional.

O projeto Vigilantia SIEM foi desenvolvido como uma solução acadêmica com foco em DevSecOps, segurança de aplicação, segurança de infraestrutura e implantação conteinerizada. O repositório descreve a solução como um sistema SIEM com arquitetura de microsserviços, pipeline de segurança automatizado, deploy em Docker Compose e Kubernetes.

Este documento tem como objetivo formalizar a documentação do projeto em estrutura compatível com artigo acadêmico no padrão SBC. O foco não é alterar a implementação, mas organizar os requisitos já descritos no repositório e relacioná-los às principais evidências de arquitetura, segurança, implantação e pipeline.

---

## 2. Descrição da solução proposta

A solução proposta é um SIEM acadêmico capaz de receber eventos de segurança por API e por syslog, armazenar logs em Elasticsearch, autenticar usuários, aplicar controle de acesso baseado em papéis, permitir buscas e filtros, exibir estatísticas operacionais e gerenciar regras de alerta.

O sistema é dividido em componentes especializados:

- **Frontend React:** interface web acessada por analistas e administradores.
- **API Gateway:** ponto único de entrada para as APIs internas, responsável por autenticação, validação de JWT, validação de API Key e rate limiting.
- **Auth Service:** serviço de autenticação, emissão de JWT, persistência de usuários e registro de auditoria.
- **Parser Service:** serviço de ingestão, normalização, busca, estatísticas, classificação de severidade e alertas.
- **PostgreSQL:** banco relacional para persistência de usuários.
- **Elasticsearch:** armazenamento e consulta de logs, alertas, regras e auditoria.
- **Filebeat:** coletor syslog para ingestão de eventos de dispositivos, sistemas operacionais ou serviços externos.

O projeto declara como funcionalidades centrais a ingestão via API Key, autenticação com JWT, busca e filtragem de logs, dashboard, configuração de alertas, gestão de usuários com roles, histórico de alertas, busca com regex e classificação automática de severidade.

---

## 3. Arquitetura da solução

A arquitetura documentada no `README.md` define uma separação entre rede externa e rede interna. O acesso do usuário ocorre por meio do Frontend e do API Gateway. Os serviços internos Auth Service, Parser Service, PostgreSQL e Elasticsearch não devem ser acessados diretamente a partir da rede externa.

### 3.1 Visão lógica

```text
[Dispositivos / OS] -- syslog UDP/TCP 5140 --> [Filebeat] --> [syslog-raw-*]
                                                              |
                                                              v
[Navegador] --> [Frontend React] --> [API Gateway] --> [Auth Service] --> [PostgreSQL]
                                      |
                                      +-------------> [Parser Service] --> [Elasticsearch]
```

### 3.2 Componentes arquiteturais

| Componente | Tecnologia | Responsabilidade | Evidência |
|---|---|---|---|
| Frontend | React 19, Vite, Nginx | Interface web e controle visual por perfil | `frontend/`, `k8s/frontend-deployment.yaml` |
| API Gateway | FastAPI, slowapi | Ponto único de entrada, proxy para serviços internos, JWT, API Key, rate limiting | `gateway/main.py` |
| Auth Service | FastAPI, PostgreSQL, SQLAlchemy, bcrypt, JWT | Login, emissão de token, usuários, papéis e auditoria | `auth/main.py` |
| Parser Service | FastAPI, Elasticsearch | Ingestão, busca, estatísticas, regex, severidade e alertas | `parser/main.py` |
| PostgreSQL | PostgreSQL 16 | Persistência dos usuários | `k8s/postgres-statefulset.yaml` |
| Elasticsearch | Elasticsearch 8.13.4 | Armazenamento de logs, alertas, regras e auditoria | `k8s/elasticsearch-statefulset.yaml` |
| Filebeat | Elastic Filebeat | Recebimento syslog e envio para índices brutos | `k8s/filebeat-deployment.yaml` |

### 3.3 Microsserviços e comunicação REST

A solução usa microsserviços. O API Gateway recebe as chamadas externas e encaminha as requisições para o Auth Service e o Parser Service por HTTP interno. A autenticação ocorre em `/login`; os endpoints protegidos exigem JWT válido; endpoints administrativos exigem role `admin`; a ingestão de logs por `/ingest` exige API Key no cabeçalho `X-API-Key`.

---

## 4. Requisitos funcionais

Os requisitos funcionais abaixo foram extraídos principalmente do `README.md` e verificados contra os serviços do repositório.

| ID | Descrição | Status | Evidência no repositório |
|---|---|---|---|
| RF01 | Ingestão de logs via API Key em `POST /ingest` | Implementado | `README.md`; `gateway/main.py`; `parser/main.py` |
| RF02 | Autenticação com usuário/senha e JWT | Implementado | `README.md`; `auth/main.py`; `gateway/main.py` |
| RF03 | Busca e filtragem de logs por texto, severidade, fonte, data e regex | Implementado | `README.md`; `parser/main.py`; `gateway/main.py` |
| RF04 | Dashboard com estatísticas de volume, distribuição por severidade e top fontes | Implementado | `README.md`; `parser/main.py`; `frontend/` |
| RF05 | Configuração de regras de alerta com threshold e janela de tempo | Implementado | `README.md`; `parser/main.py`; `gateway/main.py` |
| RF06 | Gestão de usuários com roles `admin` e `cliente` | Implementado | `README.md`; `auth/main.py`; `gateway/main.py`; `frontend/` |
| RF07 | Histórico de alertas com reconhecimento | Implementado | `README.md`; `parser/main.py`; `gateway/main.py` |
| RF08 | Envio de e-mail de alerta por SMTP | Implementado | `.env.example`; `parser/main.py`; `docker-compose.yml`; `k8s/configmap.yaml` |
| RF09 | Busca com expressões regulares | Implementado | `README.md`; `parser/main.py` |
| RF10 | Classificação automática de severidade em `CRITICAL`, `ERROR`, `WARNING` e `INFO` | Implementado | `README.md`; `parser/main.py` |

---

## 5. Requisitos não funcionais

| ID | Descrição | Status | Evidência no repositório |
|---|---|---|---|
| RNF01 | Validar desempenho do endpoint `/ingest` com teste de carga e p95 menor ou igual a 500 ms | Implementado | `README.md`; `tests/locustfile.py`; `k8s/hpa.yaml` |
| RNF02 | Usar `.env` e Kubernetes Secrets para credenciais e variáveis sensíveis | Implementado | `.env.example`; `k8s/sealed-secret.yaml`; deployments com `secretRef` |
| RNF03 | Manter audit log imutável/append-only no Elasticsearch | Implementado | `auth/main.py`; `docs/stride-analysis.md`; índice `vigilantia-audit` |
| RNF04 | Isolamento entre rede externa e rede interna | Implementado | `README.md`; `docs/stride-analysis.md`; `k8s/networkpolicy.yaml` |
| RNF05 | Escalabilidade do Parser em picos de ingestão | Implementado | `k8s/parser-deployment.yaml`; `k8s/hpa.yaml` |
| RNF06 | Disponibilidade dos serviços por probes de saúde | Implementado | `k8s/auth-deployment.yaml`; `k8s/parser-deployment.yaml`; `k8s/gateway-deployment.yaml`; `k8s/frontend-deployment.yaml` |


---

## 6. Tabela consolidada de requisitos

| ID | Tipo | Descrição | Status | Evidência no repositório |
|---|---|---|---|---|
| RF01 | Funcional | Ingestão de logs via API Key | Implementado | `gateway/main.py`, `parser/main.py` |
| RF02 | Funcional | Login com usuário/senha e geração de JWT | Implementado | `auth/main.py`, `gateway/main.py` |
| RF03 | Funcional | Busca e filtragem de logs | Implementado | `parser/main.py`, `gateway/main.py` |
| RF04 | Funcional | Dashboard com estatísticas | Implementado | `parser/main.py`, `frontend/` |
| RF05 | Funcional | Regras de alerta | Implementado | `parser/main.py`, `gateway/main.py` |
| RF06 | Funcional | Gestão de usuários e roles | Implementado | `auth/main.py`, `gateway/main.py` |
| RF07 | Funcional | Histórico e reconhecimento de alertas | Implementado | `parser/main.py`, `gateway/main.py` |
| RF08 | Funcional | Envio de e-mail de alerta por SMTP | Implementado | `parser/main.py`, `.env.example`, `docker-compose.yml`, `k8s/configmap.yaml` |
| RF09 | Funcional | Busca por regex | Implementado | `parser/main.py` |
| RF10 | Funcional | Classificação automática de severidade | Implementado | `parser/main.py` |
| RNF01 | Não funcional | Teste de carga p95 ≤ 500 ms | Implementado | `tests/locustfile.py`, `README.md`, `k8s/hpa.yaml` |
| RNF02 | Não funcional | Uso de `.env` e Secrets | Implementado | `.env.example`, `k8s/sealed-secret.yaml` |
| RNF03 | Não funcional | Audit log append-only | Implementado | `auth/main.py`, `docs/stride-analysis.md` |
| ARQ01 | Arquitetura | Microsserviços | Implementado | `README.md`, `docker-compose.yml`, `k8s/*.yaml` |
| ARQ02 | Arquitetura | API Gateway como ponto único de entrada | Implementado | `gateway/main.py`, `k8s/gateway-deployment.yaml` |
| ARQ03 | Arquitetura | Comunicação REST entre Gateway, Auth e Parser | Implementado | `gateway/main.py` |
| SEG01 | Segurança de aplicação | JWT validado no backend | Implementado | `gateway/main.py`, `auth/main.py` |
| SEG02 | Segurança de aplicação | RBAC com admin/cliente | Implementado | `gateway/main.py`, `auth/main.py`, `frontend/` |
| SEG03 | Segurança de aplicação | API Key para ingestão | Implementado | `gateway/main.py`, `.env.example` |
| SEG04 | Segurança de aplicação | Rate limiting anti-DoS | Implementado | `gateway/main.py` |
| SEG05 | Segurança de aplicação | bcrypt para senha | Implementado | `auth/main.py` |
| SEG06 | Segurança de aplicação | ORM parametrizado | Implementado | `auth/main.py` |
| SEG07 | Segurança de infraestrutura | Pod Security Admission restricted | Implementado | `k8s/namespace.yaml` |
| SEG08 | Segurança de infraestrutura | NetworkPolicies | Implementado | `k8s/networkpolicy.yaml` |
| SEG09 | Segurança de infraestrutura | SealedSecrets | Implementado | `k8s/sealed-secret.yaml` |
| SEG10 | Segurança de infraestrutura | SecurityContext nos serviços backend | Implementado | `k8s/auth-deployment.yaml`, `k8s/parser-deployment.yaml`, `k8s/gateway-deployment.yaml` |
| IMPL01 | Implantação | Docker Compose | Implementado | `docker-compose.yml`, `README.md` |
| IMPL02 | Implantação | Kubernetes Deployments | Implementado | `k8s/auth-deployment.yaml`, `k8s/parser-deployment.yaml`, `k8s/gateway-deployment.yaml`, `k8s/frontend-deployment.yaml`, `k8s/filebeat-deployment.yaml` |
| IMPL03 | Implantação | Kubernetes Services | Implementado | `k8s/*deployment.yaml`, `k8s/*statefulset.yaml` |
| IMPL04 | Implantação | StatefulSets para storage | Implementado | `k8s/postgres-statefulset.yaml`, `k8s/elasticsearch-statefulset.yaml` |
| IMPL05 | Implantação | HPA para escalabilidade | Implementado | `k8s/hpa.yaml` |
| PIPE01 | Pipeline | SAST com Bandit | Implementado | `.github/workflows/ci.yml` |
| PIPE02 | Pipeline | SCA com Trivy FS Scan | Implementado | `.github/workflows/ci.yml` |
| PIPE03 | Pipeline | Build e push de imagens Docker | Implementado | `.github/workflows/ci.yml` |
| PIPE04 | Pipeline | Deploy Kubernetes em cluster kind | Implementado | `.github/workflows/ci.yml` |

---

## 7. Modelo de ameaças

O projeto possui documentação específica de modelo de ameaças em `docs/stride-analysis.md`, utilizando a metodologia STRIDE. O documento define escopo, DFD, fronteiras de confiança, ativos críticos, ameaças por componente e controles implementados.

### 7.1 Ativos críticos

Os ativos críticos identificados incluem:

- `JWT_SECRET_KEY`, cujo comprometimento permitiria forjar tokens.
- `INGEST_API_KEY`, cuja exposição permitiria injetar logs falsos.
- `ELASTICSEARCH_PASSWORD`, que protege acesso aos logs e alertas.
- `POSTGRES_PASSWORD`, que protege a base de usuários.
- Índices `vigilantia-logs` e `vigilantia-audit`, relacionados a confidencialidade, integridade e rastreabilidade.

### 7.2 Ameaças STRIDE consideradas

| Categoria STRIDE | Exemplo no projeto | Mitigação documentada/implementada |
|---|---|---|
| Spoofing | Token JWT forjado ou API Key roubada | Verificação de assinatura JWT, expiração do token, API Key e rate limiting |
| Tampering | Alteração de role no token ou manipulação de busca | JWT assinado, ORM, validação de regex e uso controlado de queries |
| Repudiation | Ações administrativas sem rastreabilidade | Audit log em Elasticsearch |
| Information Disclosure | Exposição de hash de senha ou logs sensíveis | Respostas sem hash, endpoints protegidos por JWT e redes internas |
| Denial of Service | Flood em `/ingest` ou sobrecarga do Elasticsearch | Rate limiting, bulk indexing e HPA para Parser |
| Elevation of Privilege | Cliente tentando acessar `/admin/*` | RBAC no Gateway com `require_admin()` |

---

## 8. Segurança de aplicação

A segurança de aplicação está concentrada principalmente no API Gateway e no Auth Service.

### 8.1 JWT

O Auth Service gera tokens JWT contendo `sub`, `role` e expiração. O Gateway valida os tokens antes de permitir acesso aos endpoints protegidos. Tokens expirados ou inválidos resultam em erro 401.

**Evidências:** `auth/main.py`, `gateway/main.py`.

### 8.2 RBAC

O sistema possui dois papéis principais: `admin` e `cliente`. O Gateway aplica restrição para rotas administrativas por meio de verificação da role no JWT. O Frontend também possui proteção visual de rotas, mas a proteção principal ocorre no backend.

**Evidências:** `gateway/main.py`, `auth/main.py`, `frontend/`.

### 8.3 API Key para ingestão

A ingestão em `/ingest` exige o cabeçalho `X-API-Key`. O Gateway valida a chave antes de encaminhar a requisição ao Parser Service.

**Evidências:** `gateway/main.py`, `.env.example`.

### 8.4 Rate limiting

O Gateway utiliza `slowapi` para aplicar limite de requisições no endpoint de ingestão. Esse controle contribui para reduzir abuso de requisições e apoiar a mitigação de cenários de negação de serviço.

**Evidências:** `gateway/main.py`, `docs/stride-analysis.md`.

### 8.5 bcrypt e persistência segura de senhas

O Auth Service utiliza hash de senha com bcrypt. A tabela de usuários armazena `hashed_password`, e os endpoints de listagem retornam apenas `username`, `role` e `active`, sem expor o hash.

**Evidências:** `auth/main.py`.

### 8.6 ORM parametrizado

O Auth Service utiliza SQLAlchemy ORM para interação com PostgreSQL, evitando SQL bruto na gestão de usuários.

**Evidências:** `auth/main.py`.

### 8.7 Audit log

Operações administrativas de criação, atualização e remoção de usuários registram eventos em índice de auditoria no Elasticsearch. Esse mecanismo apoia rastreabilidade, investigação de ações administrativas e mitigação de cenários de repúdio.

**Evidências:** `auth/main.py`, `docs/stride-analysis.md`.

---

## 9. Segurança de infraestrutura

A segurança de infraestrutura foi considerada nos manifests Kubernetes e na documentação STRIDE.

### 9.1 Pod Security

O namespace `vigilantia` possui labels de Pod Security Admission com perfil `restricted` para `enforce` e `warn`.

**Evidência:** `k8s/namespace.yaml`.

### 9.2 Kubernetes Secrets e SealedSecrets

O projeto usa `SealedSecret` para versionar segredos criptografados no repositório. Os deployments consomem os segredos por `secretRef` ou `secretKeyRef`.

**Evidências:** `k8s/sealed-secret.yaml`, `k8s/auth-deployment.yaml`, `k8s/parser-deployment.yaml`, `k8s/gateway-deployment.yaml`, `k8s/postgres-statefulset.yaml`, `k8s/elasticsearch-statefulset.yaml`.

### 9.3 NetworkPolicies

A política de rede aplica `default-deny-all` no namespace e libera apenas fluxos necessários, como Frontend para Gateway, Gateway para Auth, Gateway para Parser, Auth para PostgreSQL e Auth/Parser/Filebeat para Elasticsearch.

**Evidência:** `k8s/networkpolicy.yaml`.

### 9.4 SecurityContext

Os manifests dos serviços backend incluem configurações de `SecurityContext` voltadas à redução de privilégios em tempo de execução, como `runAsNonRoot` e `runAsUser`. Em conjunto com as labels de Pod Security Admission no namespace, esses controles contribuem para o endurecimento da execução dos serviços no ambiente Kubernetes.

**Evidências:** `k8s/auth-deployment.yaml`, `k8s/parser-deployment.yaml`, `k8s/gateway-deployment.yaml`, `k8s/namespace.yaml`.

---

## 10. Implantação com Docker e Kubernetes

### 10.1 Docker Compose

O `README.md` descreve execução com Docker Compose, incluindo cópia do `.env.example`, subida do ambiente com `docker compose up -d`, acesso ao Frontend, API Gateway e documentação da API.

**Evidências:** `README.md`, `docker-compose.yml`.

### 10.2 Kubernetes

O repositório possui manifests Kubernetes para implantação dos componentes da solução:

| Recurso | Arquivo | Função |
|---|---|---|
| Namespace | `k8s/namespace.yaml` | Cria namespace `vigilantia` com Pod Security |
| ConfigMap | `k8s/configmap.yaml` | Centraliza variáveis não sensíveis |
| SealedSecret | `k8s/sealed-secret.yaml` | Mantém segredos criptografados no repositório |
| NetworkPolicy | `k8s/networkpolicy.yaml` | Aplica isolamento de rede |
| Auth Deployment + Service | `k8s/auth-deployment.yaml` | Implanta Auth Service |
| Parser Deployment + Service | `k8s/parser-deployment.yaml` | Implanta Parser Service |
| Gateway Deployment + Service | `k8s/gateway-deployment.yaml` | Implanta API Gateway e expõe NodePort |
| Frontend Deployment + Service | `k8s/frontend-deployment.yaml` | Implanta interface web e expõe NodePort |
| Filebeat Deployment + Service | `k8s/filebeat-deployment.yaml` | Recebe syslog UDP/TCP |
| PostgreSQL StatefulSet + Service | `k8s/postgres-statefulset.yaml` | Banco relacional persistente |
| Elasticsearch StatefulSet + Service | `k8s/elasticsearch-statefulset.yaml` | Armazenamento de logs e alertas |
| HPA | `k8s/hpa.yaml` | Escalabilidade horizontal do Parser |

### 10.3 Alta disponibilidade e escalabilidade

Gateway e Parser possuem múltiplas réplicas no Kubernetes. O Parser também possui HPA configurado com mínimo de 2 e máximo de 5 réplicas, escalando por CPU e memória. PostgreSQL e Elasticsearch são modelados como StatefulSets, apropriados para componentes com estado e persistência de dados no ambiente Kubernetes. A combinação de réplicas, probes, Services e HPA contribui para disponibilidade e escalabilidade da solução em ambiente acadêmico/laboratorial.

---

## 11. Pipeline CI/CD

A pipeline está definida em `.github/workflows/ci.yml` com o nome `Vigilantia DevSecOps CI/CD`. Ela é executada em push para `main` e `development`, e em pull requests para `main`.

### 11.1 Integração contínua

A integração contínua inclui:

- **SAST com Bandit:** analisa código Python nos diretórios `auth/`, `parser/` e `gateway/`.
- **SCA com Trivy FS Scan:** verifica vulnerabilidades em dependências e componentes do filesystem.

### 11.2 Entrega contínua

A entrega contínua é executada em eventos de push, após os jobs de segurança. Ela realiza login no GitHub Container Registry, configura Docker Buildx e faz build/push das imagens:

- `vigilantia-auth`
- `vigilantia-parser`
- `vigilantia-gateway`
- `vigilantia-frontend`

### 11.3 Implantação contínua

O workflow contempla uma etapa de implantação em ambiente Kubernetes por meio de um cluster kind criado no próprio runner do GitHub Actions. Essa etapa instala o controller de Sealed Secrets, aplica namespace e ConfigMap, cria um Secret com valores de CI, aplica os manifests presentes no diretório `k8s/` e lista os objetos criados no namespace `vigilantia`. Com isso, a pipeline valida a integração entre as imagens publicadas, os manifests Kubernetes e a infraestrutura declarada no projeto.

---

## 12. Testes e validação

O repositório possui teste de carga com Locust para validar o comportamento do endpoint `/ingest`, responsável pela ingestão de eventos de segurança. O arquivo `tests/locustfile.py` simula interações com a aplicação, incluindo autenticação, envio de logs, busca de eventos, consulta de estatísticas e verificação de alertas.

A validação de desempenho tem como objetivo observar a capacidade da solução de processar eventos de segurança em cenários de carga, considerando métricas como tempo de resposta e comportamento do serviço durante múltiplas requisições. O README documenta a execução do teste em modo headless e a geração de relatório HTML, permitindo registrar os resultados obtidos durante a validação.

---

## 13. Conclusão

O Vigilantia SIEM apresenta uma arquitetura coerente com os objetivos de um projeto acadêmico de DevSecOps e segurança para ambiente web. A solução implementa microsserviços, API Gateway, autenticação JWT, RBAC, ingestão por API Key, normalização de syslog, busca de logs, dashboard, regras de alerta, histórico de alertas, envio de e-mail por SMTP, Docker, Kubernetes, SealedSecrets, NetworkPolicies, HPA e pipeline com SAST, SCA, build/push de imagens e deploy Kubernetes em kind.

A documentação existente no README e no modelo STRIDE já contém boa parte dos elementos técnicos necessários. Este documento formaliza essas informações em uma estrutura compatível com artigo acadêmico no padrão SBC, consolidando requisitos e evidências.


---

## Referências

1. Repositório do projeto Vigilantia SIEM. Arquivos analisados: `README.md`, `docs/stride-analysis.md`, `.github/workflows/ci.yml`, `k8s/`, `auth/main.py`, `gateway/main.py`, `parser/main.py`, `tests/locustfile.py`.
2. SBC — Sociedade Brasileira de Computação. Modelo para publicação de artigos acadêmicos. Revisar formatação final conforme template oficial exigido pela disciplina.
3. OWASP Foundation. OWASP Top 10 Web Application Security Risks.
4. Microsoft. STRIDE Threat Modeling methodology.
5. Kubernetes Documentation. Deployments, Services, StatefulSets, Secrets, NetworkPolicies, HorizontalPodAutoscaler and Pod Security Admission.
6. GitHub Docs. GitHub Actions workflows and CI/CD automation.
7. Docker Documentation. Containers, Docker Compose and image build pipeline.
8. Elastic Documentation. Elasticsearch and Filebeat.
9. FastAPI Documentation. API development with Python.
