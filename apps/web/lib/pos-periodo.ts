/**
 * Valores recebidos depois do período da dívida (decisão de 22/10/2026): o operador informa ano, mês e valor na aba
 * Contracheque - F Financeira. Ficam em processo.complementos.recebidosPosPeriodo (não em lancamento, onde valores
 * fora do período são ignorados de propósito) e entram no cálculo como recebidos da rubrica escolhida.
 */
import type { RecebidoPosPeriodo } from "@painel-ea/documentos";

export type { RecebidoPosPeriodo };

const chave = (ano: number, mes: number) => ano * 12 + mes;

/** Lista guardada, só com itens válidos (ano/mês/posição inteiros e valor numérico). */
export function recebidosPosPeriodo(complementos: { recebidosPosPeriodo?: unknown } | null | undefined): RecebidoPosPeriodo[] {
  const lista = complementos?.recebidosPosPeriodo;
  if (!Array.isArray(lista)) return [];
  return lista.flatMap((x) => {
    const r = x as Partial<RecebidoPosPeriodo>;
    const ok = Number.isInteger(r.ano) && Number.isInteger(r.mes) && r.mes! >= 1 && r.mes! <= 12
      && Number.isInteger(r.posicao) && r.posicao! >= 1 && r.posicao! <= 17 && Number.isFinite(Number(r.valor));
    return ok ? [{ ano: r.ano!, mes: r.mes!, posicao: r.posicao!, valor: Number(r.valor) }] : [];
  });
}

/** Erro de um item em relação ao fim do período (ou null): precisa ser depois do fim e ter valor maior que zero. */
export function erroPosPeriodo(r: RecebidoPosPeriodo, fim: { ano: number; mes: number }): string | null {
  if (!(r.ano >= 2000 && r.ano <= 2100)) return "Informe o ano.";
  if (chave(r.ano, r.mes) <= chave(fim.ano, fim.mes)) return "O mês precisa ser depois do fim do período da dívida.";
  if (!(r.valor > 0)) return "Informe um valor maior que zero.";
  return null;
}
