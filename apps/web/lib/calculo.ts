import { ANOS_PADRAO, POSICOES, type EntradaCalculo, type IndiceMensal, type Rubrica } from "@painel-ea/engine";

interface LinhaLanc { tipo: "recebido" | "devido"; ano: number; mes: number; posicao: number; valor: number }

/**
 * Monta a entrada do motor a partir do banco: rubricas do processo, lançamentos e a série composta
 * (view indice_composto). Anos: 2006 até o maior entre 2028 e o último ano com lançamento, como na planilha.
 */
export function montarEntrada(
  rubricas: { posicao: number; codigo: string; tipo: Rubrica["tipo"] }[],
  lancamentos: LinhaLanc[],
  indices: { ano: number; mes: number; percentual: number | string }[],
): EntradaCalculo {
  const ultimoAno = Math.max(ANOS_PADRAO[ANOS_PADRAO.length - 1]!, ...lancamentos.map((l) => l.ano));
  const anos = Array.from({ length: ultimoAno - 2006 + 1 }, (_, i) => 2006 + i);

  const porPosicao = new Map(rubricas.map((r) => [r.posicao, r]));
  const rubs: Rubrica[] = Array.from({ length: POSICOES }, (_, i) => {
    const r = porPosicao.get(i + 1);
    return { codigo: r?.codigo ?? "", tipo: r?.tipo ?? "Receita" };
  });

  const recebido: Record<number, Record<number, (number | null)[]>> = {};
  const devido: Record<number, Record<number, (number | null)[]>> = {};
  for (const l of lancamentos) {
    const alvo = l.tipo === "recebido" ? recebido : devido;
    ((alvo[l.ano] ??= {})[l.posicao] ??= Array(12).fill(null))[l.mes - 1] = Number(l.valor);
  }

  // série completa até dezembro do último ano: meses sem índice publicado entram com fator 1
  const conhecidos = new Map(indices.map((i) => [i.ano * 100 + i.mes, Number(i.percentual)]));
  const primeiro = indices.reduce((m, i) => Math.min(m, i.ano * 100 + i.mes), 200010);
  const serie: IndiceMensal[] = [];
  for (let a = Math.floor(primeiro / 100); a <= ultimoAno; a++)
    for (let m = 1; m <= 12; m++) {
      if (a * 100 + m < primeiro) continue;
      serie.push({ ano: a, mes: m, percentual: conhecidos.get(a * 100 + m) ?? null });
    }

  return { indices: serie, rubricas: rubs, recebido, devido, anos };
}
