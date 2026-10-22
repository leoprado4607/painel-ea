import { arredondar } from "./arredondamento";

export interface IndiceMensal {
  ano: number;
  /** 1 = janeiro … 12 = dezembro */
  mes: number;
  /** Variação mensal em % (ex.: 0.44 para 0,44%). `null` = mês ainda sem índice. */
  percentual: number | null;
}

export interface LinhaIndice extends IndiceMensal {
  /** Coluna C: 1 + percentual/100 (6 casas). */
  calculo: number;
  /** Coluna D: produto dos fatores deste mês até o último (13 casas). */
  fator: number;
  /** Coluna E: fator − 1, em fração (formato 0,0000% → 6 casas). É o "acumulado" usado na correção. */
  acumulado: number;
  /** Coluna F: 100 × acumulado + 100 (2 casas). */
  numeroIndice: number;
}

export interface TabelaAcumulada {
  linhas: LinhaIndice[];
  /** Último mês com índice informado ("Atualizado até"), ou null se não houver nenhum. */
  atualizadoAte: { ano: number; mes: number } | null;
  /** Acumulado (fração) do mês; meses fora da tabela ou depois do último índice valem 0. */
  acumulado(ano: number, mes: number): number;
}

const chave = (ano: number, mes: number) => ano * 100 + mes;

/**
 * Reproduz a aba "Cálculo do Acumulado". Com `todasAsCasas`, o acumulado usado na correção é o produto dos
 * fatores sem cortes (decisão de 22/10/2026); sem ele, como a planilha: fator com 13 casas e acumulado com 6
 * (0,0000%). As colunas exibidas (fator, número-índice) seguem com as casas da planilha.
 */
export function calcularTabelaAcumulada(indices: readonly IndiceMensal[], todasAsCasas = false): TabelaAcumulada {
  const ordenados = [...indices].sort((a, b) => chave(a.ano, a.mes) - chave(b.ano, b.mes));
  const linhas: LinhaIndice[] = new Array(ordenados.length);
  let fatorSeguinte = 1; // D998 = 1
  let fatorExatoSeguinte = 1;
  for (let i = ordenados.length - 1; i >= 0; i--) {
    const ind = ordenados[i]!;
    const calculo = arredondar((ind.percentual ?? 0) / 100 + 1, 6);
    const fator = arredondar(fatorSeguinte * calculo, 13);
    const fatorExato = fatorExatoSeguinte * ((ind.percentual ?? 0) / 100 + 1);
    const acumulado = todasAsCasas ? fatorExato - 1 : arredondar(fator - 1, 6);
    linhas[i] = { ...ind, calculo, fator, acumulado, numeroIndice: arredondar(100 * acumulado + 100, 2) };
    fatorSeguinte = fator;
    fatorExatoSeguinte = fatorExato;
  }
  const porMes = new Map(linhas.map((l) => [chave(l.ano, l.mes), l.acumulado]));
  const comIndice = ordenados.filter((l) => l.percentual !== null);
  const ultimo = comIndice[comIndice.length - 1];
  return {
    linhas,
    atualizadoAte: ultimo ? { ano: ultimo.ano, mes: ultimo.mes } : null,
    acumulado: (ano, mes) => porMes.get(chave(ano, mes)) ?? 0,
  };
}

/** Alerta da planilha ("ATENÇÃO VALOR ACIMA DO NORMAL") para um índice mensal digitado. */
export const indiceAcimaDoNormal = (percentual: number): boolean => percentual > 1.99;
