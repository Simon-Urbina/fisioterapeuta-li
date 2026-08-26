# db/migrations/

Responsable: Simón

Los scripts SQL que crean el esquema, en orden, incluyendo la restricción
que impide que dos reservas se crucen sobre el mismo recurso. Esa protección
vive en la base de datos, no en el código de aplicación, porque es la única
forma confiable de evitar dobles reservas cuando el sitio web y Telegram
escriben al mismo tiempo.
