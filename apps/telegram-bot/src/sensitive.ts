/**
 * Operaciones sensibles: exigen confirmación explícita del usuario antes de
 * ejecutarse (regla 7 del README del repo). El bot nunca las dispara solo
 * porque el NLU lo haya sugerido.
 */
export const INTENCIONES_SENSIBLES = new Set<string>([
  "cancelar_sesion",
  "modificar_sesion",
  "enviar_correo",
  "bloquear_horario",
  "crear_carpeta",
]);

export function esSensible(intencion: string): boolean {
  return INTENCIONES_SENSIBLES.has(intencion);
}
