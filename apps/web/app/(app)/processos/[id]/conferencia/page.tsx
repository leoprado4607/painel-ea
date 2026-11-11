import { calcular } from "@painel-ea/engine";
import { Aviso } from "@/components/Aviso";
import { PainelEmissao } from "@/components/PainelEmissao";
import { descreverRegra } from "@/lib/indice";
import { montarEntrada } from "@/lib/calculo";
import { recebidosPosPeriodo } from "@/lib/pos-periodo";
import { formatarReais } from "@/lib/dinheiro";
import { nomeNaAssinatura } from "@/lib/postos";
import { carregarProcesso, operadorDoProcesso } from "@/lib/processo";
import { FUNCAO_RESPONSAVEL, MESES } from "@/lib/tipos";

const R = (v: number) => `R$ ${formatarReais(v)}`;

export default async function Conferencia({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, perfil, processo, rubricas, lancamentos, somenteConsulta } = await carregarProcesso(id);
  const operador = await operadorDoProcesso(supabase, id, perfil);
  const [{ data: indices }, { data: regras }, { data: documentos }] = await Promise.all([
    supabase.from("indice_composto").select("ano, mes, percentual"),
    supabase.from("regra_indice").select("vigencia_inicio, serie").order("vigencia_inicio"),
    supabase.from("documento").select("id, versao, criado_em, indice_ate, tamanho_bytes, emitido_por_nome")
      .eq("processo_id", id).eq("tipo", "pacote_completo").order("versao", { ascending: false }),
  ]);
  if (!indices?.length) return <Aviso tipo="erro">Não foi possível carregar os índices de correção.</Aviso>;

  const posPeriodo = recebidosPosPeriodo(processo.complementos);
  const r = calcular(montarEntrada(rubricas, lancamentos, indices, { inicio: processo.periodo_inicio, fim: processo.periodo_fim, posPeriodo }));
  const ate = r.tabela.atualizadoAte;
  const ini = processo.periodo_inicio ? Number(processo.periodo_inicio.slice(0, 4)) : 2006;
  // recebidos após o período: os anos deles também aparecem
  const fim = Math.max(processo.periodo_fim ? Number(processo.periodo_fim.slice(0, 4)) : 2028, ...posPeriodo.map((x) => x.ano));
  const anos = r.anos.filter((a) => a.ano >= ini && a.ano <= fim);
  const ativas = rubricas.filter((x) => x.codigo);
  const descricaoIndice = descreverRegra(regras ?? []);
  const semLancamentos = lancamentos.length === 0;
  const anosAntigos = r.anos.some((a) => a.ano < 2008 && (a.verso.total.devido !== 0 || a.verso.total.recebido !== 0));

  return (
    <div className="space-y-5">
      <p className="text-sm text-suave">
        Corrigido pela série {descricaoIndice}{ate ? `, atualizada até ${MESES[ate.mes - 1]}/${ate.ano}` : ""}.
      </p>
      {semLancamentos && <Aviso tipo="atencao">Ainda não há valores lançados neste processo.</Aviso>}

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

      {/* quem assina como operador: quem criou o processo (mesmo que o PDF seja gerado pelo Admin) */}
      <Aviso tipo="info">
        Os documentos são assinados, como {FUNCAO_RESPONSAVEL}, pelo operador que criou o processo:{" "}
        <strong>{operador ? nomeNaAssinatura(operador.nome, operador.posto) : "—"}</strong>.
        O Ordenador de Despesas assina só a Solicitação de Pagamento (abaixo da data) e o verso.
      </Aviso>
      <PainelEmissao processoId={id} situacao={processo.situacao} documentos={documentos ?? []} somenteConsulta={somenteConsulta} />
    </div>
  );
}
