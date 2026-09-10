# services/nlu/evals/

Responsable: José

Casos de prueba para medir qué tan bien interpreta el modelo: frases reales
con la intención (y a veces las entidades) que debería producir cada una.
Sirve para comparar cambios de prompt o de modelo de forma objetiva, y le da
a QA algo medible en la parte de IA.

## Archivos

- `casos.jsonl` — un caso por línea:
  `{"mensaje": "...", "intencion": "...", "entidades": { ... }? }`
  `entidades` es opcional; cuando está, cada valor esperado "casa" si el
  devuelto lo contiene (o al revés), sin distinguir tildes ni mayúsculas.
- `run.mjs` — corredor. Node puro, sin dependencias.

## Cómo correrlo

Necesita el servicio NLU corriendo y Ollama con el modelo descargado:

```bash
# en otra terminal
cd services/nlu
ollama pull qwen2.5:7b-instruct   # una sola vez
npm run dev

# en esta terminal
cd services/nlu
node evals/run.mjs
```

Toma `NLU_URL` e `INTERNAL_API_KEY` de las variables de entorno o, si no
están, de `services/nlu/.env.local`. La fecha de referencia es la de hoy;
fíjala para reproducibilidad con `HOY=2026-09-01 node evals/run.mjs`.

Para correr otro set: `node evals/run.mjs ruta/al/otro.jsonl`.

## Qué imprime

- Acierto de intención por intención y global.
- Acierto de entidades (solo sobre los casos que declaran `entidades`).
- Lista de confusiones (`esperada -> obtenida ×N`) y de fallos uno por uno.

Con `EVAL_MIN=0.9` el proceso sale con código ≠ 0 si el acierto de intención
baja de ese umbral (útil si algún día se mete en CI).

## Flujo de trabajo al tocar el prompt o el modelo

1. `node evals/run.mjs` y anota el resumen (antes).
2. Cambia `src/prompt.ts` (o el modelo en `.env.local`).
3. `node evals/run.mjs` de nuevo y compara. Mira las confusiones nuevas.
