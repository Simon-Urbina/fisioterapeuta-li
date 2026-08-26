# automation/n8n/

Responsable: Valentina

Los flujos de n8n que mueven datos y disparan acciones después de que algo
ya fue decidido por la API núcleo: correo de confirmación, registro en
Sheets, avisos por Telegram y recordatorios programados. n8n no contiene
reglas de negocio — si un nodo necesita decidir algo, esa lógica pertenece a
`services/core-api/`. Los workflows solo existen en la máquina donde se
crean hasta que se exportan a `workflows/` y se suben con
`scripts/exportar-n8n.sh`.
