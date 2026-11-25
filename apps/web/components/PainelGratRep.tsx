"use client";
import type { LeituraGuardada } from "@/lib/processo-completo";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Aviso } from "@/components/Aviso";
import { salvarGratRep } from "@/lib/acoes/grat-rep";
import { formatarReais, lerReais } from "@/lib/dinheiro";
import type { DadosGratRep, PlanoGratRep } from "@/lib/grat-rep";
import { categoriaSoldo, SOLDOS } from "@/lib/soldos";
import { MESES_CURTOS } from "@/lib/tipos";

const br = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

/**
 * "Lançar valor devido" da Gratificação de Representação automática (lib/grat-rep): dados do evento e da autorização,
 * lançamentos de Grat Rep das fichas (o operador marca os que são deste evento), cálculo, alertas e textos do verso.
 */
export function PainelGratRep({ processoId, dados, plano, inicio, fim, bloqueado }: {
  processoId: string; dados: DadosGratRep; plano: PlanoGratRep; inicio: string; fim: string; bloqueado: boolean;
  /** O que veio do processo completo, quando o cálculo começou por ele. */
  leitura?: LeituraGuardada | null;
}) {
  const router = useRouter();
  const [d, setD] = useState<DadosGratRep>(dados);
  const [valorAut, setValorAut] = useState(dados.autorizacao?.valor != null ? formatarReais(dados.autorizacao.valor) : "");
  const [usarTextos, setUsarTextos] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [salvando, iniciar] = useTransition();
  const aut = d.autorizacao ?? {};
  const mudarAut = (campo: Partial<NonNullable<DadosGratRep["autorizacao"]>>) => setD((x) => ({ ...x, autorizacao: { ...x.autorizacao, ...campo } }));
  const mudarEvento = (campo: Partial<NonNullable<DadosGratRep["evento"]>>) => setD((x) => ({ ...x, evento: { ...x.evento, ...campo } }));
  const marcados = new Set(d.considerados ?? []);
  const marcar = (chave: string, sim: boolean) =>
    setD((x) => ({ ...x, considerados: sim ? [...(x.considerados ?? []), chave] : (x.considerados ?? []).filter((c) => c !== chave) }));

  const salvar = () => iniciar(async () => {
    const valor = lerReais(valorAut);
    if (Number.isNaN(valor)) return setMsg({ tipo: "erro", texto: "Valor autorizado inválido. Use o formato 1.234,56." });
    const r = await salvarGratRep(processoId, { ...d, autorizacao: { ...aut, valor } }, usarTextos);
    if (r.erro) return setMsg({ tipo: "erro", texto: r.erro });
    setMsg({ tipo: "ok", texto: "Dados salvos e cálculo refeito." });
    setUsarTextos(false);
    router.refresh();
  });

  const sugerida = plano.categoriaSugerida && plano.categoria ? categoriaSoldo(plano.categoria) : null;
  const linha = (rotulo: string, valor: string) => (
    <div className="flex justify-between gap-3 border-b border-borda py-1.5 text-sm last:border-0">
      <span className="text-suave">{rotulo}</span><span className="text-right font-semibold tabular-nums">{valor}</span>
    </div>
  );
  return (
    <section className="cartao space-y-5" aria-labelledby="grat-rep-titulo">
      <div>
        <h2 id="grat-rep-titulo" className="text-lg font-semibold">Gratificação de Representação: cálculo automático</h2>
        <p className="ajuda mt-1">
          Soldo do posto/graduação na data do fato (tabela de soldos) × 2% por dia, pelos dias corridos de {br(inicio)} a {br(fim)}, inclusive o de
          saída (se até 16h00) e o de retorno (se às 08h00 ou depois). Todo o valor vai para o mês de início, na rubrica A62 - GRAT REP 2%.
          Os dados vêm do período da dívida (Informações) e das fichas financeiras; complete abaixo o que não está nelas.
        </p>
      </div>


      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <h3 className="rotulo-secao">Cálculo</h3>
          {linha("Posto/graduação na data do fato", plano.categoria ? `${categoriaSoldo(plano.categoria)!.nome}${plano.categoriaSugerida ? " (sugerido)" : ""}` : "—")}
          {linha("Soldo base", plano.soldo !== null ? `R$ ${formatarReais(plano.soldo)}` : "—")}
          {plano.soldoFicha !== null && linha("Soldo na ficha (NR0001) no mês do fato", `R$ ${formatarReais(plano.soldoFicha)}`)}
          {linha("Valor diário (2%)", plano.valorDiario !== null ? `R$ ${formatarReais(plano.valorDiario)}` : "—")}
          {linha("Dias", String(plano.dias))}
          {linha("Devido", plano.devido !== null ? `R$ ${formatarReais(plano.devido)}` : "—")}
          {linha("Competência", `${MESES_CURTOS[plano.competencia.mes - 1]}/${plano.competencia.ano}`)}
        </div>
      </div>

      <fieldset disabled={bloqueado} className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <label htmlFor="gr-categoria" className="rotulo">Posto/graduação na data do fato</label>
            <select id="gr-categoria" className="entrada" value={d.categoria ?? ""} onChange={(e) => setD((x) => ({ ...x, categoria: e.target.value }))}>
              <option value="">{sugerida ? `Sugerido pela ficha: ${sugerida.nome}` : "Escolha"}</option>
              {SOLDOS.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            <p className="ajuda">Pela ficha financeira do mês de início (cabeçalho e NR0001 SOLDO), não pelo posto atual. Ex.: “SD NAO ENGAJADO” = Sd EV.</p>
          </div>
          <div>
            <label htmlFor="gr-saida" className="rotulo">Hora de saída (BI de ida)</label>
            <input id="gr-saida" type="time" className="entrada" value={d.horaSaida ?? ""} onChange={(e) => setD((x) => ({ ...x, horaSaida: e.target.value }))} />
          </div>
          <div>
            <label htmlFor="gr-retorno" className="rotulo">Hora de retorno (BI de retorno)</label>
            <input id="gr-retorno" type="time" className="entrada" value={d.horaRetorno ?? ""} onChange={(e) => setD((x) => ({ ...x, horaRetorno: e.target.value }))} />
          </div>
        </div>

        <div>
          <h3 className="rotulo-secao">Autorização (Cmdo Mil A)</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="gr-aut-doc" className="rotulo">Documento (Adt/BI, nº e data)</label>
              <input id="gr-aut-doc" className="entrada" maxLength={100} value={aut.documento ?? ""} placeholder="Ex.: Adt Nr 12 ao BI Nr 61 do CMNE, de 05/03/2024" onChange={(e) => mudarAut({ documento: e.target.value })} />
            </div>
            <div>
              <label htmlFor="gr-aut-trans" className="rotulo">Transcrição no BI da OM</label>
              <input id="gr-aut-trans" className="entrada" maxLength={100} value={aut.transcricao ?? ""} placeholder="Ex.: BI Nr 50 do 16º BI Mtz, de 15/03/2024" onChange={(e) => mudarAut({ transcricao: e.target.value })} />
            </div>
            <div>
              <label htmlFor="gr-aut-pub" className="rotulo">Data de publicação da autorização</label>
              <input id="gr-aut-pub" type="date" className="entrada" value={aut.publicacao ?? ""} onChange={(e) => mudarAut({ publicacao: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="gr-aut-dias" className="rotulo">Dias autorizados</label>
                <input id="gr-aut-dias" inputMode="numeric" className="entrada text-right tabular-nums" value={aut.dias ?? ""}
                  onChange={(e) => { const v = e.target.value.replace(/\D/g, ""); mudarAut({ dias: v ? Number(v) : null }); }} />
              </div>
              <div>
                <label htmlFor="gr-aut-valor" className="rotulo">Valor por militar</label>
                <input id="gr-aut-valor" inputMode="decimal" className="entrada text-right tabular-nums" placeholder="0,00" value={valorAut} onChange={(e) => setValorAut(e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="rotulo-secao">Evento</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="gr-natureza" className="rotulo">Natureza da atividade</label>
              <input id="gr-natureza" className="entrada" value={d.evento?.natureza ?? ""} onChange={(e) => mudarEvento({ natureza: e.target.value })} />
            </div>
            <div>
              <label htmlFor="gr-local" className="rotulo">Local</label>
              <input id="gr-local" className="entrada" value={d.evento?.local ?? ""} onChange={(e) => mudarEvento({ local: e.target.value })} />
            </div>
            <div>
              <label htmlFor="gr-amparo" className="rotulo">Amparo legal</label>
              <input id="gr-amparo" className="entrada" value={d.evento?.amparo ?? ""} placeholder="Ex.: Decreto 11.002/2022, art. 5º" onChange={(e) => mudarEvento({ amparo: e.target.value })} />
            </div>
          </div>
        </div>

        <div>
          <h3 className="rotulo-secao">Grat Rep nas fichas financeiras</h3>
          {plano.lancamentosGr.length === 0 ? (
            <p className="text-sm text-suave">Nenhum lançamento de Grat Rep (AR0061, ER0061, NR0061, A62 ou B26) nas fichas, a partir do mês do fato.</p>
          ) : (
            <>
              <p className="ajuda mt-0">Marque só os pagamentos DESTE evento (confira o BI). Os marcados entram como recebidos; os de depois do período, em “recebido após o período”.</p>
              <ul className="divide-y divide-borda border border-borda">
                {plano.lancamentosGr.map((l) => (
                  <li key={l.chave} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                    <input id={`gr-${l.chave}`} type="checkbox" checked={marcados.has(l.chave)} onChange={(e) => marcar(l.chave, e.target.checked)} />
                    <label htmlFor={`gr-${l.chave}`} className="flex flex-1 flex-wrap justify-between gap-2">
                      <span><b>{MESES_CURTOS[l.mes - 1]}/{l.ano}</b> · {l.codigo} {l.descricao !== l.codigo ? `– ${l.descricao}` : ""}</span>
                      <span className="tabular-nums">R$ {formatarReais(l.valor)}</span>
                      <span className="w-full text-xs text-suave">{l.justificativa}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="space-y-2">
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={!!d.bisConferidos} onChange={(e) => setD((x) => ({ ...x, bisConferidos: e.target.checked }))} />
            <span>O nome do militar consta no BI de ida, no BI de retorno e na autorização.</span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={!!d.despachoOd} onChange={(e) => setD((x) => ({ ...x, despachoOd: e.target.checked }))} />
            <span>Despacho de reconhecimento do OD (art. 16 da Port C Ex 1.746/2022) anexado.</span>
          </label>
        </div>

        {(plano.textos.explicacao || plano.textos.documentos.length > 0) && (
          <div className="border border-borda p-3 text-sm">
            <h3 className="rotulo-secao">Textos sugeridos para o verso</h3>
            {plano.textos.explicacao && <p><span className="text-suave">Explicação do não pagamento:</span> {plano.textos.explicacao}</p>}
            {plano.textos.documentos.length > 0 && <p className="mt-1"><span className="text-suave">Documento que materializou o direito:</span> {plano.textos.documentos.join(" / ")}</p>}
            <label className="mt-2 flex items-start gap-2">
              <input type="checkbox" className="mt-1" checked={usarTextos} onChange={(e) => setUsarTextos(e.target.checked)} />
              <span>Ao salvar, substituir os textos do verso (Informações) por estes.</span>
            </label>
          </div>
        )}
      </fieldset>

      {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
      {!bloqueado && (
        <div className="flex justify-end">
          <button className="botao" disabled={salvando} onClick={salvar}>{salvando ? "Salvando…" : "Salvar e recalcular"}</button>
        </div>
      )}
    </section>
  );
}
