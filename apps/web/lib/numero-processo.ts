/** Nº do processo (NUP): máscara 00000.000000/0000-00 — 17 dígitos, nada a mais e nada a menos. */
const POSICOES: [number, string][] = [[5, "."], [11, "/"], [15, "-"]];

/** Aplica a máscara aos dígitos digitados (ignora o resto e corta no 17º dígito). */
export function mascaraNumeroProcesso(v: string | null | undefined): string {
  const d = (v ?? "").replace(/\D/g, "").slice(0, 17);
  let s = "";
  for (let i = 0; i < d.length; i++) {
    const sep = POSICOES.find(([p]) => p === i);
    if (sep) s += sep[1];
    s += d[i];
  }
  return s;
}

export const PADRAO_NUMERO_PROCESSO = "\\d{5}\\.\\d{6}/\\d{4}-\\d{2}";
export const numeroProcessoValido = (v: string) => new RegExp(`^${PADRAO_NUMERO_PROCESSO}$`).test(v);
/** Ano do processo: os 4 números antes do "-00" (só com o número completo). */
export const anoDoNumeroProcesso = (v: string) => (numeroProcessoValido(v) ? v.slice(13, 17) : null);
