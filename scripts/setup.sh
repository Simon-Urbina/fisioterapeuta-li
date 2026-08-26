#!/usr/bin/env bash
set -e

echo "==> Verificando requisitos"
command -v docker  >/dev/null || { echo "Falta Docker"; exit 1; }
command -v node    >/dev/null || { echo "Falta Node.js 20"; exit 1; }
command -v ollama  >/dev/null || { echo "Falta Ollama"; exit 1; }

[ -f .env ] || { echo "Falta el archivo .env. Copia .env.example y complétalo."; exit 1; }
set -a; source .env; set +a

echo "==> Levantando PostgreSQL y n8n"
docker compose up -d

echo "==> Descargando el modelo ${OLLAMA_MODEL}"
ollama pull "${OLLAMA_MODEL}"

echo "==> Cargando datos de prueba"
sleep 5
docker exec -i fisio-postgres psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" < db/seeds/datos_prueba.sql || true

echo ""
echo "Listo. n8n en ${N8N_URL}"
echo "Ahora levanta manualmente: core-api (8000), nlu (8100), google-adapter (8200), web (3000) y el bot."
