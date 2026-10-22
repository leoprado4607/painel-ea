import { arredondar, dinheiro, somar } from "./arredondamento";
import { calcularTabelaAcumulada, type IndiceMensal, type TabelaAcumulada } from "./indices";

export type TipoRubrica = "Receita" | "Despesa" | "-";

export interface Rubrica {
  /** Ex.: "A01 - SOLDO". Vazio = posição sem rubrica. */
  codigo: string;
  tipo: TipoRubrica;
}

/** 12 valores (jan…dez); `null` ou ausente = não lançado (conta como 0). */
export type ValoresMensais = readonly (number | null)[];
/** ano → posição da rubrica (1…17) → valores do ano. */
export type Lancamentos = Readonly<Record<number | string, Readonly<Record<number | string, ValoresMensais>>>>;

export interface EntradaCalculo {
  indices: readonly IndiceMensal[];
  /** As 17 posições da aba "Códigos Lançamento", na ordem. */
  rubricas: readonly Rubrica[];
  /** "Contracheque - F Financeira" */
  recebido: Lancamentos;
  /** "Lançar Valor Devido" */
  devido: Lancamentos;
  /** Anos calculados (padrão: 2006…2028, como na planilha). */
  anos?: readonly number[];
  /**
   * Primeiro ano somado nos totais gerais de "Códigos-Anos" (colunas AA/AB), que alimentam a CPEX.
   * A planilha soma de 2008 em diante (decisão: manter assim).
   */
  anoInicialTotaisCpex?: number;
  /**
   * "planilha" (padrão): como a planilha original ("Precisão conforme exibido"), cada valor corrigido e cada
   * subtotal é arredondado a 2 casas antes de entrar na soma seguinte.
   * "total": soma tudo com todas as casas e arredonda só o que é exibido (decisão de 22/10/2026, para bater
   * com a planilha de conferência usada fora do sistema). Nesse modo o índice acumulado também entra com todas
   * as casas (não cortado em 0,0000%).
   */
  arredondamento?: "planilha" | "total";
}

export const POSICOES = 17;
export const ANOS_PADRAO: readonly number[] = Array.from({ length: 23 }, (_, i) => 2006 + i);
/** Posições 1–12 contam como receita e 13–17 como despesa nos totais por posição de "Códigos-Anos". */
const ULTIMA_POSICAO_RECEITA = 12;

type Matriz = number[][]; // [posição 0..16][mês 0..11]

export interface ResultadoAno {
  ano: number;
  /** Acumulado do IPCA (fração) de cada mês. */
  acumuladoMes: number[];
  recebido: Matriz;
  devido: Matriz;
  recebidoCorrigido: Matriz;
  devidoCorrigido: Matriz;
  /** Devido corrigido − recebido corrigido. */
  liquidoCorrigido: Matriz;
  /** Totais do ano por posição (coluna TOTAL). */
  recebidoCorrigidoAno: number[];
  devidoCorrigidoAno: number[];
  liquidoCorrigidoAno: number[];
  /** Linha "TOTAL C/CHEQUE" (receitas − despesas) por mês, e sua soma no ano. */
  totalRecebidoMes: number[];
  totalDevidoMes: number[];
  totalRecebidoCorrigidoMes: number[];
  totalRecebidoCorrigidoAno: number;
  totalDevidoCorrigidoMes: number[];
  totalDevidoCorrigidoAno: number;
  totalLiquidoMes: number[];
  totalLiquidoAno: number;
  /** Valor_Líquido_Corrigido: receitas (P), despesas (P) e saldo do ano. */
  liquidoReceitas: number;
  liquidoDespesas: number;
  liquidoSaldo: number;
  /** "Solicitação NN Verso": por posição e linha TOTAL. */
  verso: {
    devido: number[]; recebido: number[]; diferenca: number[]; corrigido: number[];
    total: { devido: number; recebido: number; diferenca: number; corrigido: number };
  };
  /** "Solicitação NN": importância básica (ROUND(total corrigido; 2)). */
  importanciaBasica: number;
}

export interface SecaoCodigosAnos {
  /** ano → valor por posição */
  porAno: Record<number, number[]>;
  /** ano → total por posição fixa (posições 1–12 menos 13–17) */
  totalPosicionalPorAno: Record<number, number>;
  /** Total por posição dos anos ≥ anoInicialTotaisCpex (coluna AA). */
  totalPeriodo: number[];
  receitas: number; despesas: number; saldo: number;
}

export interface ResultadoCalculo {
  tabela: TabelaAcumulada;
  anos: ResultadoAno[];
  porAno: Record<number, ResultadoAno>;
  codigosAnos: {
    recebidoSemCorrecao: SecaoCodigosAnos;
    devidoSemCorrecao: SecaoCodigosAnos;
    diferencaSemCorrecao: SecaoCodigosAnos;
    diferencaComCorrecao: SecaoCodigosAnos;
  };
  cpex: {
    semCorrecao: number[]; comCorrecao: number[];
    totalSemCorrecao: number; totalComCorrecao: number;
    importanciaBasicaTotalCorrigida: number;
    /** Valor corrigido da posição 16 (Z99 - Pensão Judiciária no padrão). */
    valorCorrigidoPensaoJudicial: number;
  };
  recapitulacao: {
    porAno: Record<number, { receitas: number; despesas: number; saldo: number }>;
    receitas: number; despesas: number; saldo: number;
  };
  /** Texto "Z01 - FUSEX / Z02 - … / " (Lista_Suspensa!C15). */
  despesasCompactadas: string;
}

const tipoEfetivo = (r: Rubrica | undefined): string => (r && r.codigo ? r.tipo.toUpperCase() : "");

function valoresDe(l: Lancamentos, ano: number, posicao: number): number[] {
  const v = l[ano]?.[posicao] ?? [];
  return Array.from({ length: 12 }, (_, m) => dinheiro(v[m] ?? 0));
}

/** SUMIFS(valores; tipos; "RECEITA") − SUMIFS(valores; tipos; "DESPESA") */
function somaPorTipo(valores: readonly number[], tipos: readonly string[], tipo: string): number {
  return somar(valores.filter((_, i) => tipos[i] === tipo));
}
const saldoPorTipo = (valores: readonly number[], tipos: readonly string[]) =>
  somaPorTipo(valores, tipos, "RECEITA") - somaPorTipo(valores, tipos, "DESPESA");

const colunaMes = (m: Matriz, mes: number) => m.map((linha) => linha[mes]!);

export function calcular(entrada: EntradaCalculo): ResultadoCalculo {
  const anos = entrada.anos ?? ANOS_PADRAO;
  const anoCpex = entrada.anoInicialTotaisCpex ?? 2008;
  const soNoTotal = entrada.arredondamento === "total";
  // valor intermediário: com todas as casas no modo "total"; a 2 casas no modo da planilha
  const c = soNoTotal ? (x: number) => x : dinheiro;
  const tabela = calcularTabelaAcumulada(entrada.indices, soNoTotal);
  const rubricas = Array.from({ length: POSICOES }, (_, i) => entrada.rubricas[i]);
  const tipos = rubricas.map(tipoEfetivo);

  const resultados = anos.map((ano): ResultadoAno => {
    const acumuladoMes = Array.from({ length: 12 }, (_, m) => tabela.acumulado(ano, m + 1));
    const recebido = rubricas.map((_, p) => valoresDe(entrada.recebido, ano, p + 1));
    const devido = rubricas.map((_, p) => valoresDe(entrada.devido, ano, p + 1));
    const corrigir = (m: Matriz) => m.map((linha) => linha.map((v, i) => c(v * acumuladoMes[i]! + v)));
    const recebidoCorrigido = corrigir(recebido);
    const devidoCorrigido = corrigir(devido);
    const liquidoCorrigido = devidoCorrigido.map((linha, p) => linha.map((v, m) => c(v - recebidoCorrigido[p]![m]!)));
    const totalLinha = (m: Matriz) => m.map((linha) => c(somar(linha)));
    const totalMes = (m: Matriz) => Array.from({ length: 12 }, (_, i) => c(saldoPorTipo(colunaMes(m, i), tipos)));

    const totalRecebidoMes = totalMes(recebido);
    const totalDevidoMes = totalMes(devido);
    const totalRecebidoCorrigidoMes = totalMes(recebidoCorrigido);
    const totalDevidoCorrigidoMes = totalMes(devidoCorrigido);
    const totalLiquidoMes = totalMes(liquidoCorrigido);
    const liquidoCorrigidoAno = totalLinha(liquidoCorrigido);
    const liquidoReceitas = c(somaPorTipo(liquidoCorrigidoAno, tipos, "RECEITA"));
    const liquidoDespesas = c(somaPorTipo(liquidoCorrigidoAno, tipos, "DESPESA"));

    const vDevido = totalLinha(devido);
    const vRecebido = totalLinha(recebido);
    const totalDevidoAnoSemCorrecao = c(somar(totalDevidoMes));
    const totalRecebidoAnoSemCorrecao = c(somar(totalRecebidoMes));
    const totalLiquidoAno = c(somar(totalLiquidoMes));

    return {
      ano, acumuladoMes, recebido, devido, recebidoCorrigido, devidoCorrigido, liquidoCorrigido,
      recebidoCorrigidoAno: totalLinha(recebidoCorrigido),
      devidoCorrigidoAno: totalLinha(devidoCorrigido),
      liquidoCorrigidoAno,
      totalRecebidoMes, totalDevidoMes,
      totalRecebidoCorrigidoMes, totalRecebidoCorrigidoAno: c(somar(totalRecebidoCorrigidoMes)),
      totalDevidoCorrigidoMes, totalDevidoCorrigidoAno: c(somar(totalDevidoCorrigidoMes)),
      totalLiquidoMes, totalLiquidoAno,
      liquidoReceitas, liquidoDespesas, liquidoSaldo: c(liquidoReceitas - liquidoDespesas),
      verso: {
        devido: vDevido,
        recebido: vRecebido,
        diferenca: vDevido.map((d, p) => c(d - vRecebido[p]!)),
        corrigido: liquidoCorrigidoAno,
        total: {
          devido: totalDevidoAnoSemCorrecao,
          recebido: totalRecebidoAnoSemCorrecao,
          diferenca: c(totalDevidoAnoSemCorrecao - totalRecebidoAnoSemCorrecao),
          corrigido: totalLiquidoAno,
        },
      },
      importanciaBasica: arredondar(totalLiquidoAno, 2),
    };
  });
  const porAno = Object.fromEntries(resultados.map((r) => [r.ano, r])) as Record<number, ResultadoAno>;

  const secao = (valor: (r: ResultadoAno) => number[]): SecaoCodigosAnos => {
    const s: Record<number, number[]> = {};
    const totalPosicional: Record<number, number> = {};
    for (const r of resultados) {
      const v = valor(r);
      s[r.ano] = v;
      totalPosicional[r.ano] = c(somar(v.slice(0, ULTIMA_POSICAO_RECEITA)) - somar(v.slice(ULTIMA_POSICAO_RECEITA)));
    }
    const doPeriodo = resultados.filter((r) => r.ano >= anoCpex);
    const totalPeriodo = rubricas.map((_, p) => c(somar(doPeriodo.map((r) => s[r.ano]![p]!))));
    const receitas = c(somaPorTipo(totalPeriodo, tipos, "RECEITA"));
    const despesas = c(somaPorTipo(totalPeriodo, tipos, "DESPESA"));
    return { porAno: s, totalPosicionalPorAno: totalPosicional, totalPeriodo, receitas, despesas,
      saldo: c(saldoPorTipo(totalPeriodo, tipos)) };
  };
  const recebidoSemCorrecao = secao((r) => r.verso.recebido);
  const devidoSemCorrecao = secao((r) => r.verso.devido);
  const diferencaSemCorrecao = secao((r) =>
    r.verso.devido.map((d, p) => c(d - recebidoSemCorrecao.porAno[r.ano]![p]!)));
  const diferencaComCorrecao = secao((r) => r.liquidoCorrigidoAno);

  const semCorrecao = diferencaSemCorrecao.totalPeriodo;
  const comCorrecao = diferencaComCorrecao.totalPeriodo;
  const totalComCorrecao = c(saldoPorTipo(comCorrecao, tipos));

  const recapPorAno = Object.fromEntries(resultados.map((r) => [r.ano, {
    receitas: r.liquidoReceitas, despesas: r.liquidoDespesas,
    saldo: c(r.liquidoReceitas - r.liquidoDespesas),
  }]));
  const recapReceitas = c(somar(resultados.map((r) => r.liquidoReceitas)));
  const recapDespesas = c(somar(resultados.map((r) => r.liquidoDespesas)));

  // Lista_Suspensa!C15 concatena as posições 13…17 e depois 12…1.
  const ordemCompactada = [13, 14, 15, 16, 17, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
  const despesasCompactadas = ordemCompactada
    .map((p) => rubricas[p - 1])
    .map((r) => (r && r.codigo && r.tipo === "Despesa" ? `${r.codigo} / ` : ""))
    .join("");

  const resultado: ResultadoCalculo = {
    tabela, anos: resultados, porAno,
    codigosAnos: { recebidoSemCorrecao, devidoSemCorrecao, diferencaSemCorrecao, diferencaComCorrecao },
    cpex: {
      semCorrecao, comCorrecao,
      totalSemCorrecao: c(saldoPorTipo(semCorrecao, tipos)),
      totalComCorrecao,
      importanciaBasicaTotalCorrigida: totalComCorrecao,
      valorCorrigidoPensaoJudicial: comCorrecao[15]!,
    },
    recapitulacao: {
      porAno: recapPorAno, receitas: recapReceitas, despesas: recapDespesas,
      saldo: c(recapReceitas - recapDespesas),
    },
    despesasCompactadas,
  };
  if (!soNoTotal) return resultado;
  // modo "total": tudo o que sai (valores corrigidos, subtotais e totais) é arredondado uma vez só, a partir das somas exatas
  const anosArredondados = resultados.map((r) => ({ ...arredondarValores(r), ano: r.ano, acumuladoMes: r.acumuladoMes }));
  return {
    ...arredondarValores({ ...resultado, tabela: undefined, anos: undefined, porAno: undefined }),
    tabela, anos: anosArredondados,
    porAno: Object.fromEntries(anosArredondados.map((r) => [r.ano, r])),
    despesasCompactadas,
  } as ResultadoCalculo;
}

/** Arredonda a 2 casas todos os números de uma estrutura (listas e objetos aninhados). */
function arredondarValores<T>(v: T): T {
  if (typeof v === "number") return dinheiro(v) as T;
  if (Array.isArray(v)) return v.map(arredondarValores) as T;
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, arredondarValores(x)])) as T;
  return v;
}



/** Informações!H32: quantidade de meses da dívida (início e fim inclusive). */
export function quantidadeMeses(inicio: { ano: number; mes: number }, fim: { ano: number; mes: number }): number {
  return (fim.ano - inicio.ano) * 12 + (fim.mes - inicio.mes) + 1;
}
