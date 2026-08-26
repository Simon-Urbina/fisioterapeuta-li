# services/nlu/

Responsable: José

El servicio que interpreta lenguaje natural: recibe el texto que escribe el
administrador en Telegram y devuelve una intención estructurada en JSON,
usando un modelo Ollama local. No tiene credenciales de nada ni ejecuta
acciones — solo interpreta y valida contra el esquema de `contracts/`.
