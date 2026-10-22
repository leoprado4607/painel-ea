import { ANOS_PADRAO, POSICOES, type EntradaCalculo, type IndiceMensal, type Rubrica } from "@painel-ea/engine";
import type { RecebidoPosPeriodo } from "./pos-periodo";

interface LinhaLanc { tipo: "recebido" | "devido"; ano: number; mes: number; posicao: number; valor: number }

/**
 * Monta a entrada do motor a partir do banco: rubricas do processo, lançamentos e a série composta
 * (view indice_composto). Anos: 2006 até o maior entre 2028 e o último ano com lançamento, como na planilha.
 * Com o período da dívida, só entram os lançamentos desses meses: os de fora não aparecem nas abas de valores
 * e não podem pesar no cálculo (ex.: período corrigido de 06/2026 para 06/2021 deixava os valores de 2026 gravados).
 * Os recebidos informados como "após o período" (complementos) entram somados ao recebido do mês e da rubrica deles.
 */
export function montarEntrada(
  rubricas: { posicao: number; codigo: string; tipo: Rubrica["tipo"] }[],
  todos: LinhaLanc[],
  indices: { ano: number; mes: number; percentual: number | string }[],
  periodo?: { inicio: string | null; fim: string | null; posPeriodo?: RecebidoPosPeriodo[] },
): EntradaCalculo {
  const mes = (d: string | null | undefined) => (d && /^\d{4}-\d{2}/.test(d) ? Number(d.slice(0, 4)) * 12 + Number(d.slice(5, 7)) : null);
  const ini = mes(periodo?.inicio), fim = mes(periodo?.fim);
  const lancamentos = ini !== null && fim !== null
    ? todos.filter((l) => l.ano * 12 + l.mes >= ini && l.ano * 12 + l.mes <= fim)
    : todos;
  // recebidos após o período: só os de depois do fim (o resto é ignorado, como os lançamentos fora do período)
  const posPeriodo = (periodo?.posPeriodo ?? []).filter((r) => fim === null || r.ano * 12 + r.mes > fim);
  const ultimoAno = Math.max(ANOS_PADRAO[ANOS_PADRAO.length - 1]!, ...lancamentos.map((l) => l.ano), ...posPeriodo.map((r) => r.ano));
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
  for (const r of posPeriodo) {
    const linha = ((recebido[r.ano] ??= {})[r.posicao] ??= Array(12).fill(null));
    linha[r.mes - 1] = Math.round(((linha[r.mes - 1] ?? 0) + r.valor) * 100) / 100;
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

  // soma com todas as casas e arredonda só os totais (decisão de 22/10/2026; a planilha original arredondava mês a mês)
  return { indices: serie, rubricas: rubs, recebido, devido, anos, arredondamento: "total" };
}
