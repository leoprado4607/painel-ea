"use client";
import type { LeituraGuardada } from "@/lib/processo-completo";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Aviso } from "@/components/Aviso";
import { QuadroTextosVerso } from "@/components/QuadroTextosVerso";
import { textosSugeridos, type TextosVerso } from "@/lib/textos-verso";
import { salvarAuxFard } from "@/lib/acoes/aux-fard";
import { CASOS_AUX_FARD, casoAuxFard, casoUnico, planoAuxFard, TIPOS_FATO, tresAnosDepois, type CasoAuxFard, type DadosAuxFard, type FatoGerador, type PlanoAuxFard, type TipoFato, type VinculoPagamento } from "@/lib/aux-fard";
import { formatarReais } from "@/lib/dinheiro";
import { SOLDOS } from "@/lib/soldos";
import { MESES_CURTOS } from "@/lib/tipos";

const br = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
const R = (v: number | null) => (v === null ? "—" : `R$ ${formatarReais(v)}`);

/**
 * "Lançar valor devido" do Auxílio-fardamento automático (lib/aux-fard): caso (art. 61 ou triênio + promoção na mesma
 * data), fatos geradores, ligação dos pagamentos das fichas, conferências do Parecer 645, cálculo, alertas e textos.
 */
export function PainelAuxFard({ processoId, dados, plano, entrada, bloqueado }: {
  processoId: string; dados: DadosAuxFard; plano: PlanoAuxFard; bloqueado: boolean;
  /** O que o cálculo usa além do quadro (fichas, requerimento…): os textos do verso são refeitos na tela, antes de salvar. */
  entrada?: Omit<Parameters<typeof planoAuxFard>[0], "dados"> | null;
  /** O que veio do processo completo (lib/processo-completo), quando o cálculo começou por ele. */
  leitura?: LeituraGuardada | null;
}) {
  const router = useRouter();
  const [d, setD] = useState<DadosAuxFard>({ ...dados, caso: plano.caso });
  const [vinculos, setVinculos] = useState<Record<string, VinculoPagamento>>(Object.fromEntries(plano.pagamentos.map((p) => [p.chave, p.fato])));
  const [usarTextos, setUsarTextos] = useState(false);
  const [textosEditados, setTextosEditados] = useState<TextosVerso | null>(dados.textosVerso ?? null);

  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [salvando, iniciar] = useTransition();
  const caso = casoAuxFard(d.caso);
  const mesmaData = caso === "mesma_data";
  const unico = casoUnico(caso);
  const mudarFato = (n: "fato1" | "fato2", campo: Partial<FatoGerador>) => setD((x) => ({ ...x, [n]: { ...x[n], ...campo } }));
  const mudarCaso = (c: CasoAuxFard) => setD((x) => ({ ...x, caso: c }));
  // somente 3 anos: a última promoção do requerimento (lida do processo); sem ela, a promoção informada antes
  const ultimaPromocao = d.ultimaPromocao ?? (d.fato2?.tipo === "promocao" ? d.fato2.data ?? "" : "");

  const envio: DadosAuxFard = mesmaData
    ? { ...d, vinculos, fato1: { ...d.fato1, tipo: "trienio", data: d.fato2?.data }, fato2: { ...d.fato2, tipo: "promocao" } }
    : unico ? { ...d, vinculos, fato1: {}, fato2: { ...d.fato2, tipo: caso }, ...(caso === "trienio" ? { ultimaPromocao } : {}) }
    : { ...d, vinculos };
  // textos do verso refeitos a cada mudança do quadro (sem esperar o salvar)
  const textosAoVivo = useMemo(() => (entrada ? planoAuxFard({ ...entrada, dados: envio }).textos : plano.textos),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entrada, plano.textos, JSON.stringify(envio)]);
  const sugeridos = textosSugeridos(textosAoVivo);

  const salvar = () => iniciar(async () => {
    const r = await salvarAuxFard(processoId, envio, usarTextos, textosEditados);
    if (r.erro) return setMsg({ tipo: "erro", texto: r.erro });
    setMsg({ tipo: "ok", texto: "Dados salvos e cálculo refeito." });
    setUsarTextos(false);
    router.refresh();
  });

  const linha = (rotulo: string, valor: string) => (
    <div className="flex justify-between gap-3 border-b border-borda py-1.5 text-sm last:border-0">
      <span className="text-suave">{rotulo}</span><span className="text-right font-semibold tabular-nums">{valor}</span>
    </div>
  );
  const seletorPosto = (id: string, rotulo: string, n: "fato1" | "fato2") => (
    <div>
      <label htmlFor={id} className="rotulo">{rotulo}</label>
      <select id={id} className="entrada" value={d[n]?.categoria ?? ""} onChange={(e) => mudarFato(n, { categoria: e.target.value })}>
        <option value="">Escolha</option>
        {SOLDOS.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
      </select>
    </div>
  );
  const seletorTipo = (id: string, n: "fato1" | "fato2") => (
    <div>
      <label htmlFor={id} className="rotulo">Tipo</label>
      <select id={id} className="entrada" value={d[n]?.tipo ?? ""} onChange={(e) => mudarFato(n, { tipo: (e.target.value || undefined) as TipoFato | undefined })}>
        <option value="">Escolha</option>
        {TIPOS_FATO.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
      </select>
    </div>
  );
  const seletorMultiplicador = (id: string, n: "fato1" | "fato2") => d[n]?.tipo === "outro" && (
    <div>
      <label htmlFor={id} className="rotulo">Multiplicador</label>
      <select id={id} className="entrada" value={d[n]?.multiplicador ?? ""} onChange={(e) => mudarFato(n, { multiplicador: e.target.value ? Number(e.target.value) : null })}>
        <option value="">{n === "fato1" ? "Pelo valor pago" : "Escolha"}</option>
        <option value="1">1 soldo</option>
        <option value="1.5">1,5 soldo</option>
      </select>
    </div>
  );

  return (
    <section className="cartao space-y-5" aria-labelledby="aux-fard-titulo">
      <div>
        <h2 id="aux-fard-titulo" className="text-lg font-semibold">Auxílio-fardamento: cálculo automático da diferença</h2>
        <p className="ajuda mt-1">
          Devido integral pelo soldo da tabela (MP 2.215-10/2001, Tabela II do Anexo IV) menos o já recebido pelo fato cobrado, no mês do fato
          (competência), corrigido como as demais espécies (IPCA até ago/2025 e IPCA-E depois). Escolha o caso, informe o(s) fato(s) gerador(es)
          e confira a ligação dos auxílios encontrados nas fichas.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <h3 className="rotulo-secao">Cálculo</h3>
          {linha("Caso", CASOS_AUX_FARD.find((c) => c.id === plano.caso)!.nome)}
          {linha("Auxílio já recebido nas fichas", plano.pagamentos.length
            ? `${R(plano.pagamentos.reduce((s, p) => s + p.valor, 0))} (${plano.pagamentos.length} ${plano.pagamentos.length === 1 ? "pagamento" : "pagamentos"})`
            : "nenhum")}
          {plano.caso === "art61" && linha("1º auxílio (multiplicador pelo valor pago)", plano.multiplicador1 !== null ? `${plano.multiplicador1.toLocaleString("pt-BR")} soldo` : "—")}
          {plano.caso === "mesma_data" && linha("Triênio (1 soldo do posto anterior)", R(plano.soldo1))}
          {linha(plano.caso === "mesma_data" || plano.caso === "promocao" ? "Promoção (soldo do novo posto)" : plano.caso === "trienio" ? "Soldo do posto dos 3 anos" : "Soldo do 2º fato", R(plano.soldo2))}
          {linha(casoUnico(plano.caso) ? "Multiplicador" : "Multiplicador do 2º fato", plano.multiplicador2 !== null ? `${plano.multiplicador2.toLocaleString("pt-BR")} soldo` : "—")}
          {linha("Devido integral", R(plano.devido))}
          {linha(casoUnico(plano.caso) ? "Recebido por este fato" : "Recebido pelo 2º fato", R(plano.recebido))}
          {linha("Diferença (sem correção)", R(plano.diferenca))}
          {linha("Competência", plano.competencia ? `${MESES_CURTOS[plano.competencia.mes - 1]}/${plano.competencia.ano}` : "—")}
          {linha("Rubrica", plano.rubrica)}
          {plano.prescricao && linha(casoUnico(plano.caso) ? "Limite da prescrição (5 anos do fato)" : "Limite da prescrição (5 anos do 2º fato)", br(plano.prescricao.limite))}
        </div>
      </div>

      <fieldset disabled={bloqueado} className="space-y-5">
        <div className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2" role="radiogroup" aria-label="Caso">
          {CASOS_AUX_FARD.map((c) => (
            <label key={c.id} className="flex items-center gap-2">
              <input type="radio" name="caso" checked={caso === c.id} onChange={() => mudarCaso(c.id)} />
              {c.nome}
            </label>
          ))}
        </div>

        {unico ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {caso === "promocao" ? (
              <div>
                <label htmlFor="af-data2" className="rotulo">Data da promoção (BI do ato)</label>
                <input id="af-data2" type="date" className="entrada" value={d.fato2?.data ?? ""} onChange={(e) => mudarFato("fato2", { data: e.target.value })} />
              </div>
            ) : (
              <>
                {/* os 3 anos contam da última promoção informada no requerimento */}
                <div>
                  <label htmlFor="af-ultpromo" className="rotulo">Data da última promoção (requerimento)</label>
                  <input id="af-ultpromo" type="date" className="entrada" value={ultimaPromocao}
                    onChange={(e) => setD((x) => ({ ...x, ultimaPromocao: e.target.value }))} />
                </div>
                <div>
                  <span className="rotulo">Completou os 3 anos em</span>
                  <output htmlFor="af-ultpromo" className="entrada block bg-gray-50 tabular-nums">{/^\d{4}-\d{2}-\d{2}$/.test(ultimaPromocao) ? br(tresAnosDepois(ultimaPromocao)) : "–"}</output>
                </div>
              </>
            )}
            {seletorPosto("af-cat2", caso === "promocao" ? "Novo posto/graduação" : "Posto/graduação em que completou os 3 anos", "fato2")}
          </div>
        ) : mesmaData ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="af-data2" className="rotulo">Data da promoção e do triênio</label>
              <input id="af-data2" type="date" className="entrada" value={d.fato2?.data ?? ""} onChange={(e) => mudarFato("fato2", { data: e.target.value })} />
            </div>
            {seletorPosto("af-cat1", "Posto em que completou os 3 anos", "fato1")}
            {seletorPosto("af-cat2", "Novo posto (promoção)", "fato2")}
          </div>
        ) : (
          <>
            <div>
              <h3 className="rotulo-secao">1º fato gerador (pago integral)</h3>
              <div className="grid gap-3 sm:grid-cols-4">
                {seletorTipo("af-tipo1", "fato1")}
                <div>
                  <label htmlFor="af-data1" className="rotulo">Data</label>
                  <input id="af-data1" type="date" className="entrada" value={d.fato1?.data ?? ""} onChange={(e) => mudarFato("fato1", { data: e.target.value })} />
                </div>
                {seletorPosto("af-cat1", "Posto/graduação", "fato1")}
                {seletorMultiplicador("af-mult1", "fato1")}
              </div>
            </div>
            <div>
              <h3 className="rotulo-secao">2º fato gerador (pago só pela diferença)</h3>
              <div className="grid gap-3 sm:grid-cols-4">
                {seletorTipo("af-tipo2", "fato2")}
                <div>
                  <label htmlFor="af-data2" className="rotulo">Data de efeito (BI do ato)</label>
                  <input id="af-data2" type="date" className="entrada" value={d.fato2?.data ?? ""} onChange={(e) => mudarFato("fato2", { data: e.target.value })} />
                </div>
                {seletorPosto("af-cat2", "Posto/graduação (promoção: o novo; triênio: o do triênio)", "fato2")}
                {seletorMultiplicador("af-mult2", "fato2")}
              </div>
              <p className="ajuda">CFO/QC e CFO/Sau: matrícula como 1º Ten R/2 e nomeação como 1º Ten; CFO/CM: Aspirante R/2 e 2º Ten (1,5 soldo cada).</p>
            </div>
          </>
        )}
        {/* os 3 anos no posto não têm BI próprio: o documento que os ampara é o da última promoção */}
        <div>
          <label htmlFor="af-ato2" className="rotulo">{caso === "promocao" ? "BI do ato da promoção (nº e data)"
            : caso === "trienio" ? "BI da última promoção, que ampara os 3 anos (nº e data)" : "BI do ato do 2º fato gerador (nº e data)"}</label>
          <input id="af-ato2" className="entrada" maxLength={100} value={d.ato2 ?? ""} placeholder="Ex.: BI Nr 239 do HGuJP, de 24/12/2021" onChange={(e) => setD((x) => ({ ...x, ato2: e.target.value }))} />
        </div>
        {caso === "trienio" && <p className="ajuda">Os 3 anos contam da última promoção informada no requerimento. Ao salvar, o início e o fim da dívida (Informações) passam ao mês em que completou os 3 anos.</p>}

        <div>
          <h3 className="rotulo-secao">Auxílio-fardamento nas fichas financeiras</h3>
          {plano.pagamentos.length === 0 ? (
            <p className="text-sm text-suave">Nenhum auxílio-fardamento (NR/AR/ER 0056 e 0057; A56, A57, A26 ou AEG) nas fichas enviadas.</p>
          ) : (
            <ul className="divide-y divide-borda border border-borda">
              {plano.pagamentos.map((p) => (
                <li key={p.chave} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span><b>{MESES_CURTOS[p.mes - 1]}/{p.ano}</b> · {p.codigo}{p.descricao !== p.codigo ? ` – ${p.descricao}` : ""}</span>
                  <span className="tabular-nums">R$ {formatarReais(p.valor)}</span>
                  <label className="sr-only" htmlFor={`af-${p.chave}`}>Fato gerador do pagamento de {MESES_CURTOS[p.mes - 1]}/{p.ano}</label>
                  <select id={`af-${p.chave}`} className="entrada w-auto py-1" value={vinculos[p.chave] ?? 0}
                    onChange={(e) => setVinculos((v) => ({ ...v, [p.chave]: Number(e.target.value) as VinculoPagamento }))}>
                    <option value={0}>Não é deste pedido</option>
                    {!mesmaData && <option value={1}>{unico ? "Auxílio anterior (menos de 1 ano)" : "1º fato"}</option>}
                    <option value={2}>{unico || mesmaData ? "Recebido por este fato" : "2º fato (recebido)"}</option>
                    <option value={3}>Recebido posterior (outro fato)</option>
                  </select>
                </li>
              ))}
            </ul>
          )}
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
