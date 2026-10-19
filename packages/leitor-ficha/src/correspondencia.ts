/**
 * Converte as linhas da Ficha Financeira (códigos do SIPPES) nas rubricas do processo (códigos da planilha).
 * A tabela de correspondência fica no banco (correspondencia_rubrica) e pode ser ajustada sem mexer no código.
 */
import type { FichaFinanceira, LinhaFicha } from "./leitor";

export interface Correspondencia {
  /** Código da rubrica no processo, ex.: "A01 - SOLDO" */
  codigoRubrica: string;
  /** Código na ficha do SIPPES, ex.: "NR0001" */
  codigoSippes: string;
}

/**
 * Correspondências confirmadas pelos catálogos oficiais (SIAPPES Tab_pag set/26 × SIPPES "Rubricas disponíveis"),
 * ver tools/rubricas. Z99 (pensão judiciária) ainda sem definição.
 */
export const CORRESPONDENCIA_PADRAO: Correspondencia[] = [
  { codigoRubrica: "A01 - SOLDO", codigoSippes: "NR0001" },
  { codigoRubrica: "A03 - ADIC HAB", codigoSippes: "NR0003" },
  { codigoRubrica: "A14 - ADIC MIL", codigoSippes: "NR0014" },
  { codigoRubrica: "AL0 - ACDM", codigoSippes: "NR0170" },
  { codigoRubrica: "A85 - ADIC NATAL - 2ª P", codigoSippes: "NR0085" },
  { codigoRubrica: "AD2 - ADICIONAL FÉRIAS", codigoSippes: "NR0092" },
  { codigoRubrica: "Z01 - FUSEX", codigoSippes: "ND0001" },
  { codigoRubrica: "Z02 - P MIL 7,5/9,5/10,5%", codigoSippes: "ND0002" },
  { codigoRubrica: "Z02 - P MIL 1,5%", codigoSippes: "ND0005" }, // no SIAPPES é Z05 (rótulo da planilha diz Z02)
  { codigoRubrica: "ZM7 - DESC DEP FUSEX", codigoSippes: "ND0011" },
];

export interface RubricaPosicao { posicao: number; codigo: string }
export interface LancamentoLido { ano: number; mes: number; posicao: number; valor: number; codigosSippes: string[] }

export interface ResultadoCorrespondencia {
  lancamentos: LancamentoLido[];
  /** Linhas da ficha que não foram para nenhuma rubrica (a OM pode escolher incluir). */
  naoUsadas: (LinhaFicha & { ano: number })[];
}

/**
 * @param escolhasExtras códigos do SIPPES que a OM decidiu mandar para uma posição (tela de revisão)
 */
export function aplicarCorrespondencia(
  fichas: FichaFinanceira[],
  rubricas: RubricaPosicao[],
  tabela: Correspondencia[],
  escolhasExtras: Record<string, number> = {},
): ResultadoCorrespondencia {
  const posicaoDoCodigo = new Map(rubricas.filter((r) => r.codigo).map((r) => [r.codigo.trim(), r.posicao]));
  const destino = new Map<string, number>();
  for (const c of tabela) {
    const p = posicaoDoCodigo.get(c.codigoRubrica.trim());
    if (p !== undefined) destino.set(c.codigoSippes, p);
  }
  for (const [sippes, p] of Object.entries(escolhasExtras)) destino.set(sippes, p);

  const soma = new Map<string, LancamentoLido>();
  const naoUsadas: ResultadoCorrespondencia["naoUsadas"] = [];
  for (const f of fichas) {
    if (!f.ano) continue;
    for (const l of f.linhas) {
      const p = destino.get(l.codigo);
      if (p === undefined) {
        if (l.total !== 0) naoUsadas.push({ ...l, ano: f.ano });
        continue;
      }
      l.meses.forEach((v, i) => {
        if (v === 0) return;
        const k = `${f.ano}-${i + 1}-${p}`;
        const atual = soma.get(k) ?? { ano: f.ano!, mes: i + 1, posicao: p, valor: 0, codigosSippes: [] };
        atual.valor = Math.round((atual.valor + v) * 100) / 100;
        if (!atual.codigosSippes.includes(l.codigo)) atual.codigosSippes.push(l.codigo);
        soma.set(k, atual);
      });
    }
  }
  const lancamentos = [...soma.values()].sort((a, b) => a.ano - b.ano || a.mes - b.mes || a.posicao - b.posicao);
  return { lancamentos, naoUsadas };
}

/** Período coberto pelas fichas: de janeiro do 1º ano ao último mês com algum valor. */
export function periodoDasFichas(fichas: FichaFinanceira[]): { inicio: string; fim: string } | null {
  const comAno = fichas.filter((f) => f.ano);
  if (!comAno.length) return null;
  const anoIni = Math.min(...comAno.map((f) => f.ano!));
  let fim = 0;
  for (const f of comAno)
    f.linhas.forEach((l) => l.meses.forEach((v, i) => { if (v !== 0) fim = Math.max(fim, f.ano! * 100 + i + 1); }));
  if (!fim) return null;
  const mm = (n: number) => String(n).padStart(2, "0");
  return { inicio: `${anoIni}-01-01`, fim: `${Math.floor(fim / 100)}-${mm(fim % 100)}-01` };
}
