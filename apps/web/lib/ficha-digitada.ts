/**
 * Valores da ficha digitados à mão na análise do Adicional de Habilitação (27/11/2026): para quando o PDF não é legível
 * (nem por OCR) ou o OCR errou um número. Só os campos que a análise usa; as demais linhas da ficha lida ficam intactas.
 * Uma ficha nova (ano sem ficha) é gravada com os códigos do SIPPES, como se tivesse sido lida.
 */
import type { FichaLida } from "./receitas";

export const CAMPOS_FICHA = ["soldo", "adicional", "atrasado", "estorno"] as const;
export type CampoFicha = (typeof CAMPOS_FICHA)[number];

export const ROTULO_CAMPO: Record<CampoFicha, string> = {
  soldo: "Soldo",
  adicional: "Adicional de habilitação pago",
  atrasado: "Adicional atrasado (retroativo)",
  estorno: "Desconto do adicional (estorno)",
};

/** Códigos de cada campo: o 1º é o gravado; os demais são somados na leitura (e zerados no mês alterado). */
const CODIGOS: Record<FichaLida["sistema"], Record<CampoFicha | "decimo", string[]>> = {
  sippes: { soldo: ["NR0001"], adicional: ["NR0003"], atrasado: ["AR0003", "ER0003"], estorno: ["DR0003"], decimo: ["NR0085", "NR0084"] },
  siappes: { soldo: ["A01"], adicional: ["A03"], atrasado: ["A23"], estorno: ["G03"], decimo: ["A85"] },
};
const DESCRICAO: Record<string, string> = {
  NR0001: "SOLDO", A01: "SOLDO", NR0003: "ADIC HABILITACAO", A03: "ADIC HABILITACAO", AR0003: "ADIC HABILITACAO (ATRASADO)",
  A23: "ADIC HABILITACAO (ATRASADO)", DR0003: "ADIC HABILITACAO (DESCONTO)", G03: "ADIC HABILITACAO (DESCONTO)", NR0085: "GRATIFICACAO NATALINA", A85: "GRATIFICACAO NATALINA",
};
const ESTORNO = new Set(["DR0003", "G03"]);

const centavos = (v: number) => Math.round(v * 100) / 100;

/** Valor digitado: "1.234,56" (ou "1234,56", "1234.56", "6.000") → número; vazio → 0; inválido → NaN. */
export function numeroBr(s: string): number {
  const t = s.trim().replace(/^R\$\s*/, "");
  if (!t) return 0;
  const n = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : /^\d{1,3}(\.\d{3})+$/.test(t) ? t.replace(/\./g, "") : t;
  return /^\d+(\.\d{1,2})?$/.test(n) ? Number(n) : NaN;
}
const lista = (f: FichaLida, codigo: string) => (ESTORNO.has(codigo) ? f.descontos ?? [] : f.linhas);

export interface ValoresFicha {
  ano: number;
  sistema: FichaLida["sistema"];
  origem: "pdf" | "ocr" | "manual";
  editada: boolean;
  arquivo: string | null;
  conferencia: FichaLida["conferencia"] | null;
  meses: Record<CampoFicha, number[]>;
  /** 13º pago no ano (as parcelas somadas). */
  decimo: number;
}

export function valoresDaFicha(f: FichaLida): ValoresFicha {
  const cod = CODIGOS[f.sistema];
  const soma = (codigos: string[]) => Array.from({ length: 12 }, (_, i) => centavos(codigos.reduce((s, c) =>
    s + lista(f, c).filter((l) => l.codigo.trim().toUpperCase() === c).reduce((t, l) => t + (l.meses[i] ?? 0), 0), 0)));
  return {
    ano: f.ano, sistema: f.sistema, origem: f.origem ?? "pdf", editada: !!f.editada, arquivo: f.arquivo ?? null, conferencia: f.conferencia ?? null,
    meses: Object.fromEntries(CAMPOS_FICHA.map((c) => [c, soma(cod[c])])) as Record<CampoFicha, number[]>,
    decimo: centavos(soma(cod.decimo).reduce((a, b) => a + b, 0)),
  };
}

export interface FichaDigitada { meses: Record<CampoFicha, number[]>; decimo: number }

/** Confere o que veio da tela: 12 valores não negativos por campo. */
export function fichaDigitadaValida(x: unknown): FichaDigitada | null {
  if (!x || typeof x !== "object") return null;
  const o = x as { meses?: Record<string, unknown>; decimo?: unknown };
  const ok = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v < 1_000_000;
  if (!o.meses || !ok(o.decimo)) return null;
  for (const c of CAMPOS_FICHA) if (!Array.isArray(o.meses[c]) || o.meses[c].length !== 12 || !(o.meses[c] as unknown[]).every(ok)) return null;
  return { meses: Object.fromEntries(CAMPOS_FICHA.map((c) => [c, (o.meses![c] as number[]).map(centavos)])) as Record<CampoFicha, number[]>, decimo: centavos(o.decimo as number) };
}

/** Grava os valores digitados na ficha do ano (cria a ficha se o ano não tiver). Só os meses alterados mudam. */
export function aplicarFichaDigitada(fichas: FichaLida[], ano: number, d: FichaDigitada): FichaLida[] {
  const atual = fichas.find((f) => f.ano === ano);
  const f: FichaLida = atual
    ? { ...atual, linhas: atual.linhas.map((l) => ({ ...l, meses: [...l.meses] })), descontos: (atual.descontos ?? []).map((l) => ({ ...l, meses: [...l.meses] })) }
    : { ano, sistema: "sippes", linhas: [], descontos: [], origem: "manual" };
  const cod = CODIGOS[f.sistema];
  const antes = valoresDaFicha(f);
  const linha = (codigo: string) => {
    const l = lista(f, codigo);
    let x = l.find((y) => y.codigo.trim().toUpperCase() === codigo);
    if (!x) {
      x = { codigo, descricao: DESCRICAO[codigo] ?? codigo, meses: Array(12).fill(0) };
      l.push(x);
    }
    return x;
  };
  const zerar = (codigo: string, i: number) => {
    for (const l of lista(f, codigo)) if (l.codigo.trim().toUpperCase() === codigo) l.meses[i] = 0;
  };
  let mudou = false;
  for (const c of CAMPOS_FICHA) {
    for (let i = 0; i < 12; i++) {
      if (Math.abs(d.meses[c][i]! - antes.meses[c][i]!) < 0.005) continue;
      mudou = true;
      const [principal, ...outros] = cod[c];
      linha(principal!).meses[i] = d.meses[c][i]!;
      for (const o of outros) zerar(o, i);
    }
  }
  if (Math.abs(d.decimo - antes.decimo) >= 0.005) {
    mudou = true;
    // o total do ano vai para dezembro, na 2ª parcela (a análise só usa a soma das parcelas)
    for (let i = 0; i < 12; i++) for (const c of cod.decimo) zerar(c, i);
    if (d.decimo > 0) linha(cod.decimo[0]!).meses[11] = d.decimo;
  }
  if (!mudou && atual) return fichas;
  // linhas que ficaram zeradas saem
  f.linhas = f.linhas.filter((l) => l.meses.some((v) => v));
  f.descontos = (f.descontos ?? []).filter((l) => l.meses.some((v) => v));
  if (!f.descontos.length) delete f.descontos;
  if (atual && f.origem !== "manual") f.editada = true;
  if (!f.linhas.length && !f.descontos?.length) return fichas.filter((x) => x.ano !== ano);
  return [...fichas.filter((x) => x.ano !== ano), f].sort((a, b) => a.ano - b.ano);
}
