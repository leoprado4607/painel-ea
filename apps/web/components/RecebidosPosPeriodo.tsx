"use client";
import { lerReais } from "@/lib/dinheiro";
import type { MesAno } from "@/lib/lancamentos";
import { erroPosPeriodo, type RecebidoPosPeriodo } from "@/lib/pos-periodo";
import { MESES, MESES_CURTOS } from "@/lib/tipos";

/** Linha em edição: ano e valor como texto digitado. */
export interface LinhaPosPeriodo { id: number; ano: string; mes: number; posicao: number; valor: string }

/** Linha → item gravável, ou o erro dela. */
export function itemDaLinha(l: LinhaPosPeriodo, fim: MesAno): { item?: RecebidoPosPeriodo; erro?: string } {
  const valor = lerReais(l.valor) ?? 0;
  if (Number.isNaN(valor)) return { erro: "Valor inválido. Use o formato 1.234,56." };
  const item = { ano: Number(l.ano), mes: l.mes, posicao: l.posicao, valor };
  const erro = erroPosPeriodo(item, fim);
  return erro ? { erro } : { item };
}

/**
 * Card de anos/meses (Contracheque - F Financeira): valores recebidos DEPOIS do período da dívida (ano, mês e valor).
 * Entram no cálculo como recebidos da rubrica de receita escolhida, corrigidos pelo índice do mês em que foram pagos.
 */
export function RecebidosPosPeriodo({ linhas, setLinhas, fim, receitas, bloqueado, erros }: {
  linhas: LinhaPosPeriodo[];
  setLinhas: (f: (l: LinhaPosPeriodo[]) => LinhaPosPeriodo[]) => void;
  fim: MesAno;
  receitas: { posicao: number; codigo: string }[];
  bloqueado: boolean;
  erros: Record<number, string>;
}) {
  const proximo = fim.mes === 12 ? { ano: fim.ano + 1, mes: 1 } : { ano: fim.ano, mes: fim.mes + 1 };
  const alterar = (id: number, campo: Partial<LinhaPosPeriodo>) => setLinhas((l) => l.map((x) => (x.id === id ? { ...x, ...campo } : x)));
  return (
    <div className="space-y-2 border-t border-borda pt-3">
      <div>
        <h3 className="text-sm font-semibold">Recebido após o período da dívida</h3>
        <p className="ajuda mt-0">
          Valores pagos depois de {MESES_CURTOS[fim.mes - 1]}/{fim.ano} (fim do período). Entram no cálculo como recebidos,
          corrigidos pelo índice do mês do pagamento.
        </p>
      </div>
      {linhas.length > 0 && (
        <ul className="space-y-2" aria-label="Recebidos após o período">
          {linhas.map((l, i) => (
            <li key={l.id}>
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label htmlFor={`pp-ano-${l.id}`} className="rotulo text-xs">Ano</label>
                  <input id={`pp-ano-${l.id}`} inputMode="numeric" maxLength={4} disabled={bloqueado} value={l.ano}
                    onChange={(e) => alterar(l.id, { ano: e.target.value.replace(/\D/g, "") })}
                    className="entrada w-[5.5rem] text-center tabular-nums" />
                </div>
                <div>
                  <label htmlFor={`pp-mes-${l.id}`} className="rotulo text-xs">Mês</label>
                  <select id={`pp-mes-${l.id}`} disabled={bloqueado} value={l.mes} onChange={(e) => alterar(l.id, { mes: Number(e.target.value) })}
                    className="entrada w-auto">
                    {MESES.map((m, k) => <option key={m} value={k + 1}>{m}</option>)}
                  </select>
                </div>
                {receitas.length > 1 && (
                  <div className="w-full sm:w-64">
                    <label htmlFor={`pp-rub-${l.id}`} className="rotulo text-xs">Rubrica</label>
                    <select id={`pp-rub-${l.id}`} disabled={bloqueado} value={l.posicao} onChange={(e) => alterar(l.id, { posicao: Number(e.target.value) })}
                      className="entrada">
                      {receitas.map((r) => <option key={r.posicao} value={r.posicao}>{r.codigo}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label htmlFor={`pp-valor-${l.id}`} className="rotulo text-xs">Valor</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-2 text-sm text-suave">R$</span>
                    <input id={`pp-valor-${l.id}`} inputMode="decimal" disabled={bloqueado} value={l.valor} placeholder="0,00"
                      onChange={(e) => alterar(l.id, { valor: e.target.value })} aria-invalid={!!erros[l.id]}
                      className={`entrada w-36 pl-9 text-right tabular-nums ${erros[l.id] ? "entrada-erro" : ""}`} />
                  </div>
                </div>
                {!bloqueado && (
                  <button type="button" className="botao-sec py-2 text-red-800 hover:border-red-300 hover:bg-red-50"
                    aria-label={`Remover o recebido ${i + 1} após o período`} onClick={() => setLinhas((x) => x.filter((y) => y.id !== l.id))}>
                    Remover
                  </button>
                )}
              </div>
              {erros[l.id] && <p className="erro">{erros[l.id]}</p>}
            </li>
          ))}
        </ul>
      )}
      {!bloqueado && (receitas.length ? (
        <button type="button" className="botao-sec py-1.5"
          onClick={() => setLinhas((x) => [...x, { id: Math.max(0, ...x.map((y) => y.id)) + 1, ano: String(proximo.ano), mes: proximo.mes, posicao: receitas[0]!.posicao, valor: "" }])}>
          + Adicionar recebido após o período
        </button>
      ) : <p className="ajuda">Defina uma rubrica de receita em Códigos lançamento para informar recebidos após o período.</p>)}
    </div>
  );
}
