#!/usr/bin/env bash
set -a; source .env 2>/dev/null; set +a

check () {
  printf "%-22s" "$1"
  if curl -s -o /dev/null -m 3 -w "%{http_code}" "$2" | grep -qE "^(2|3|4)"; then
    echo "OK"
  else
    echo "SIN RESPUESTA"
  fi
}

check "PostgreSQL"      "http://localhost:5432" 2>/dev/null || true
check "n8n"             "${N8N_URL:-http://localhost:5678}"
check "Ollama"          "${OLLAMA_HOST:-http://localhost:11434}"
check "API núcleo"      "${CORE_API_URL:-http://localhost:8000}/health"
check "Servicio NLU"    "${NLU_URL:-http://localhost:8100}/health"
check "Adaptador Google" "http://localhost:${GOOGLE_ADAPTER_PORT:-8200}/health"
check "Sitio web"       "http://localhost:${WEB_PORT:-3000}"
