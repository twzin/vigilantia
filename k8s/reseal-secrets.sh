#!/usr/bin/env bash
# Instala o Sealed Secrets controller no cluster atual e re-gera
# k8s/sealed-secret.yaml a partir do .env.
#
# Pré-requisitos: kubectl configurado, kubeseal instalado
#   Linux:   curl -sSL https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.27.3/kubeseal-0.27.3-linux-amd64.tar.gz | tar -xz && sudo mv kubeseal /usr/local/bin/
#   macOS:   brew install kubeseal
#
# Uso: bash k8s/reseal-secrets.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"
OUTPUT="$SCRIPT_DIR/sealed-secret.yaml"
NAMESPACE="vigilantia"
CONTROLLER_VERSION="v0.27.3"

# ── 1. Instala o controller se ainda não existir ──────────────────────────────
if ! kubectl get deployment sealed-secrets-controller -n kube-system &>/dev/null; then
  echo "→ Instalando Sealed Secrets controller $CONTROLLER_VERSION..."
  kubectl apply -f "https://github.com/bitnami-labs/sealed-secrets/releases/download/$CONTROLLER_VERSION/controller.yaml"
fi

echo "→ Aguardando controller ficar pronto..."
kubectl wait --for=condition=available deployment/sealed-secrets-controller \
  -n kube-system --timeout=90s

# ── 2. Lê o .env sem executar código shell ────────────────────────────────────
if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERRO: arquivo .env não encontrado em $ENV_FILE"
  exit 1
fi

declare -A env_vars
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ "$line" =~ ^\s*# ]] && continue
  [[ -z "${line//[[:space:]]/}" ]] && continue
  if [[ "$line" =~ ^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*) ]]; then
    key="${BASH_REMATCH[1]}"
    value="${BASH_REMATCH[2]}"
    value="${value%\"}" ; value="${value#\"}"
    value="${value%\'}" ; value="${value#\'}"
    env_vars["$key"]="$value"
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
  [[ -z "${env_vars[$var]:-}" ]] && missing+=("$var")
done

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "ERRO: variáveis ausentes ou vazias no .env:"
  printf '  - %s\n' "${missing[@]}"
  exit 1
fi

# ── 3. Gera Secret temporário e sela com kubeseal ────────────────────────────
echo "→ Gerando sealed-secret.yaml para namespace '$NAMESPACE'..."

kubectl create secret generic vigilantia-secrets \
  --namespace="$NAMESPACE" \
  --from-literal=POSTGRES_PASSWORD="${env_vars[POSTGRES_PASSWORD]}" \
  --from-literal=JWT_SECRET_KEY="${env_vars[JWT_SECRET_KEY]}" \
  --from-literal=ELASTICSEARCH_PASSWORD="${env_vars[ELASTICSEARCH_PASSWORD]}" \
  --from-literal=INGEST_API_KEY="${env_vars[INGEST_API_KEY]}" \
  --from-literal=DATABASE_URL="${env_vars[DATABASE_URL]}" \
  --from-literal=SMTP_PASSWORD="${env_vars[SMTP_PASSWORD]}" \
  --from-literal=ADMIN_DEFAULT_PASSWORD="${env_vars[ADMIN_DEFAULT_PASSWORD]}" \
  --from-literal=CLIENT_DEFAULT_PASSWORD="${env_vars[CLIENT_DEFAULT_PASSWORD]}" \
  --dry-run=client -o yaml \
  | kubeseal \
      --controller-namespace kube-system \
      --controller-name sealed-secrets-controller \
      --format yaml \
  > "$OUTPUT"

echo "✓ sealed-secret.yaml gerado em: $OUTPUT"
echo "  Agora rode: kubectl apply -f k8s/sealed-secret.yaml"
