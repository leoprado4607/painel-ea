/** Averbação do direito: documento (BI, Adt ou BAR), números, OM e data. */

export const DOCUMENTOS_AVERBACAO = ["BI", "Adt", "BAR"] as const;
export type DocumentoAverbacao = (typeof DOCUMENTOS_AVERBACAO)[number];
/** Boletim de que o Adt faz parte (todo Adt é de um BI ou de um BAR). */
export const BOLETINS_ADT = ["BI", "BAR"] as const;

export const OMS_AVERBACAO = [
  "B Adm Gu Natal", "HGuN", "17º GAC", "16º BI Mtz", "7º BE Cmb", "Cmdo 7ª Bda Inf Mtz", "Cia Cmdo/7ª Bda Inf Mtz", "7º Pel PE",
] as const;

export interface Averbacao {
  documento_averbacao: string | null;
  adt_numero: string | null;
  /** "BI" ou "BAR": de qual boletim o Adt faz parte (processos antigos: vazio, entende-se BI) */
  adt_boletim?: string | null;
  bi_numero: string | null;
  om_averbacao: string | null;
  bi_data: string | null;
}

/** "Nr BI/BAR": exatamente 3 dígitos. */
/** Nr BI/BAR: até 3 dígitos (1, 2 ou 3). */
export const numeroBoletimValido = (v: string) => /^\d{1,3}$/.test(v);

/**
 * Texto da coluna "Boletim que Averbou" do Verso.
 * Ex.: "Adt 12 ao BI 045 - 17º GAC, de 20/09/2026" · "Adt 3 ao BAR 010 - …" · "BAR 045 - B Adm Gu Natal, de 20/09/2026".
 */
export function textoBoletim(a: Averbacao): string {
  const data = a.bi_data ? `${a.bi_data.slice(8, 10)}/${a.bi_data.slice(5, 7)}/${a.bi_data.slice(0, 4)}` : "";
  const doc = a.documento_averbacao;
  let base = "";
  if (doc === "Adt") base = [a.adt_numero ? `Adt ${a.adt_numero}` : "Adt", a.bi_numero ? `ao ${a.adt_boletim || "BI"} ${a.bi_numero}` : ""].filter(Boolean).join(" ");
  else if (doc) base = [doc, a.bi_numero].filter(Boolean).join(" ");
  else if (a.bi_numero) base = `BI/Adt ${a.bi_numero}`; // processos anteriores à mudança
  if (!base) return "";
  return `${base}${a.om_averbacao ? ` - ${a.om_averbacao}` : ""}${data ? `, de ${data}` : ""}`;
}
