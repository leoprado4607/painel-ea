const fmt = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 1234.5 → "1.234,50" */
export const formatarReais = (v: number | null | undefined): string => (v === null || v === undefined ? "" : fmt.format(v));

/** "1.234,50" | "1234,5" | "1234.50" → 1234.5; vazio → null; inválido → NaN */
export function lerReais(texto: string): number | null {
  const t = texto.trim().replace(/^R\$\s*/, "");
  if (t === "") return null;
  const normal = /,\d{1,2}$/.test(t) || t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  if (!/^-?\d+(\.\d{1,2})?$/.test(normal)) return NaN;
  return Number(normal);
}
