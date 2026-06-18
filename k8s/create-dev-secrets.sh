#!/usr/bin/env bash
# Cria o Secret do Kubernetes para desenvolvimento local a partir do .env.
# NÃO use em produção — lá o sealed-secret.yaml é gerado via kubeseal.
#
# Uso: bash k8s/create-dev-secrets.sh

set -euo pipefail

ENV_FILE="$(dirname "$0")/../.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERRO: arquivo .env não encontrado em $ENV_FILE"
  echo "Copie .env.example para .env e preencha os valores."
  exit 1
fi

# Carrega o .env ignorando comentários e linhas vazias
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ "$line" =~ ^\s*# ]] && continue
  [[ -z "${line//[[:space:]]/}" ]] && continue
  if [[ "$line" =~ ^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*) ]]; then
    key="${BASH_REMATCH[1]}"
    value="${BASH_REMATCH[2]}"
    value="${value%\"}" ; value="${value#\"}"
    value="${value%\'}" ; value="${value#\'}"
    export "$key=$value"
  fi
done < "$ENV_FILE"

required_vars=(
  POSTGRES_PASSWORD
  JWT_SECRET_KEY
  ELASTICSEARCH_PASSWORD
  INGEST_API_KEY
  DATABASE_URL
  SMTP_PASSWORD
  ADMIN_DEFAULT_PASSWORD
  CLIENT_DEFAULT_PASSWORD
)

missing=()
for var in "${required_vars[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    missing+=("$var")
  fi
done

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "ERRO: as seguintes variáveis estão ausentes ou vazias no .env:"
  printf '  - %s\n' "${missing[@]}"
  exit 1
fi

NAMESPACE="${NAMESPACE:-vigilantia}"

# Remove secret anterior se existir (evita erro de "already exists")
kubectl delete secret vigilantia-secrets -n "$NAMESPACE" --ignore-not-found

kubectl create secret generic vigilantia-secrets \
  --namespace="$NAMESPACE" \
  --from-literal=POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
  --from-literal=JWT_SECRET_KEY="$JWT_SECRET_KEY" \
  --from-literal=ELASTICSEARCH_PASSWORD="$ELASTICSEARCH_PASSWORD" \
  --from-literal=INGEST_API_KEY="$INGEST_API_KEY" \
  --from-literal=DATABASE_URL="$DATABASE_URL" \
  --from-literal=SMTP_PASSWORD="$SMTP_PASSWORD" \
  --from-literal=ADMIN_DEFAULT_PASSWORD="$ADMIN_DEFAULT_PASSWORD" \
  --from-literal=CLIENT_DEFAULT_PASSWORD="$CLIENT_DEFAULT_PASSWORD"

echo "Secret 'vigilantia-secrets' criado no namespace '$NAMESPACE'."
