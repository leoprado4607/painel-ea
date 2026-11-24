import { calcular } from "@painel-ea/engine";
import { Aviso } from "@/components/Aviso";
import { PainelEmissao } from "@/components/PainelEmissao";
import { indicesDoProcesso } from "@/lib/indice";
import { montarEntrada } from "@/lib/calculo";
import { recebidosPosPeriodo } from "@/lib/pos-periodo";
import { formatarReais } from "@/lib/dinheiro";
import { postoAbreviado } from "@/lib/postos";
import { carregarProcesso } from "@/lib/processo";
import { MESES } from "@/lib/tipos";
import { dadosGratRep, gratRepAutomatico, planoGratRep } from "@/lib/grat-rep";
import { auxFardAutomatico, dadosAuxFard, planoAuxFard, tetoArt19 } from "@/lib/aux-fard";
import { fichasLidasValidas } from "@/lib/receitas";
import Link from "next/link";

const R = (v: number) => `R$ ${formatarReais(v)}`;

export default async function Conferencia({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, perfil, processo, militar, rubricas, lancamentos, somenteConsulta, podeCorrigir } = await carregarProcesso(id);
  const [{ indices, descricao: descricaoIndice }, { data: documentos }] = await Promise.all([
    indicesDoProcesso(supabase, processo),
    supabase.from("documento").select("id, versao, criado_em, indice_ate, tamanho_bytes, emitido_por_nome")
      .eq("processo_id", id).eq("tipo", "pacote_completo").order("versao", { ascending: false }),
  ]);
  if (!indices.length) return <Aviso tipo="erro">Não foi possível carregar os índices de correção.</Aviso>;

  const posPeriodo = recebidosPosPeriodo(processo.complementos);
  const r = calcular(montarEntrada(rubricas, lancamentos, indices, { inicio: processo.periodo_inicio, fim: processo.periodo_fim, posPeriodo }));
  const ate = r.tabela.atualizadoAte;
  const ini = processo.periodo_inicio ? Number(processo.periodo_inicio.slice(0, 4)) : 2006;
  // recebidos após o período: os anos deles também aparecem
  const fim = Math.max(processo.periodo_fim ? Number(processo.periodo_fim.slice(0, 4)) : 2028, ...posPeriodo.map((x) => x.ano));
  const anos = r.anos.filter((a) => a.ano >= ini && a.ano <= fim);
  const ativas = rubricas.filter((x) => x.codigo);
  const semLancamentos = lancamentos.length === 0;
  // Gratificação de Representação automática: alertas e pendências do quadro de "Lançar valor devido" (não bloqueiam)
  let avisosGr: string[] = [];
  if (gratRepAutomatico(processo) && processo.periodo_inicio && processo.periodo_fim) {
    const { data } = await supabase.from("processo").select("fichas_lidas").eq("id", id).maybeSingle();
    const p = planoGratRep({
      fichas: fichasLidasValidas(data?.fichas_lidas), inicio: processo.periodo_inicio, fim: processo.periodo_fim,
      dados: dadosGratRep(processo.complementos), dataRequerimento: processo.data_requerimento, hoje: new Date().toISOString().slice(0, 10),
    });
    avisosGr = [...p.alertas.map((a) => `${a.codigo}: ${a.descricao}`), ...p.pendencias];
  }
  // Auxílio-fardamento automático: alertas do quadro e teto do art. 19 (4 soldos de Capitão vigentes)
  let avisosAf: string[] = [];
  if (auxFardAutomatico(processo)) {
    const hoje = new Date().toISOString().slice(0, 10);
    const { data } = await supabase.from("processo").select("fichas_lidas").eq("id", id).maybeSingle();
    const p = planoAuxFard({
      fichas: fichasLidasValidas(data?.fichas_lidas), dados: dadosAuxFard(processo.complementos), dataRequerimento: processo.data_requerimento,
      periodoInicio: processo.periodo_inicio, hoje,
    });
    avisosAf = [...p.alertas.map((a) => `${a.codigo}: ${a.descricao}`), ...p.pendencias];
    const teto = tetoArt19(hoje);
    if (teto !== null && r.cpex.importanciaBasicaTotalCorrigida > teto) {
      avisosAf.unshift(`REMESSA_CPEX: o valor corrigido (${R(r.cpex.importanciaBasicaTotalCorrigida)}) passa de 4 soldos de Capitão (${R(teto)}): o processo segue ao CPEx (art. 19 da Port C Ex 1.746/2022).`);
    }
  }
  const anosAntigos = r.anos.some((a) => a.ano < 2008 && (a.verso.total.devido !== 0 || a.verso.total.recebido !== 0));

  return (
    <div className="space-y-5">
      <p className="text-sm text-suave">
        Corrigido pela série {descricaoIndice}{ate ? `, atualizada até ${MESES[ate.mes - 1]}/${ate.ano}` : ""}.
      </p>
      {semLancamentos && <Aviso tipo="atencao">Ainda não há valores lançados neste processo.</Aviso>}
      {avisosAf.length > 0 && (
        <Aviso tipo="atencao">
          <p className="font-semibold">Auxílio-fardamento: confira antes de emitir</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">{avisosAf.map((a, i) => <li key={i}>{a}</li>)}</ul>
          <p className="mt-1">Detalhes em <Link href={`/processos/${id}/devidos`} className="underline">Lançar valor devido</Link>.</p>
        </Aviso>
      )}
      {avisosGr.length > 0 && (
        <Aviso tipo="atencao">
          <p className="font-semibold">Gratificação de Representação: confira antes de emitir</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">{avisosGr.map((a, i) => <li key={i}>{a}</li>)}</ul>
          <p className="mt-1">Detalhes em <Link href={`/processos/${id}/devidos`} className="underline">Lançar valor devido</Link>.</p>
        </Aviso>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="cartao">
          <p className="text-sm text-suave">Importância básica total corrigida (CPEX)</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-marca-800">{R(r.cpex.importanciaBasicaTotalCorrigida)}</p>
        </div>
        <div className="cartao">
          <p className="text-sm text-suave">Diferença sem correção (CPEX)</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{R(r.cpex.totalSemCorrecao)}</p>
        </div>
        <div className="cartao">
          <p className="text-sm text-suave">Total da Recapitulação (todos os anos)</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{R(r.recapitulacao.saldo)}</p>
        </div>
      </div>
      {anosAntigos && (
        <Aviso tipo="atencao">
          Há valores em 2006 ou 2007. Como na planilha, a folha CPEX soma só de 2008 em diante e a Recapitulação soma todos os anos,
          por isso os dois totais diferem.
        </Aviso>
      )}

      <section className="cartao overflow-x-auto">
        <h2 className="mb-3 font-semibold">Por ano</h2>
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="text-left text-suave">
            <tr><th className="py-2">Ano</th><th className="text-right">Devido</th><th className="text-right">Recebido</th>
              <th className="text-right">Diferença</th><th className="text-right">Diferença corrigida</th></tr>
          </thead>
          <tbody className="tabular-nums">
            {anos.map((a) => (
              <tr key={a.ano} className="border-t border-borda">
                <td className="py-2 font-semibold">{a.ano}</td>
                <td className="text-right">{formatarReais(a.verso.total.devido)}</td>
                <td className="text-right">{formatarReais(a.verso.total.recebido)}</td>
                <td className="text-right">{formatarReais(a.verso.total.diferenca)}</td>
                <td className="text-right font-semibold">{formatarReais(a.verso.total.corrigido)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="cartao overflow-x-auto">
        <h2 className="mb-3 font-semibold">Por rubrica (folha CPEX)</h2>
        <table className="w-full min-w-[32rem] text-sm">
          <thead className="text-left text-suave">
            <tr><th className="py-2">Rubrica</th><th>Tipo</th><th className="text-right">Sem correção</th><th className="text-right">Com correção</th></tr>
          </thead>
          <tbody className="tabular-nums">
            {ativas.map((x) => (
              <tr key={x.posicao} className="border-t border-borda">
                <td className="py-2">{x.codigo}</td>
                <td className="text-suave">{x.tipo === "-" ? "neutra" : x.tipo}</td>
                <td className="text-right">{formatarReais(r.cpex.semCorrecao[x.posicao - 1]!)}</td>
                <td className="text-right">{formatarReais(r.cpex.comCorrecao[x.posicao - 1]!)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <PainelEmissao processoId={id} situacao={processo.situacao} documentos={documentos ?? []} somenteConsulta={somenteConsulta}
        ehAdmin={perfil?.papel === "admin"} podeCorrigir={podeCorrigir}
        descricao={`${processo.numero || "s/nº"} de ${[postoAbreviado(militar.posto_graduacao), militar.nome].filter(Boolean).join(" ")}`} />
    </div>
  );
}
