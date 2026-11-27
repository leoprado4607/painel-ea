"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Aviso } from "@/components/Aviso";
import { QuadroTextosVerso } from "@/components/QuadroTextosVerso";
import { textosSugeridos, type TextosVerso } from "@/lib/textos-verso";
import { salvarAdicHab } from "@/lib/acoes/adic-hab";
import { planoAdicHab, TABELA_AH, TIPOS_CURSO, type DadosAdicHab, type PlanoAdicHab, type TipoCurso } from "@/lib/adic-hab";
import { formatarReais } from "@/lib/dinheiro";
import { categoriaSoldo, SOLDOS } from "@/lib/soldos";
import { MESES_CURTOS } from "@/lib/tipos";

const br = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
const R = (v: number) => `R$ ${formatarReais(v)}`;

/**
 * "Lançar valor devido" do Adicional de Habilitação automático (lib/adic-hab): tipo do curso, postos e promoções,
 * reflexos (natalino e férias) e descontos (Fusex e Pensão Militar), cálculo mês a mês, alertas e textos do verso.
 */
export function PainelAdicHab({ processoId, dados, plano, entrada, inicio, fim, bloqueado }: {
  processoId: string; dados: DadosAdicHab; plano: PlanoAdicHab; inicio: string; fim: string; bloqueado: boolean;
  /** O que o cálculo usa além do quadro (fichas, período…): os textos do verso são refeitos na tela, antes de salvar. */
  entrada?: Omit<Parameters<typeof planoAdicHab>[0], "dados"> | null;
}) {
  const router = useRouter();
  const [d, setD] = useState<DadosAdicHab>(dados);
  const [novoMes, setNovoMes] = useState("");
  const [usarTextos, setUsarTextos] = useState(false);
  const [textosEditados, setTextosEditados] = useState<TextosVerso | null>(dados.textosVerso ?? null);
  const textosAoVivo = useMemo(() => (entrada ? planoAdicHab({ ...entrada, dados: d }).textos : plano.textos), [entrada, plano.textos, d]);
  const sugeridos = textosSugeridos(textosAoVivo);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [salvando, iniciar] = useTransition();
  const postos = d.postos ?? [];
  const mesesFerias = d.mesesFerias?.length ? d.mesesFerias : plano.mesesFeriasFicha;
  const salvar = () => iniciar(async () => {
    const r = await salvarAdicHab(processoId, d, usarTextos, textosEditados);
    if (r.erro) return setMsg({ tipo: "erro", texto: r.erro });
    setMsg({ tipo: "ok", texto: "Dados salvos e cálculo refeito." });
    setUsarTextos(false);
    router.refresh();
  });
  const sugerida = plano.categoriaSugerida && plano.categoria ? categoriaSoldo(plano.categoria) : null;
  const rotuloMes = (c: string) => { const [a, m] = c.split("-").map(Number) as [number, number]; return `${MESES_CURTOS[m - 1]}/${a}`; };

  return (
    <section className="cartao space-y-5" aria-labelledby="adic-hab-titulo">
      <div>
        <h2 id="adic-hab-titulo" className="text-lg font-semibold">Adicional de Habilitação: cálculo automático da diferença</h2>
        <p className="ajuda mt-1">
          Devido (A03): percentual da tabela da Lei 13.954/2019 (Anexo III) vigente em cada dia × soldo do posto na tabela, de {br(inicio)} a {br(fim)};
          mês incompleto proporcional aos dias do mês no calendário. Recebido: o adicional pago na ficha (NR0003/A03). Reflexos no 13º (A85) e nas férias
          (AD2), e descontos de Fusex e Pensão Militar sobre a diferença: o sistema calcula e você confere.
        </p>
      </div>

      <div>
        <div>
          <h3 className="rotulo-secao">Cálculo</h3>
          <table className="w-full text-sm tabular-nums">
            <thead><tr className="text-left text-suave"><th className="py-1 font-normal">Mês</th><th className="py-1 text-right font-normal">%</th><th className="py-1 text-right font-normal">Devido</th><th className="py-1 text-right font-normal">Ficha</th><th className="py-1 text-right font-normal">Diferença</th></tr></thead>
            <tbody>
              {plano.meses.map((m) => (
                <tr key={`${m.ano}-${m.mes}`} className="border-t border-borda">
                  <td className="py-1">{MESES_CURTOS[m.mes - 1]}/{m.ano}{m.dias !== m.diasMes ? <span className="text-suave"> ({m.dias}/{m.diasMes})</span> : null}</td>
                  <td className="py-1 text-right">{m.percentual}</td>
                  <td className="py-1 text-right">{m.devido !== null ? formatarReais(m.devido) : "—"}</td>
                  <td className="py-1 text-right">{formatarReais(m.recebido)}</td>
                  <td className="py-1 text-right font-semibold">{m.diferenca !== null ? formatarReais(m.diferenca) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 space-y-0.5 text-sm">
            <p>Diferença do adicional (A03): <b>{R(plano.totais.a03)}</b></p>
            {plano.totais.natal > 0 && <p>Natalino (A85): <b>{R(plano.totais.natal)}</b></p>}
            {plano.totais.ferias > 0 && <p>Férias (AD2): <b>{R(plano.totais.ferias)}</b></p>}
            {plano.totais.descontos > 0 && <p>Descontos (Fusex e Pensão): <b>− {R(plano.totais.descontos)}</b></p>}
          </div>
        </div>
      </div>

      <fieldset disabled={bloqueado} className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="ah-tipo" className="rotulo">Tipo do curso concluído (Portaria C Ex nº 1.443/2021)</label>
            <select id="ah-tipo" className="entrada" value={d.tipo ?? ""} onChange={(e) => setD((x) => ({ ...x, tipo: (e.target.value || undefined) as TipoCurso | undefined }))}>
              <option value="">Escolha</option>
              {TIPOS_CURSO.map((t) => <option key={t} value={t}>{TABELA_AH[t].nome} ({TABELA_AH[t].percentuais.at(-1)}% desde jul/2023)</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="ah-pedido" className="rotulo">Percentual pedido no requerimento (%)</label>
            <input id="ah-pedido" inputMode="numeric" className="entrada" value={d.percentualPedido ?? ""}
              onChange={(e) => { const v = e.target.value.replace(/\D/g, ""); setD((x) => ({ ...x, percentualPedido: v ? Number(v) : null })); }} />
            <p className="ajuda">Só para o alerta: o cálculo segue a tabela da lei.</p>
          </div>
          <div>
            <label htmlFor="ah-curso" className="rotulo">Curso (nome e local)</label>
            <input id="ah-curso" className="entrada" maxLength={160} value={d.curso ?? ""} onChange={(e) => setD((x) => ({ ...x, curso: e.target.value }))} />
          </div>
          <div>
            <label htmlFor="ah-doc" className="rotulo">Ato que materializa o direito (Adt/BI)</label>
            <input id="ah-doc" className="entrada" maxLength={100} value={d.documento ?? ""} placeholder="Ex.: Adt DCEM 4A ao Bol DGP nº 146, de 22 DEZ 25" onChange={(e) => setD((x) => ({ ...x, documento: e.target.value }))} />
          </div>
        </div>

        <div>
          <h3 className="rotulo-secao">Posto/graduação e promoções no período</h3>
          {postos.length === 0 && <p className="text-sm text-suave">{sugerida ? `Sugerido pela ficha: ${sugerida.nome}.` : "Informe o posto/graduação no início."} Acrescente uma linha por promoção.</p>}
          <ul className="space-y-2">
            {postos.map((p, i) => (
              <li key={i} className="flex flex-wrap items-end gap-2">
                <div>
                  <label htmlFor={`ah-desde-${i}`} className="rotulo">{i === 0 ? "Desde (início)" : "Promoção em"}</label>
                  <input id={`ah-desde-${i}`} type="date" className="entrada" value={p.desde}
                    onChange={(e) => setD((x) => ({ ...x, postos: postos.map((q, j) => (j === i ? { ...q, desde: e.target.value } : q)) }))} />
                </div>
                <div className="min-w-56 flex-1">
                  <label htmlFor={`ah-cat-${i}`} className="rotulo">Posto/graduação</label>
                  <select id={`ah-cat-${i}`} className="entrada" value={p.categoria}
                    onChange={(e) => setD((x) => ({ ...x, postos: postos.map((q, j) => (j === i ? { ...q, categoria: e.target.value } : q)) }))}>
                    <option value="">Escolha</option>
                    {SOLDOS.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <button type="button" className="botao-sec" onClick={() => setD((x) => ({ ...x, postos: postos.filter((_, j) => j !== i) }))}>Remover</button>
              </li>
            ))}
          </ul>
          <button type="button" className="botao-sec mt-2"
            onClick={() => setD((x) => ({ ...x, postos: [...postos, { desde: postos.length ? "" : inicio, categoria: postos.length ? "" : (plano.categoria ?? "") }] }))}>
            {postos.length ? "Acrescentar promoção" : "Informar posto e promoções"}
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-2 border border-borda p-3 text-sm">
            <label className="flex items-center gap-2 font-semibold">
              <input type="checkbox" checked={d.natalino !== false} onChange={(e) => setD((x) => ({ ...x, natalino: e.target.checked }))} /> Adicional Natalino (A85)
            </label>
            <p className="ajuda mt-0">Diferença de dezembro (mês cheio) × meses de serviço no ano ÷ 12.</p>
            {plano.natalino.map((n) => (
              <div key={n.ano} className="flex items-center justify-between gap-2">
                <span>{n.ano}: {R(n.diferenca)} ×</span>
                <input aria-label={`Meses de serviço em ${n.ano}`} inputMode="numeric" className="entrada w-16 text-right" value={d.avosNatal?.[String(n.ano)] ?? n.avosSugeridos}
                  onChange={(e) => { const v = Number(e.target.value.replace(/\D/g, "")); setD((x) => ({ ...x, avosNatal: { ...x.avosNatal, [String(n.ano)]: v } })); }} />
                <span>/12 = <b>{R(n.valor)}</b></span>
              </div>
            ))}
          </div>
          <div className="space-y-2 border border-borda p-3 text-sm">
            <label className="flex items-center gap-2 font-semibold">
              <input type="checkbox" checked={d.ferias !== false} onChange={(e) => setD((x) => ({ ...x, ferias: e.target.checked }))} /> Adicional de Férias (AD2)
            </label>
            <p className="ajuda mt-0">1/3 da diferença (mês cheio) nos meses em que o adicional de férias foi pago{d.mesesFerias?.length ? "" : " (sugeridos pela ficha)"}.</p>
            <div className="flex flex-wrap gap-1">
              {mesesFerias.map((c) => (
                <button key={c} type="button" className="border border-borda px-2 py-0.5" title="Remover"
                  onClick={() => setD((x) => ({ ...x, mesesFerias: mesesFerias.filter((m) => m !== c) }))}>{rotuloMes(c)} ×</button>
              ))}
            </div>
            <div className="flex gap-2">
              <input aria-label="Mês de férias" type="month" className="entrada" value={novoMes} onChange={(e) => setNovoMes(e.target.value)} />
              <button type="button" className="botao-sec" disabled={!novoMes}
                onClick={() => { const [a, m] = novoMes.split("-"); setD((x) => ({ ...x, mesesFerias: [...new Set([...mesesFerias, `${a}-${Number(m)}`])] })); setNovoMes(""); }}>Incluir</button>
            </div>
          </div>
          <div className="space-y-2 border border-borda p-3 text-sm">
            <label className="flex items-center gap-2 font-semibold">
              <input type="checkbox" checked={d.descontos !== false} onChange={(e) => setD((x) => ({ ...x, descontos: e.target.checked }))} /> Descontos sobre a diferença
            </label>
            <label htmlFor="ah-pensao" className="rotulo">Pensão Militar (Z02)</label>
            <select id="ah-pensao" className="entrada" value={d.pensao ?? ""} onChange={(e) => setD((x) => ({ ...x, pensao: e.target.value ? Number(e.target.value) : undefined }))}>
              <option value="">10,5% (padrão, confira)</option>
              <option value="7.5">7,5%</option><option value="9.5">9,5%</option><option value="10.5">10,5%</option>
            </select>
            <label className="flex items-center gap-2"><input type="checkbox" checked={!!d.pensao15} onChange={(e) => setD((x) => ({ ...x, pensao15: e.target.checked }))} /> Também a de 1,5%</label>
            <label htmlFor="ah-fusex" className="rotulo">Fusex: 3% (Z01) e cota de dependentes (ZM7)</label>
            <select id="ah-fusex" className="entrada" value={d.fusexDependentes ?? 0} onChange={(e) => setD((x) => ({ ...x, fusexDependentes: Number(e.target.value) as 0 | 0.4 | 0.5 }))}>
              <option value={0}>Só 3% (titular e cônjuge)</option>
              <option value={0.4}>+0,4% (um dependente direto)</option>
              <option value={0.5}>+0,5% (mais de um, ou indiretos)</option>
            </select>
            <p className="ajuda mt-0">Portaria C Ex nº 863/2005.</p>
          </div>
        </div>

        {(sugeridos.explicacao || sugeridos.documentos.length > 0 || textosEditados) && (
          <QuadroTextosVerso sugeridos={sugeridos} editados={textosEditados} aoEditar={setTextosEditados}
            usar={usarTextos} aoUsar={setUsarTextos} bloqueado={bloqueado} />
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
