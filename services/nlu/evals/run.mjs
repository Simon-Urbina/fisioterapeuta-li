// Corredor de evals del NLU. Node puro, sin dependencias.
//
// Manda cada frase de `casos.jsonl` al servicio NLU que ya esté corriendo
// (`npm run dev` en services/nlu + Ollama con el modelo descargado) y compara
// la intención (y las entidades que el caso declare) contra lo esperado.
// Imprime acierto global, acierto por intención y la lista de fallos y
// confusiones, para poder comparar un cambio de prompt o de modelo de forma
// objetiva.
//
// Uso:
//   node evals/run.mjs                 # usa evals/casos.jsonl y la fecha de hoy
//   HOY=2026-09-01 node evals/run.mjs  # fija la fecha de referencia
//   node evals/run.mjs otros-casos.jsonl
//
// Lee NLU_URL e INTERNAL_API_KEY de las variables de entorno o, si no están,
// de services/nlu/.env.local.

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ_NLU = resolve(AQUI, "..");

async function cargarEnvLocal() {
  const env = { ...process.env };
  try {
    const texto = await readFile(join(RAIZ_NLU, ".env.local"), "utf8");
    for (const linea of texto.split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(linea);
      if (m && env[m[1]] === undefined) env[m[1]] = m[2];
    }
  } catch {
    // sin .env.local: se usa solo process.env
  }
  return env;
}

function hoyBogota() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function normalizar(s) {
  return String(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Una entidad esperada "casa" si el valor devuelto la contiene (o al revés). */
function entidadCoincide(esperado, real) {
  if (real === undefined || real === null) return false;
  const a = normalizar(esperado);
  const b = normalizar(real);
  return a === b || a.includes(b) || b.includes(a);
}

async function main() {
  const env = await cargarEnvLocal();
  const nluUrl = env.NLU_URL ?? "http://127.0.0.1:8100";
  const clave = env.INTERNAL_API_KEY;
  const hoy = env.HOY ?? hoyBogota();
  const archivo = process.argv[2] ?? join(AQUI, "casos.jsonl");

  const crudo = await readFile(resolve(archivo), "utf8");
  const casos = crudo
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("//"))
    .map((l, i) => {
      try {
        return JSON.parse(l);
      } catch {
        throw new Error(`Línea ${i + 1} de ${archivo} no es JSON válido: ${l}`);
      }
    });

  console.log(`NLU: ${nluUrl}  ·  fecha de referencia: ${hoy}  ·  ${casos.length} casos\n`);

  const headers = { "content-type": "application/json" };
  if (clave) headers["x-internal-key"] = clave;

  let okIntencion = 0;
  let okEntidades = 0;
  let conEntidades = 0;
  let errores = 0;
  const porIntencion = new Map(); // intencion esperada -> { total, ok }
  const confusiones = new Map(); // "esperada -> obtenida" -> conteo
  const fallos = [];

  for (const caso of casos) {
    const stat = porIntencion.get(caso.intencion) ?? { total: 0, ok: 0 };
    stat.total += 1;
    porIntencion.set(caso.intencion, stat);

    let cuerpo;
    try {
      const resp = await fetch(new URL("/interpretar", nluUrl), {
        method: "POST",
        headers,
        body: JSON.stringify({ mensaje: caso.mensaje, hoy }),
      });
      if (!resp.ok) {
        errores += 1;
        fallos.push(`  [HTTP ${resp.status}] ${caso.mensaje}`);
        continue;
      }
      cuerpo = await resp.json();
    } catch (err) {
      errores += 1;
      fallos.push(`  [sin respuesta] ${caso.mensaje} — ${err.message}`);
      continue;
    }

    const intencionOk = cuerpo.intencion === caso.intencion;
    if (intencionOk) {
      okIntencion += 1;
      stat.ok += 1;
    } else {
      const clave = `${caso.intencion} -> ${cuerpo.intencion}`;
      confusiones.set(clave, (confusiones.get(clave) ?? 0) + 1);
      fallos.push(`  intención: "${caso.mensaje}"  esperada=${caso.intencion}  obtenida=${cuerpo.intencion} (conf ${cuerpo.confianza})`);
    }

    if (caso.entidades && Object.keys(caso.entidades).length > 0) {
      conEntidades += 1;
      const dev = cuerpo.entidades ?? {};
      const faltan = Object.entries(caso.entidades).filter(([k, v]) => !entidadCoincide(v, dev[k]));
      if (intencionOk && faltan.length === 0) {
        okEntidades += 1;
      } else if (intencionOk) {
        fallos.push(
          `  entidades: "${caso.mensaje}"  faltó/erró ${faltan.map(([k, v]) => `${k}=${v} (dio ${dev[k] ?? "∅"})`).join(", ")}`,
        );
      }
    }
  }

  const pct = (n, d) => (d === 0 ? "—" : `${((100 * n) / d).toFixed(1)}%`);

  console.log("Por intención:");
  for (const [intn, s] of [...porIntencion.entries()].sort()) {
    console.log(`  ${intn.padEnd(24)} ${s.ok}/${s.total}  ${pct(s.ok, s.total)}`);
  }

  if (confusiones.size > 0) {
    console.log("\nConfusiones:");
    for (const [par, n] of [...confusiones.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${par}  ×${n}`);
    }
  }

  if (fallos.length > 0) {
    console.log("\nFallos:");
    for (const f of fallos) console.log(f);
  }

  console.log("\nResumen:");
  console.log(`  Intención:  ${okIntencion}/${casos.length}  ${pct(okIntencion, casos.length)}`);
  console.log(`  Entidades:  ${okEntidades}/${conEntidades}  ${pct(okEntidades, conEntidades)}  (solo casos con entidades declaradas)`);
  if (errores > 0) console.log(`  Errores de red/HTTP: ${errores}`);

  // Código de salida distinto de 0 si el acierto de intención baja del umbral,
  // para poder usarlo en CI si algún día se quiere.
  const min = Number(env.EVAL_MIN ?? "0");
  if (min > 0 && okIntencion / casos.length < min) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
