# services/core-api/

Responsable: Simón

El dominio del negocio: motor de disponibilidad, autorización, reservas y el
registro de auditoría (`operacion_log`). Es la única pieza del sistema con
permiso para decidir y ejecutar — ni n8n ni el modelo de lenguaje toman
decisiones de negocio, todas pasan por aquí.
