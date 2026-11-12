import Link from "next/link";
import { ListaProcessos, type CardProcesso } from "@/components/ListaProcessos";
import { normalizarBusca } from "@/lib/busca";
import { postoAbreviado } from "@/lib/postos";
import { ehDonoDoProcesso, podeAlterarProcesso } from "@/lib/processo";
import { sessao } from "@/lib/sessao";
import { formatarReais } from "@/lib/dinheiro";
import { omDeVinculacao, type Militar, type Processo } from "@/lib/tipos";
import { valoresCorrigidos } from "@/lib/valor-corrigido";

const mesAno = (d: string | null) => (d ? `${d.slice(5, 7)}/${d.slice(0, 4)}` : "—");

export default async function Processos() {
  const { supabase, perfil } = await sessao();
  // só as colunas do card (fichas_lidas etc. ficam de fora; complementos traz os recebidos após o período, que entram no valor)
  const { data } = await supabase.from("processo")
    .select("id, numero, situacao, periodo_inicio, periodo_fim, especie_divida, criado_por, indices_usados, complementos, militar(nome, posto_graduacao, om_vinculacao)")
    .order("atualizado_em", { ascending: false })
    .returns<(Pick<Processo, "id" | "numero" | "situacao" | "periodo_inicio" | "periodo_fim" | "especie_divida" | "criado_por">
      & { indices_usados: { ano: number; mes: number; percentual: number | null }[] | null; militar: Pick<Militar, "nome" | "posto_graduacao" | "om_vinculacao"> })[]>();
  const processos = data ?? [];
  // valor final corrigido de cada processo (no lugar da OM, pedido de 21/10/2026)
  const corrigidos = await valoresCorrigidos(supabase, processos);
  // operador que iniciou cada processo (quem criou): o Admin vê em todos os cards; o operador, nos rascunhos
  // (11/11/2026: rascunho pode ser continuado por outro operador). O operador não lê o perfil dos outros: vem da função.
  const operadores = new Map<string, string>();
  const mostrarOperador = (p: Pick<Processo, "situacao">) => perfil?.papel === "admin" || p.situacao === "rascunho";
  const comOperador = processos.filter(mostrarOperador).map((p) => p.id);
  if (comOperador.length) {
    const { data: ops } = await supabase.rpc("operadores_dos_processos", { pids: comOperador });
    for (const op of (ops ?? []) as { processo_id: string; nome: string; posto: string | null }[])
      operadores.set(op.processo_id, [postoAbreviado(op.posto), op.nome].filter(Boolean).join(" "));
  }
  // quem emitiu (e assinou) a última versão de cada processo emitido (pode não ser quem criou)
  const emissores = new Map<string, { versao: number; nome: string | null }>();
  const emitidos = processos.filter((p) => p.situacao !== "rascunho").map((p) => p.id);
  if (emitidos.length) {
    const { data: docs } = await supabase.from("documento").select("processo_id, versao, emitido_por_nome")
      .eq("tipo", "pacote_completo").in("processo_id", emitidos);
    for (const d of docs ?? []) {
      const atual = emissores.get(d.processo_id);
      if (!atual || d.versao > atual.versao) emissores.set(d.processo_id, { versao: d.versao, nome: d.emitido_por_nome });
    }
  }
  // cards prontos (o filtro da pesquisa roda no navegador, em ListaProcessos)
  const cards: CardProcesso[] = processos.map((p) => {
    const nome = [postoAbreviado(p.militar?.posto_graduacao), p.militar?.nome].filter(Boolean).join(" ");
    const om = p.militar?.om_vinculacao ? omDeVinculacao(p.militar.om_vinculacao)?.nome ?? p.militar.om_vinculacao : null;
    const valor = corrigidos.get(p.id);
    return {
      id: p.id, nome, om, periodo: `${mesAno(p.periodo_inicio)} a ${mesAno(p.periodo_fim)}`, especie: p.especie_divida,
      valor: valor != null ? `R$ ${formatarReais(valor)}` : "R$ —", valorNumero: valor ?? null, situacao: p.situacao,
      // excluir e reabrir: só o criador e o Admin; rascunho de outro operador pode ser continuado; emitido dele, "só consulta"
      meu: ehDonoDoProcesso(perfil, p), editavel: podeAlterarProcesso(perfil, p), descricao: `${p.numero || "s/nº"} de ${nome}`,
      operador: operadores.get(p.id) ?? null,
      emitidoPor: p.situacao !== "rascunho" ? emissores.get(p.id)?.nome ?? null : null,
      // pesquisa: nome, posto (abreviado e como foi gravado), OM e espécie da dívida
      busca: normalizarBusca([nome, p.militar?.posto_graduacao, om, p.militar?.om_vinculacao, p.especie_divida,
        operadores.get(p.id), emissores.get(p.id)?.nome].filter(Boolean).join(" ")),
    };
  });
  if (!cards.length) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="titulo-pagina">Meus cálculos</h1>
          <Link href="/processos/novo" className="botao">Novo cálculo</Link>
        </div>
        <div className="cartao space-y-4 py-10 text-center">
          <p className="rotulo-secao mx-auto max-w-md">Nenhum processo</p>
          <h2 className="text-2xl font-semibold text-carvao">Comece pelas fichas financeiras</h2>
          <p className="mx-auto max-w-lg text-sm text-suave">
            Envie as fichas e o contracheque em PDF e o site cria o processo com os dados do favorecido e os valores recebidos. Também é possível digitar tudo.
          </p>
          <Link href="/processos/novo" className="botao">Criar o primeiro processo</Link>
        </div>
      </div>
    );
  }
  return <ListaProcessos cards={cards} />;
}
