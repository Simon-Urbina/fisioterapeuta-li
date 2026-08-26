# Fisioterapeuta Li — Sistema de automatización y gestión empresarial

Plataforma que centraliza la operación diaria de un consultorio de fisioterapia: reservas desde un sitio web, gestión de agenda por Telegram usando lenguaje natural, y automatización de correo, documentos y reportes sobre Google Workspace. La interpretación del lenguaje natural corre en un modelo local con Ollama; n8n orquesta los flujos; una API propia concentra las reglas de negocio y los permisos.

Proyecto del **Reto 3 de HackTech 5.0 2026**, Universidad Santo Tomás, Tunja. Empresa proponente: La Fisioterapeuta Li.

> **Estado: fase de diseño.** Todavía no hay código de aplicación escrito. Este documento describe lo que se va a construir y las decisiones que ya están tomadas. Lo que no aparece aquí sigue abierto; las decisiones pendientes están listadas en la sección 12.

---

## Índice

1. [Reglas de arquitectura](#1-reglas-de-arquitectura)
2. [Arquitectura](#2-arquitectura)
3. [Stack tecnológico](#3-stack-tecnológico)
4. [Estructura del repositorio](#4-estructura-del-repositorio)
5. [Modelo de datos](#5-modelo-de-datos)
6. [Contratos](#6-contratos)
7. [Entorno local](#7-entorno-local)
8. [Variables de entorno](#8-variables-de-entorno)
9. [Convenciones de código](#9-convenciones-de-código)
10. [Equipo y dueños](#10-equipo-y-dueños)
11. [Alcance](#11-alcance)
12. [Decisiones pendientes](#12-decisiones-pendientes)
13. [Problemas conocidos del entorno](#13-problemas-conocidos-del-entorno)

---

## 1. Reglas de arquitectura

Estas siete reglas vienen del enunciado del reto y de decisiones ya tomadas. Violarlas invalida el diseño, así que tienen prioridad sobre cualquier atajo de implementación.

1. **La IA interpreta, el sistema valida, n8n orquesta, la API autorizada ejecuta.** Es el principio rector textual del reto.
2. **El modelo de lenguaje no tiene credenciales de nada.** Recibe texto, devuelve JSON. No llama a Google, ni a la base de datos, ni a la API núcleo.
3. **Solo el adaptador de Google almacena tokens OAuth.** Ningún otro servicio habla con Google directamente, incluido n8n.
4. **n8n no contiene reglas de negocio.** Si un nodo de n8n toma una decisión, esa decisión pertenece a la API núcleo. n8n mueve datos y dispara acciones; no calcula disponibilidad ni valida permisos.
5. **La reserva desde el sitio web va directo a la API núcleo, sin pasar por n8n.** Necesita validar y bloquear el cupo en una sola transacción atómica. Meter un motor de workflows con reintentos en medio de una condición de carrera produce reservas duplicadas. n8n se encarga de lo que ocurre *después*: correo, Sheets, aviso por Telegram.
6. **PostgreSQL es la única fuente de verdad.** Google Calendar es un espejo al que se escribe después de confirmar en la base. Google Sheets recibe solo proyecciones de lectura para reportes. Nunca se lee estado de negocio desde Google.
7. **Toda operación que modifique datos se registra en `operacion_log`** y toda operación sensible (cancelar, enviar correo, compartir archivo) exige confirmación explícita del usuario antes de ejecutarse.

---

## 2. Arquitectura

Núcleo por capas rodeado de adaptadores. El dominio es un stack limpio; todo lo que entra o sale es una pieza intercambiable. Se aparta de una arquitectura por capas pura porque hay **dos canales de entrada** (Telegram y web) y **un orquestador externo** (n8n) que no forma parte del dominio.

```
Canales          Bot de Telegram          Sitio web + panel
                        │                        │
                        ▼                        │
Orquestación          n8n ◄──────────────────────┤
                     │    │                      │
              ┌──────┘    └──────┐               │  (ruta crítica:
              ▼                  ▼               │   reserva directa)
Inteligencia  Servicio NLU    API núcleo ◄───────┘
              (Ollama)        (dominio, disponibilidad,
                               permisos, log)
                                 │        │
                    ┌────────────┘        └──────────┐
                    ▼                                ▼
Datos          PostgreSQL                   Adaptador Google
             (fuente de verdad)                     │
                                                    ▼
                                            Google Workspace
                                     (Calendar, Gmail, Drive, Sheets)
```

### Flujo mínimo exigible (criterio de aprobación del reto)

| Paso | Componente | Acción |
|---|---|---|
| 1 | Sitio web | El cliente consulta horarios disponibles → `GET /disponibilidad` |
| 2 | API núcleo | Genera espacios válidos según horario laboral, duración del servicio, buffer y anticipación mínima |
| 3 | Sitio web | El cliente reserva → `POST /reservas` con `Idempotency-Key` |
| 4 | API núcleo | Valida y persiste en una transacción; la restricción `sin_solapamiento` impide la doble reserva |
| 5 | Adaptador Google | Crea el evento en Calendar y devuelve `google_event_id` |
| 6 | n8n | Dispara correo de confirmación, registro en Sheets y aviso al administrador |
| 7 | Bot de Telegram | El administrador pide la agenda y ve la nueva reserva |

### Flujo conversacional

```
Mensaje de Telegram → n8n valida usuario autorizado → Servicio NLU devuelve intención JSON
  → ¿faltan datos? → el bot pregunta y vuelve a empezar
  → ¿operación sensible? → el bot pide confirmación explícita
  → n8n envía la intención a POST /comandos → la API valida permisos y ejecuta
  → respuesta al usuario + registro en operacion_log
```

---

## 3. Stack tecnológico

| Capa | Tecnología | Nota |
|---|---|---|
| Runtime backend | Bun | Mismo runtime que RutSeg, el equipo ya lo conoce |
| API núcleo | Hono 4 + TypeScript | Capas: routes → controllers → services → daos |
| Adaptador Google | Bun + Hono + `googleapis` | Único servicio con credenciales OAuth |
| Servicio NLU | FastAPI + Python | Cliente de Ollama, prompts y validación del JSON |
| Modelo local | Ollama con `llama3.1:8b` | Instalado **nativo**, no en Docker |
| Orquestación | n8n en Docker | Una instancia local por integrante |
| Canal conversacional | Bot de Telegram con long polling | Sin webhook: no requiere exponer nada a internet |
| Sitio web y panel | React 19 + TypeScript + Vite + Tailwind CSS v4 | Ejecución local en el puerto 3000 |
| Base de datos | PostgreSQL 16 en Docker | Con extensión `btree_gist` |
| Ejecución | Docker Compose, todo en local | **Sin despliegue en la nube en esta fase** |

> El stack de backend y frontend replica el de RutSeg deliberadamente: la hackathon es corta y no hay tiempo para aprender herramientas nuevas. Las diferencias reales están en n8n, Ollama y el adaptador de Google.

---

## 4. Estructura del repositorio

Cada carpeta tiene su propio `README.md` (junto a un `.gitkeep`) con un resumen corto de qué se va a construir ahí y quién es responsable — no un paso a paso, solo el encuadre. Esta sección muestra el árbol completo; el detalle de cada carpeta vive en su propio README.

```
fisio-li/
├── README.md                    # este archivo
├── DUENOS.md                    # quién es dueño de cada carpeta
├── .env.example                 # todas las variables, sin valores reales
├── docker-compose.yml           # postgres + n8n
│
├── contracts/                   # COMPARTIDA — cambios solo por pull request
│   └── README.md                # aquí van openapi.yaml e intents.schema.json cuando se escriban
│
├── apps/
│   ├── web/                     # React + Vite: sitio público, reservas y panel admin
│   └── telegram-bot/            # bot, comandos, estado conversacional, confirmaciones
│
├── services/
│   ├── core-api/                # dominio, motor de disponibilidad, autorización, log
│   ├── nlu/                     # FastAPI + Ollama
│   │   ├── prompts/
│   │   ├── modelfiles/          # aquí va el Modelfile versionado
│   │   └── evals/               # aquí van los casos de prueba de interpretación
│   └── google-adapter/          # Calendar, Gmail, Drive, Sheets
│
├── automation/n8n/
│   ├── workflows/                 # export .json de cada flujo (versionado)
│   └── credentials.example.json   # plantilla; las reales NUNCA se suben
│
├── db/
│   ├── migrations/               # aquí va el esquema SQL (ver sección 5)
│   └── seeds/                    # aquí van los datos de prueba
│
├── design/
│   └── wireframes/
├── tests/{e2e,casos,evidencias}
├── integration/
├── scripts/                     # setup.sh, health.sh, exportar-n8n.sh
└── docs/
    ├── 01-requisitos/  02-arquitectura/  03-procesos/
    ├── 04-qa/  05-manual/  actas/  entregables/
```

---

## 5. Modelo de datos

Este es el esquema objetivo del dominio; todavía no existe como migración ejecutable en el repositorio (`db/migrations/` está vacía por ahora, ver su README). Se documenta aquí para fijar el diseño mientras se implementa.

Jerarquía principal: `cliente` y `servicio` se cruzan en `sesion`, que se ancla a un `recurso` y se valida contra `horario_laboral` y `bloqueo`.

| Tabla | Descripción |
|---|---|
| `servicio` | Servicios con `duracion_min`, `buffer_min` y precio |
| `recurso` | Profesional o espacio físico contra el que se agenda |
| `cliente` | Datos del paciente; los campos exactos dependen de F17 |
| `horario_laboral` | Franjas de atención por recurso y día de la semana |
| `bloqueo` | Periodos no disponibles (festivos, vacaciones, imprevistos) |
| `sesion` | La cita: `periodo` como `tstzrange`, estado, origen y `google_event_id` |
| `usuario_autorizado` | Allowlist del bot por `telegram_chat_id` |
| `operacion_log` | Auditoría de toda operación ejecutada |
| `idempotencia` | Respuestas cacheadas por `Idempotency-Key` para tolerar reintentos de n8n |

### La restricción que evita la doble reserva

```sql
CONSTRAINT sin_solapamiento
  EXCLUDE USING gist (recurso_id WITH =, periodo WITH &&)
  WHERE (estado <> 'cancelada')
```

PostgreSQL rechaza por sí mismo dos sesiones solapadas sobre el mismo recurso, sin depender de que la capa de servicios valide correctamente. Es la protección real cuando el sitio web y Telegram operan al mismo tiempo, y por eso no se sustituye por una verificación previa en código.

---

## 6. Contratos

Este es el contrato objetivo entre servicios. Los archivos reales todavía no existen en `contracts/` (ver su README); cuando se escriban, `openapi.yaml` e `intents.schema.json` deben coincidir exactamente con lo documentado aquí.

### API núcleo — `contracts/openapi.yaml`

Base: `http://localhost:8000`. Todo consumidor interno envía la cabecera `X-Internal-Key`.

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/servicios` | Servicios con duración y buffer |
| GET | `/disponibilidad` | Espacios libres para un servicio en un rango de fechas |
| POST | `/reservas` | **Ruta crítica.** Valida y bloquea el cupo atómicamente. Requiere `Idempotency-Key`. Devuelve 409 si el espacio ya fue ocupado |
| GET | `/agenda` | Agenda diaria o semanal, para el panel y para el bot |
| POST | `/comandos` | Ejecuta una intención ya interpretada. n8n llama aquí; el modelo nunca |
| GET | `/health` | Verificación de estado |

### Intenciones — `contracts/intents.schema.json`

El servicio NLU devuelve exclusivamente este objeto:

```json
{
  "intencion": "crear_sesion",
  "entidades": { "cliente": "Laura", "servicio": null, "fecha": "2026-08-28", "hora": "15:00" },
  "confianza": 0.86,
  "faltantes": ["servicio"]
}
```

Once intenciones posibles: `consultar_agenda`, `consultar_disponibilidad`, `crear_sesion`, `modificar_sesion`, `cancelar_sesion`, `buscar_cliente`, `enviar_correo`, `crear_carpeta`, `buscar_archivo`, `bloquear_horario`, `desconocida`.

Si el modelo devuelve algo que no valida contra el esquema, el servicio NLU responde `intencion: "desconocida"`. A la API núcleo nunca llega un JSON sin validar.

---

## 7. Entorno local

Todo corre en la máquina de cada integrante. No hay despliegue en la nube.

### Puertos

| Servicio | Puerto |
|---|---|
| Sitio web y panel | 3000 |
| API núcleo | 8000 |
| Servicio NLU | 8100 |
| Adaptador de Google | 8200 |
| n8n | 5678 |
| PostgreSQL | 5432 |
| Ollama | 11434 |

### Arranque

```bash
cp .env.example .env        # y completar los valores
ollama pull llama3.1:8b
bash scripts/setup.sh       # levanta postgres + n8n, carga migraciones y semillas
bash scripts/health.sh      # verifica que los siete servicios respondan
```

Después, cada servicio se levanta a mano en su carpeta. Orden: API núcleo → NLU → adaptador de Google → web → bot.

### Comandos útiles

```bash
bash scripts/exportar-n8n.sh                       # exporta workflows antes de hacer commit
docker compose down && rm -rf postgres-data        # reconstruir la base desde cero
docker exec -it fisio-postgres psql -U fisio -d fisio_li
```

---

## 8. Variables de entorno

Ver `.env.example` para la lista completa. Las agrupaciones son: base de datos, API núcleo (`INTERNAL_API_KEY`, `TIMEZONE`), modelo local (`OLLAMA_HOST`, `OLLAMA_MODEL`), Telegram (dos tokens: desarrollo y demostración, más `TELEGRAM_ALLOWED_CHAT_IDS`), n8n, Google (client id, secret, redirect, ids de calendario, carpeta y hoja) y web.

`TIMEZONE` es `America/Bogota` en todo el sistema. Las fechas viajan en ISO 8601 con zona explícita y se almacenan en UTC.

---

## 9. Convenciones de código

- **Idioma:** el dominio va en español (tablas, campos, intenciones, rutas de la API). El código de infraestructura y los nombres técnicos van en inglés (`routes`, `controllers`, `middleware`). No mezclar dentro de un mismo concepto.
- **Capas del backend:** `routes → controllers → services → daos → PostgreSQL`. Los controladores no consultan la base; los DAOs no contienen reglas de negocio.
- **SQL:** parametrizado siempre. Sin concatenación de strings.
- **Errores:** manejo controlado, sin exponer trazas al usuario final. Los códigos relevantes son 401 (sin sesión), 403 (sin permiso), 409 (espacio ocupado) y 422 (intención incompleta).
- **Commits:** en español, en imperativo, con el módulo al frente. Ejemplo: `core-api: agrega validación de anticipación mínima`.
- **Ramas:** una por módulo (`feat/core-api-disponibilidad`). Los cambios a `contracts/` van por pull request revisado.

---

## 10. Equipo y dueños

| Área | Responsable | Carpetas |
|---|---|---|
| Backend y base de datos | Simón | `services/core-api/`, `db/` |
| Requisitos y arquitectura (documentación) | Simón | `docs/01-requisitos/`, `docs/02-arquitectura/` |
| Frontend y web | Samuel | `apps/web/` |
| IA y Telegram | José | `services/nlu/`, `apps/telegram-bot/` |
| Integración de todos los componentes | Sin asignar | `integration/`, `scripts/` |
| n8n y Google Workspace | Valentina | `automation/n8n/`, `services/google-adapter/` |
| UX y UI | Alison | `design/` |
| QA, pruebas y documentación | Diego y Brayan | `tests/`, `docs/04-qa/` |
| Procesos e indicadores, Ing. Industrial (documentación) | Daniel | `docs/03-procesos/` |

Detalle completo en `DUENOS.md`. José concentra IA y Telegram, sus dos frentes. La integración (`integration/`, `scripts/`) todavía no tiene un responsable fijo.

---

## 11. Alcance

### Incluido

Bot de Telegram, interpretación con modelo local, orquestación en n8n, gestión de agenda, reservas desde el sitio web, automatización de correo, gestión y organización de Google Drive, reportes en Google Sheets, sitio web corporativo, panel administrativo, recordatorios automáticos y asistente de consulta empresarial.

### Fuera de alcance en esta versión

Sistema clínico o historias clínicas, diagnósticos o recomendaciones de tratamiento con IA, procesamiento de imágenes clínicas, pagos bancarios, aplicaciones móviles nativas, sustituir las interfaces de Google, y ejecutar acciones administrativas críticas sin validación.

### Orden de construcción

El flujo mínimo (sección 2) va primero y completo. Solo después se agregan Gmail, Drive, Sheets, el panel y los recordatorios.

**El bot debe funcionar con comandos estructurados antes de depender del modelo.** Si el modelo falla durante la sustentación, el sistema sigue respondiendo.

---

## 12. Decisiones pendientes

Ninguno de estos valores está definido todavía. Mientras tanto se usan datos provisionales en `db/seeds/` (ver su README), y en el código quedan marcados como `TODO(<código>)` para poder rastrearlos cuando lleguen las respuestas.

| Código | Pregunta abierta | Bloquea |
|---|---|---|
| P1–P3 | ¿El modelo debe correr local obligatoriamente o se acepta una API externa como Groq? | El servicio NLU completo |
| F1–F8 | Servicios reales, duración de cada uno y tiempo de preparación entre sesiones | Motor de disponibilidad |
| F9–F16 | Horario laboral, capacidad simultánea, anticipación mínima y máxima | Motor de disponibilidad |
| F17–F19 | Campos exactos del paciente y cómo se identifica a uno que regresa | Tabla `cliente` y formulario de reserva |
| F21 | ¿La reserva web queda confirmada automáticamente o requiere aprobación? | Estados de `sesion` |
| F23 | Política de cancelación y reprogramación | Endpoints de modificación |
| F34, F44 | ¿Google Workspace o Gmail personal? ¿Credenciales reales o cuenta de prueba? | Estrategia OAuth del adaptador |
| O1 | Texto completo de la funcionalidad 13 del enunciado, que llegó truncado | Asistente de consulta |

Los códigos `F`, `P` y `O` corresponden al banco de preguntas del documento del reto: `F` para la clienta, `P` para los profesores guía, `O` para los organizadores.

---

## 13. Problemas conocidos del entorno

Resumen aquí; el detalle operativo se documentará en `integration/` (ver su README) cuando alguien tome esa carpeta.

**n8n no alcanza los servicios locales.** n8n corre en Docker, así que `localhost` apunta al contenedor. Desde los nodos usar `http://host.docker.internal:8000`. Ya está configurado `extra_hosts` para que funcione también en Linux.

**El nodo Telegram Trigger de n8n necesita URL pública.** Telegram entrega por webhook y en local no hay dominio. Por eso el bot usa long polling y llama a n8n por HTTP, en lugar de que n8n reciba directamente de Telegram.

**Un token de Telegram admite un solo consumidor activo.** Si dos personas prueban a la vez se roban los mensajes. Hay dos bots: uno de desarrollo que rota entre quien esté probando, y uno de demostración que no se toca hasta la sustentación.

**Ollama debe instalarse nativo.** Dentro de Docker en Windows pierde el acceso a la GPU y la latencia se vuelve inaceptable.

**Las migraciones solo se aplican con el volumen vacío.** Para reconstruir: `docker compose down && rm -rf postgres-data && docker compose up -d`.

**Los workflows de n8n solo existen en la máquina de quien los hizo.** Hay que exportarlos con `scripts/exportar-n8n.sh` y hacer commit, o el trabajo no existe para el resto. Revisar que el export no incluya tokens.