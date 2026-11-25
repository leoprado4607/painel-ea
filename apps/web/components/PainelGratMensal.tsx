"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Aviso } from "@/components/Aviso";
import { salvarGratMensal } from "@/lib/acoes/grat-mensal";
import { formatarReais } from "@/lib/dinheiro";
import { ESPECIE_GR_CMDO, PERCENTUAL, type DadosGratMensal, type PlanoGratMensal } from "@/lib/grat-mensal";
import { categoriaSoldo, SOLDOS } from "@/lib/soldos";
import { MESES_CURTOS } from "@/lib/tipos";

const br = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

/**
 * "Lançar valor devido" das gratificações mensais automáticas (lib/grat-mensal): localidade especial (A/B) ou Grat Rep
 * de comando. Posto/graduação, localidade, ato, lançamentos das fichas (o operador marca os desta dívida), cálculo
 * mês a mês, alertas e textos do verso.
 */
export function PainelGratMensal({ processoId, especie, dados, plano, inicio, fim, bloqueado }: {
  processoId: string; especie: string; dados: DadosGratMensal; plano: PlanoGratMensal; inicio: string; fim: string; bloqueado: boolean;
}) {
  const router = useRouter();
  const [d, setD] = useState<DadosGratMensal>(dados);
  const [usarTextos, setUsarTextos] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [salvando, iniciar] = useTransition();
  const comando = especie === ESPECIE_GR_CMDO;
  const marcados = new Set(d.considerados ?? []);
  const marcar = (chave: string, sim: boolean) =>
    setD((x) => ({ ...x, considerados: sim ? [...(x.considerados ?? []), chave] : (x.considerados ?? []).filter((c) => c !== chave) }));
  const salvar = () => iniciar(async () => {
    const r = await salvarGratMensal(processoId, d, usarTextos);
    if (r.erro) return setMsg({ tipo: "erro", texto: r.erro });
    setMsg({ tipo: "ok", texto: "Dados salvos e cálculo refeito." });
    setUsarTextos(false);
    router.refresh();
  });
  const sugerida = plano.categoriaSugerida && plano.categoria ? categoriaSoldo(plano.categoria) : null;
  const total = plano.devidos.reduce((s, v) => s + v.valor, 0);
  const titulo = comando ? "Gratificação de Representação de comando" : "Gratificação de Localidade Especial";

  return (
    <section className="cartao space-y-5" aria-labelledby="grat-mensal-titulo">
      <div>
        <h2 id="grat-mensal-titulo" className="text-lg font-semibold">{titulo}: cálculo automático</h2>
        <p className="ajuda mt-1">
          {comando
            ? "10% do soldo do posto/graduação por mês de exercício do cargo de comando, direção ou chefia (Decreto 11.002/2022, art. 4º, § 2º), na rubrica A16 - GRAT REP 10%."
            : "20% (categoria A) ou 10% (categoria B) do soldo do posto/graduação por mês na localidade especial (MP 2.215-10/2001, Anexo III, Tabela I; Portaria GM-MD nº 379/2022), nas rubricas A07 ou A08."}
          {" "}Mês incompleto: proporcional aos dias do mês no calendário. Período de {br(inicio)} a {br(fim)} (Informações).
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <h3 className="rotulo-secao">Cálculo</h3>
          <table className="w-full text-sm tabular-nums">
            <thead><tr className="text-left text-suave"><th className="py-1 font-normal">Mês</th><th className="py-1 text-right font-normal">Soldo</th><th className="py-1 text-right font-normal">Dias</th><th className="py-1 text-right font-normal">Devido</th></tr></thead>
            <tbody>
              {plano.meses.map((m) => (
                <tr key={`${m.ano}-${m.mes}`} className="border-t border-borda">
                  <td className="py-1">{MESES_CURTOS[m.mes - 1]}/{m.ano}</td>
                  <td className="py-1 text-right">{m.soldo !== null ? formatarReais(m.soldo) : "—"}</td>
                  <td className="py-1 text-right">{m.dias === m.diasMes ? "mês cheio" : `${m.dias}/${m.diasMes}`}</td>
                  <td className="py-1 text-right font-semibold">{m.valor !== null ? formatarReais(m.valor) : "—"}</td>
                </tr>
              ))}
              <tr className="border-t border-borda font-semibold"><td className="py-1" colSpan={3}>Total {plano.tipo ? `(${Math.round(PERCENTUAL[plano.tipo] * 100)}%, ${plano.rubrica})` : ""}</td><td className="py-1 text-right">{formatarReais(total)}</td></tr>
            </tbody>
          </table>
          <p className="ajuda">Posto/graduação: {plano.categoria ? `${categoriaSoldo(plano.categoria)!.nome}${plano.categoriaSugerida ? " (sugerido)" : ""}` : "—"}
            {!comando && ` · Categoria: ${plano.localidade ?? "—"}${plano.localidade && !d.localidade ? " (sugerida)" : ""}`}</p>
        </div>
        <div className="space-y-3">
          {plano.alertas.length > 0 && (
            <Aviso tipo="atencao">
              <p className="font-semibold">Alertas</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">{plano.alertas.map((a, i) => <li key={i}><b>{a.codigo}</b>: {a.descricao}</li>)}</ul>
            </Aviso>
          )}
          {plano.pendencias.length > 0 && (
            <Aviso tipo="info">
              <p className="font-semibold">Pendências</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">{plano.pendencias.map((p, i) => <li key={i}>{p}</li>)}</ul>
            </Aviso>
          )}
          {!plano.alertas.length && !plano.pendencias.length && <Aviso tipo="ok">Sem alertas nem pendências.</Aviso>}
        </div>
      </div>

      <fieldset disabled={bloqueado} className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="gm-categoria" className="rotulo">Posto/graduação no período</label>
            <select id="gm-categoria" className="entrada" value={d.categoria ?? ""} onChange={(e) => setD((x) => ({ ...x, categoria: e.target.value }))}>
              <option value="">{sugerida ? `Sugerido pela ficha: ${sugerida.nome}` : "Escolha"}</option>
              {SOLDOS.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          {!comando && (
            <div>
              <label htmlFor="gm-localidade" className="rotulo">Categoria da localidade (Portaria GM-MD 379/2022)</label>
              <select id="gm-localidade" className="entrada" value={d.localidade ?? ""} onChange={(e) => setD((x) => ({ ...x, localidade: (e.target.value || undefined) as DadosGratMensal["localidade"] }))}>
                <option value="">{plano.sugestao?.categoria ? `Sugerida: ${plano.sugestao.categoria}` : "Escolha"}</option>
                <option value="A">A (20% do soldo): a oeste da linha Alfa</option>
                <option value="B">B (10% do soldo): entre as linhas Alfa e Beta</option>
              </select>
              {plano.sugestao && <p className="ajuda">{plano.sugestao.motivo}</p>}
            </div>
          )}
          <div>
            <label htmlFor="gm-local" className="rotulo">{comando ? "Cargo e OM" : "Localidade (cidade-UF)"}</label>
            <input id="gm-local" className="entrada" maxLength={120} value={d.local ?? ""} placeholder={comando ? "Ex.: Chefe de Instrução do TG 07-001" : "Ex.: Boa Vista-RR"}
              onChange={(e) => setD((x) => ({ ...x, local: e.target.value }))} />
          </div>
          <div>
            <label htmlFor="gm-documento" className="rotulo">{comando ? "Ato de nomeação/designação (BI/Adt)" : "Ato da designação, operação ou destaque (BI/Adt)"}</label>
            <input id="gm-documento" className="entrada" maxLength={100} value={d.documento ?? ""} onChange={(e) => setD((x) => ({ ...x, documento: e.target.value }))} />
          </div>
        </div>

        <div>
          <h3 className="rotulo-secao">{comando ? "Grat Rep 10%" : "Localidade especial"} nas fichas financeiras</h3>
          {plano.lancamentos.length === 0 ? (
            <p className="text-sm text-suave">Nenhum lançamento desta gratificação nas fichas, a partir do início do período.</p>
          ) : (
            <>
              <p className="ajuda mt-0">Marque só os pagamentos DESTA dívida. Os marcados entram como recebidos; os de depois do período, em “recebido após o período”.</p>
              <ul className="divide-y divide-borda border border-borda">
                {plano.lancamentos.map((l) => (
                  <li key={l.chave} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                    <input id={`gm-${l.chave}`} type="checkbox" checked={marcados.has(l.chave)} onChange={(e) => marcar(l.chave, e.target.checked)} />
                    <label htmlFor={`gm-${l.chave}`} className="flex flex-1 flex-wrap justify-between gap-2">
                      <span><b>{MESES_CURTOS[l.mes - 1]}/{l.ano}</b> · {l.codigo} {l.descricao !== l.codigo ? `– ${l.descricao}` : ""}</span>
                      <span className="tabular-nums">R$ {formatarReais(l.valor)}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
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
