# apps/telegram-bot/

Responsable: José

El bot que usa el administrador para hablar con el sistema en lenguaje
natural por Telegram, usando long polling (sin webhook). Aquí van los
comandos estructurados, el manejo del estado de una conversación mientras
faltan datos, y las confirmaciones explícitas antes de ejecutar una
operación sensible (cancelar, enviar correo, compartir archivo). El bot debe
poder responder con comandos estructurados aunque el modelo de NLU falle.
