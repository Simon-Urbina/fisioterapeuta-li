# Base de datos — La Fisioterapeuta Li

Documentación del modelo de datos, sus invariantes y la forma en que n8n y Google Workspace se conectan a él.

Motor: PostgreSQL 16. Zona horaria de negocio: `America/Bogota`. Todas las marcas de tiempo se almacenan como `timestamptz`, es decir, en UTC con conversión en el borde. Ninguna columna guarda una hora local suelta.

---

## 1. Las cinco decisiones que explican todo lo demás

Antes de las tablas conviene entender las reglas de las que se derivan. Casi cualquier duda sobre "por qué está modelado así" se resuelve con alguna de estas cinco.

**PostgreSQL es la única fuente de verdad.** Google Calendar, Sheets y Drive son espejos de lectura. El sistema escribe hacia Google, nunca lee de Google para decidir. Si el calendario está caído, la cita ya existe y es válida; el espejo se pone al día cuando el servicio vuelva. La consecuencia práctica es que ningún workflow de n8n consulta Calendar para saber si un horario está libre: pregunta a la base de datos.

**El precio nunca se lee del catálogo al facturar.** El catálogo de tarifas cambia, pero una compra hecha hoy conserva para siempre lo que se pactó. Por eso `catalogo.tarifa` tiene vigencia por rango de fechas y `comercial.compra` guarda una copia congelada del nombre, las sesiones y el valor. La referencia a la tarifa original permanece para trazabilidad, pero no se usa para recalcular nada.

**Los estados clínicos y los saldos no se almacenan, se derivan.** "Taquicardia", "HTA Etapa 1" y "Sobrepeso" son funciones de números que ya están guardados; si se almacenara el texto, tarde o temprano quedaría una fila con frecuencia cardíaca de 55 etiquetada como taquicardia. Lo mismo aplica a las sesiones restantes de un paquete y al contador de referidos: un contador mutable siempre termina desincronizado. Todo eso vive en vistas.

**El doble agendamiento se impide en el motor, no en la aplicación.** La restricción `EXCLUDE USING gist` sobre `agenda.reserva` se evalúa dentro de la transacción. Si Telegram y la web piden el mismo horario en el mismo milisegundo, uno de los dos recibe un error y es físicamente imposible que queden dos citas encima. Esta garantía no depende de que el código esté bien escrito.

**El modelo de IA no tiene credenciales.** No existe un rol `fisio_ia` en el schema. El modelo produce JSON estructurado que queda registrado en `integracion.propuesta_ia`, y sólo una función del núcleo puede convertirlo en una reserva real. Todo lo que el modelo propuso queda archivado, incluso lo rechazado, porque sin ese registro no hay forma de auditar por qué el bot ofreció un horario imposible.

---

## 2. Los seis dominios

La separación por esquemas de PostgreSQL no es cosmética: es la unidad de permisos. El rol que usa n8n jamás recibe acceso a `clinico`.

**`catalogo`** contiene los datos maestros que Lina debe poder editar sin que nadie ejecute una migración. Aquí viven las sedes, el portafolio de servicios con sus duraciones y sus tiempos de preparación, las tarifas con vigencia, y todos los desplegables de la ficha del paciente: EPS, ciudades, ocupaciones, antecedentes, tipos de dolor, medios de pago. También está `catalogo.parametro`, donde se guardan las reglas numéricas ajustables como la ventana de cancelación o el abono mínimo de convenios.

La distinción entre servicio y tarifa es la que más se malinterpreta. Un servicio es "Punción Seca": tiene duración, técnicas y contraindicaciones. Una tarifa es "Punción Seca, 10 sesiones, $950.000, vigente desde enero". Un servicio tiene muchas tarifas a lo largo del tiempo, y el valor por sesión no se guarda nunca porque es una división que hace la vista `catalogo.v_tarifa_vigente`.

En los planes grupales el valor es por persona, tal como está expresado en el material de la clienta. `cupo_personas` indica cuánta gente cabe en la sesión, no divide el precio.

**`personas`** guarda pacientes, profesionales, contactos de emergencia, consentimientos y la vinculación con Telegram. El referido es una autorreferencia dentro de `paciente`, más un campo de texto libre para cuando el paciente menciona un nombre que todavía no se puede resolver a un registro. La edad no es columna: es un cálculo en `personas.v_paciente`.

`personas.vinculo_telegram` merece atención porque es la frontera de identidad del sistema. El `chat_id` es la identidad del canal; el paciente es la identidad del negocio. Un chat sin paciente vinculado es un desconocido y puede consultar el catálogo, pero no puede ver ni agendar nada a nombre de nadie.

**`agenda`** es el corazón. Todo lo que ocupa tiempo vive en una sola tabla física, `agenda.reserva`, diferenciado por una columna `tipo`: citas, bloqueos por vacaciones o festivos, y eventos de convenio con clubes. La razón de no separarlos es que la restricción de exclusión sólo puede operar dentro de una tabla; si los bloqueos vivieran aparte, harían falta triggers cruzados y el invariante dejaría de ser una garantía del motor para volverse código que puede fallar.

**`comercial`** cubre compras, pagos, convenios y beneficios. Las sesiones sueltas también se registran como compras con una sola sesión incluida, de modo que el consumo tenga un único mecanismo en todo el sistema. La valoración gratuita no se modela como una tarifa de cero pesos, porque eso ensuciaría los reportes de ingresos con servicios que nunca costaron nada: se modela como un derecho que se otorga y se redime.

**`clinico`** contiene la anamnesis, los antecedentes, los signos vitales, la evaluación del dolor y las evoluciones. Es append-only y está protegido por triggers que bloquean `UPDATE` y `DELETE`. Una evolución no se edita: se corrige insertando un registro nuevo con `anula_a_id` apuntando al anterior y un motivo de corrección obligatorio. Esto tiene valor legal y no es negociable.

**`integracion`** es donde vive el desacople con Google. Contiene el outbox transaccional, el mapa de recursos de Workspace, el registro forense de la IA, el historial de mensajes por canal, las notificaciones y la bitácora de ejecuciones de n8n.

---

## 3. Las dos franjas de tiempo

Esta es la sutileza más importante del modelo de agenda y conviene tenerla clara antes de tocar n8n.

Cada reserva tiene dos rangos. La **franja clínica** es el tiempo que el paciente está efectivamente en terapia: es lo que se le comunica al paciente y lo que se muestra en la web. La **franja de bloqueo** la contiene e incluye la preparación previa y posterior: desinfectar la camilla, cambiar sábanas, guardar equipo y registrar notas.

La restricción de exclusión opera sobre la **segunda**. Comparar sólo la hora clínica permitiría agendar dos pacientes espalda contra espalda sin margen de desinfección, que es un error que en la práctica se paga con retrasos en cadena durante todo el día. El buffer se define por servicio en `catalogo.servicio.buffer_posterior_minutos`, porque no toma el mismo tiempo recoger después de una descarga de espalda que después de una sueroterapia.

Los estados que ocupan la franja son `pendiente_pago`, `confirmada`, `en_curso`, `atendida`, `no_asistio` y `cancelada_tarde`. Los tres últimos siguen ocupando históricamente porque la política de la clienta dice que si el paciente no asiste o cancela fuera de plazo, la cita se da por realizada. Eso significa que también descuentan sesión del paquete. Las canceladas a tiempo, las expiradas, las rechazadas y las propuestas de la IA no ocupan nada y liberan el cupo de inmediato.

El horario de atención se modela como franjas por sede y día de la semana. La hora de almuerzo no es un campo ni una regla especial: es sencillamente el hueco entre la franja de 7:00 a 12:00 y la de 14:00 a 20:00. Que Tunja atienda entre semana y Turmequé los fines de semana queda expresado en filas, no en código.

---

## 4. Cómo se conecta n8n

La regla es que n8n no contiene lógica de negocio. Todos los workflows hacen lo mismo: leen una vista o invocan una función, y transportan el resultado. Si un workflow tiene un nodo `IF` que decide si una cita se puede agendar, algo se modeló mal.

n8n se conecta con el rol `fisio_n8n`, que no tiene permiso de `INSERT` ni `UPDATE` sobre `agenda.reserva`. Puede leer vistas, ejecutar las funciones autorizadas y operar el outbox. Esta restricción es deliberada: obliga a que toda escritura pase por las funciones donde vive la validación.

### Workflow 1 — Consulta de disponibilidad

Se dispara desde el bot cuando el paciente pregunta por horarios. El nodo de Postgres ejecuta una sola consulta y el resultado se le entrega al modelo como lista cerrada de opciones.

```sql
SELECT slot_inicio, slot_fin
FROM agenda.slots_disponibles(
    $1::smallint,   -- servicio_id
    $2::smallint,   -- sede_id
    $3::date        -- fecha solicitada
)
LIMIT 12;
```

El modelo de IA nunca inventa un horario. Recibe esta lista y elige de ella. La función ya descontó el tiempo de preparación entre pacientes, ya respetó la franja de almuerzo y ya excluyó los horarios pasados, así que cualquier elemento de la lista es agendable en ese momento.

### Workflow 2 — Creación de la reserva

```sql
SELECT agenda.crear_reserva(
    $1::bigint,               -- paciente_id
    $2::smallint,             -- servicio_id
    $3::smallint,             -- sede_id
    $4::timestamptz,          -- inicio elegido
    'telegram'::agenda.canal_origen,
    $5::bigint,               -- compra_id, o NULL si paga la sesión suelta
    NULL, NULL,               -- duración y profesional por defecto
    $6::text                  -- quién lo creó, para trazabilidad
) AS reserva_id;
```

La función valida que el paciente exista, que la duración esté dentro del rango del servicio, que el horario caiga dentro de la atención de esa sede ese día, y que el paquete tenga saldo y pertenezca a ese paciente. Si el cupo ya fue tomado devuelve el error `unique_violation` con un mensaje legible que el bot puede repetir tal cual al paciente.

El workflow debe capturar ese error específico y reaccionar reconsultando la disponibilidad, no reintentando la misma reserva. Es la única condición de carrera real del sistema y el diseño la contempla.

Cuando la reserva se crea con un paquete pagado nace en estado `confirmada`. Cuando no, nace en `pendiente_pago` reteniendo el cupo durante los minutos que indique el parámetro `minutos_retencion_reserva`.

### Workflow 3 — Sincronización con Google Calendar

Este es el patrón outbox y es el que hace que el sistema tolere caídas de Google. Cuando una reserva cambia de estado, un trigger escribe un evento en `integracion.outbox` **dentro de la misma transacción**. Esto garantiza que no pueda existir una cita confirmada sin su intento de sincronización, ni una llamada a Google por una cita que al final falló.

El workflow corre cada minuto con un Schedule Trigger y hace tres pasos.

Primero toma trabajo de forma atómica. La función usa `FOR UPDATE SKIP LOCKED`, de modo que dos ejecuciones concurrentes del workflow nunca empujan el mismo evento dos veces:

```sql
SELECT * FROM integracion.tomar_pendientes(20);
```

Segundo, para cada evento consulta el payload listo para el nodo de Google Calendar. La vista ya compone el título, la descripción y el calendario destino:

```sql
SELECT calendar_id, google_event_id, titulo, descripcion,
       ubicacion, inicia_en, termina_en, zona_horaria
FROM integracion.v_calendar_evento
WHERE reserva_id = $1;
```

Si `google_event_id` viene nulo, el nodo crea el evento; si trae valor, lo actualiza. Cuando la acción del payload es `eliminar`, se borra del calendario.

Tercero, informa el resultado de vuelta:

```sql
-- Éxito
SELECT integracion.confirmar_sincronizacion(
    $1::bigint, 'reserva', $2::bigint, 'calendar'::integracion.servicio_google,
    $3::text, $4::text, $5::text, $6::text);

-- Fallo
SELECT integracion.registrar_fallo($1::bigint, $2::text);
```

`registrar_fallo` aplica retroceso exponencial: dos, cuatro, ocho, dieciséis y treinta y dos minutos. Después de cinco intentos el evento pasa a `descartado` y queda visible para revisión manual. Esto evita que un error permanente, como un calendario borrado, consuma la cuota de la API en reintentos infinitos.

Una nota de privacidad que no debe perderse: el evento de Calendar es visible en el Workspace y en el teléfono de Lina, así que la vista deliberadamente no incluye diagnóstico, antecedentes ni escala de dolor. Sólo lleva servicio, nombre, sede y una referencia. La información clínica no sale de PostgreSQL.

### Workflow 4 — Volcado a Google Sheets

Tres vistas planas están listas para escribirse directamente en pestañas de una hoja de cálculo, sin transformación intermedia. `integracion.v_sheet_agenda` para la operación diaria, `integracion.v_sheet_ingresos` para el resumen financiero y `integracion.v_sheet_paquetes` para los paquetes con saldo, que es lo que Lina revisa a diario.

Las tres ya vienen con las fechas convertidas a hora de Bogotá y formateadas como texto, porque Sheets interpreta mal los `timestamptz` crudos. Ninguna incluye datos clínicos.

El workflow es un Schedule Trigger, un nodo Postgres por pestaña y un nodo de Google Sheets en modo *clear and append*. Se recomienda correrlo cada hora en horario laboral y no en tiempo real: la hoja es un reporte, no una interfaz operativa.

### Workflow 5 — Recordatorios por Gmail

`integracion.notificacion` funciona como cola. El workflow lee las pendientes cuya hora programada ya llegó, envía por Gmail y marca el resultado guardando el `gmail_message_id`. Las plantillas incluyen la confirmación de la cita, el recordatorio a veinticuatro horas y las indicaciones previas del servicio, que salen de `catalogo.servicio.indicaciones_previas` y por lo tanto se mantienen actualizadas sin tocar el workflow.

```sql
SELECT id, destinatario, asunto, cuerpo, plantilla
FROM integracion.notificacion
WHERE estado = 'pendiente' AND programada_para <= now()
ORDER BY programada_para
LIMIT 50;
```

### Workflow 6 — Mantenimiento

Un Schedule Trigger cada cinco minutos que libera los cupos que nunca se pagaron:

```sql
SELECT agenda.expirar_reservas_vencidas();
```

---

## 5. El papel del modelo de IA

El modelo local de Ollama recibe el mensaje del paciente y produce JSON estructurado. Ese JSON se registra en `integracion.propuesta_ia` junto con el modelo usado, la confianza y el mensaje original, y luego un nodo de código valida la estructura antes de que nada llegue a la base de datos.

La validación no es opcional. El modelo puede alucinar un `servicio_id` que no existe, una fecha en el pasado o un paciente que no es el del chat. Las funciones del núcleo rechazan todo eso, pero es mejor detectarlo antes y responderle al paciente con una repregunta que dejar que el error suba desde PostgreSQL.

Los procedimientos que requieren consentimiento informado (punción seca, terapia neural, PRP y sueroterapia) deberían marcarse con `requiere_revision_humana` para que Lina confirme antes de que el agendamiento se cierre. La bandera ya existe en la tabla; queda decidir la política exacta con la clienta.

---

## 6. Roles y permisos

Cuatro roles, cada uno con el mínimo privilegio necesario.

`fisio_core` es la API central y tiene lectura y escritura completa sobre todos los esquemas. Es el único que toca `clinico`.

`fisio_n8n` lee el catálogo y las vistas, ejecuta las funciones autorizadas y opera el outbox. No puede escribir sobre reservas ni ver nada clínico.

`fisio_web` accede al catálogo, la disponibilidad y las funciones de reserva y cancelación. Puede insertar pacientes y consentimientos. Cero acceso clínico.

`fisio_reportes` sólo ve las tres vistas planas de Sheets, que ya vienen despojadas de información sensible.

No existe un rol para el modelo de IA. Es intencional.

Antes de desplegar hay que asignar contraseñas y permiso de conexión a los roles, que en el schema se crean como `NOLOGIN`:

```sql
ALTER ROLE fisio_n8n LOGIN PASSWORD '...';
GRANT CONNECT ON DATABASE fisio_li TO fisio_n8n;
```

---

## 7. Puesta en marcha

El orden importa. `schema.sql` crea extensiones, esquemas, roles, tablas, vistas, funciones, triggers y permisos. `seed.sql` carga el catálogo real de la clienta y es idempotente, así que puede correrse varias veces sin duplicar nada.

```bash
psql -U postgres -c "CREATE DATABASE fisio_li;"
psql -U postgres -d fisio_li -v ON_ERROR_STOP=1 -f schema.sql
psql -U postgres -d fisio_li -v ON_ERROR_STOP=1 -f seed.sql
```

En Docker Compose basta con montar ambos archivos en `/docker-entrypoint-initdb.d/` con prefijos numéricos que garanticen el orden. La imagen debe traer `btree_gist`, `pgcrypto`, `unaccent` y `pg_trgm`, que vienen en `postgres:16` estándar.

El schema completo se validó contra PostgreSQL 16.15 ejecutando el ciclo entero: creación, carga, agendamiento, colisión de cupos, cancelación dentro y fuera de plazo, programa de referidos, clasificación de signos vitales, inmutabilidad clínica y consumo del outbox.

---

## 8. Lo que hay que confirmar con la clienta

Cuatro supuestos quedaron marcados en el código y conviene resolverlos antes de la demostración.

Se asumió **una sola profesional**, de modo que la restricción de exclusión opera sobre el profesional. Si entra una segunda fisioterapeuta o hay dos camillas simultáneas en una sede, el recurso escaso cambia y la restricción debe volverse compuesta.

Se asumió que los **paquetes no expiran**, porque el material no lo menciona. La columna `vence_en` ya existe en `comercial.compra`; sólo falta la regla.

Los **tiempos de preparación entre pacientes** se sembraron con valores de trabajo: quince minutos para las sesiones estándar, veinte para cuerpo completo y punción seca, treinta para PRP y sueroterapia. Son estimaciones y necesitan los minutos reales de Lina.

En los planes grupales se asumió **grupo abierto**: cada paciente compra su cupo y la sesión se va llenando. Si en la práctica llegan como grupo cerrado ya conformado, el modelo de compra cambia de forma significativa.

Además, la política de cancelación dice "24 a 48 horas". El parámetro `horas_minimas_cancelacion` quedó en veinticuatro, que es el extremo favorable al paciente, y `horas_recomendadas_cancelacion` en cuarenta y ocho para lo que se le comunica al confirmar. Vale la pena confirmar si esa interpretación es la correcta.