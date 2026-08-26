#!/usr/bin/env bash
# Exporta los workflows SIN credenciales para versionarlos en el repositorio.
set -e
docker exec fisio-n8n n8n export:workflow --all --separate --output=/workflows
echo "Workflows exportados a automation/n8n/workflows/"
echo "Revisa que ningún archivo contenga tokens antes de hacer commit."
