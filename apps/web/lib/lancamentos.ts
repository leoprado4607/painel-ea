/**
 * Valores mensais de um processo, organizados como ano → mês → posição da rubrica → valor.
 * Funções puras usadas pelas telas de valores recebidos e devidos.
 */
import type { TipoRubrica } from "@painel-ea/engine";

export type Grade = Record<number, Record<number, Record<number, number>>>;
export interface MesAno { ano: number; mes: number }
export interface Linha { ano: number; mes: number; posicao: number; valor: number }

const chave = (m: MesAno) => m.ano * 12 + (m.mes - 1);
const deChave = (k: number): MesAno => ({ ano: Math.floor(k / 12), mes: (k % 12) + 1 });

/** "2016-01-01" → { ano: 2016, mes: 1 } */
export const mesDeData = (d: string): MesAno => ({ ano: Number(d.slice(0, 4)), mes: Number(d.slice(5, 7)) });

/** Todos os meses do período, em ordem. */
export function mesesDoPeriodo(inicio: MesAno, fim: MesAno): MesAno[] {
  const out: MesAno[] = [];
  for (let k = chave(inicio); k <= chave(fim); k++) out.push(deChave(k));
  return out;
}

export const anosDoPeriodo = (inicio: MesAno, fim: MesAno) =>
  Array.from({ length: fim.ano - inicio.ano + 1 }, (_, i) => inicio.ano + i);

export function gradeDeLinhas(linhas: Linha[]): Grade {
  const g: Grade = {};
  for (const l of linhas) ((g[l.ano] ??= {})[l.mes] ??= {})[l.posicao] = Number(l.valor);
  return g;
}

export function linhasDaGrade(g: Grade): Linha[] {
  const out: Linha[] = [];
  for (const [ano, meses] of Object.entries(g))
    for (const [mes, pos] of Object.entries(meses))
      for (const [posicao, valor] of Object.entries(pos)) out.push({ ano: +ano, mes: +mes, posicao: +posicao, valor });
  return out;
}

export const valoresDoMes = (g: Grade, m: MesAno): Record<number, number> => g[m.ano]?.[m.mes] ?? {};

export function definirValor(g: Grade, m: MesAno, posicao: number, valor: number | null): Grade {
  const novo: Grade = structuredClone(g);
  const mes = ((novo[m.ano] ??= {})[m.mes] ??= {});
  if (valor === null || valor === 0) delete mes[posicao];
  else mes[posicao] = valor;
  return novo;
}

/** Copia todos os valores de um mês para outro (substitui o destino). */
export function copiarMes(g: Grade, de: MesAno, para: MesAno): Grade {
  const novo: Grade = structuredClone(g);
  (novo[para.ano] ??= {})[para.mes] = { ...valoresDoMes(g, de) };
  return novo;
}

/** Repete os valores do mês de origem em todos os meses seguintes, até `ate` (inclusive). */
export function repetirAte(g: Grade, origem: MesAno, ate: MesAno): Grade {
  let novo = g;
  for (let k = chave(origem) + 1; k <= chave(ate); k++) novo = copiarMes(novo, origem, deChave(k));
  return novo;
}

/** Receitas − despesas do mês (como a linha "TOTAL C/CHEQUE"); rubrica sem código ou tipo "-" não entra. */
export function totalDoMes(valores: Record<number, number>, rubricas: { posicao: number; codigo: string; tipo: TipoRubrica }[]): number {
  let t = 0;
  for (const r of rubricas) {
    if (!r.codigo) continue;
    const v = valores[r.posicao] ?? 0;
    if (r.tipo === "Receita") t += v;
    else if (r.tipo === "Despesa") t -= v;
  }
  return Math.round(t * 100) / 100;
}

/** O que gravar no banco: linhas novas ou alteradas, e linhas que deixaram de existir. */
export function diferencas(original: Linha[], atual: Linha[]) {
  const id = (l: Linha) => `${l.ano}-${l.mes}-${l.posicao}`;
  const antes = new Map(original.map((l) => [id(l), Number(l.valor)]));
  const depois = new Map(atual.map((l) => [id(l), l]));
  return {
    gravar: atual.filter((l) => antes.get(id(l)) !== l.valor),
    apagar: original.filter((l) => !depois.has(id(l))).map(({ ano, mes, posicao }) => ({ ano, mes, posicao })),
  };
}
