/**
 * Limitador de tasa por chat, en memoria (ventana deslizante de 60 s).
 * Suficiente para una sola instancia del bot en long polling.
 */
export class RateLimiter {
  private readonly hits = new Map<number, number[]>();

  constructor(
    private readonly maxPorMinuto: number,
    private readonly ahora: () => number = () => Date.now(),
  ) {}

  /** Devuelve true si el chat puede seguir; false si superó el límite. */
  permitir(chatId: number): boolean {
    const t = this.ahora();
    const ventana = t - 60_000;
    const previos = (this.hits.get(chatId) ?? []).filter((ts) => ts > ventana);
    if (previos.length >= this.maxPorMinuto) {
      this.hits.set(chatId, previos);
      return false;
    }
    previos.push(t);
    this.hits.set(chatId, previos);
    return true;
  }

  /** Limpia chats sin actividad reciente. Llamar de vez en cuando. */
  podar(): void {
    const ventana = this.ahora() - 60_000;
    for (const [chatId, ts] of this.hits) {
      const vivos = ts.filter((x) => x > ventana);
      if (vivos.length === 0) this.hits.delete(chatId);
      else this.hits.set(chatId, vivos);
    }
  }
}
