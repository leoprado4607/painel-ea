import { notFound } from "next/navigation";
import { cache } from "react";
import { sessao } from "./sessao";
import type { Lancamento, Militar, Om, Perfil, Processo, RubricaProcesso } from "./tipos";

type Supabase = Awaited<ReturnType<typeof sessao>>["supabase"];

/**
 * Carrega o processo (com militar, OM do processo, rubricas e lançamentos). Admin e operadores acessam todos.
 * Uma vez por requisição (cache): o layout do processo e a página da aba usam o mesmo resultado.
 * Processo, militar e OM vêm numa consulta só; rubricas e lançamentos em paralelo.
 */
export const carregarProcesso = cache(async (id: string) => {
  const { supabase, perfil } = await sessao();
  const [{ data: linha }, { data: rubricas }, { data: lancamentos }] = await Promise.all([
    supabase.from("processo").select("*, militar:militar_id(*), om:om_id(*)").eq("id", id)
      .maybeSingle<Processo & { militar: Militar; om: Om | null }>(),
    supabase.from("processo_rubrica").select("*").eq("processo_id", id).order("posicao").returns<RubricaProcesso[]>(),
    supabase.from("lancamento").select("processo_id, tipo, ano, mes, posicao, valor").eq("processo_id", id).returns<Lancamento[]>(),
  ]);
  if (!linha) notFound();
  const { militar, om, ...processo } = linha;
  // processo de outro operador: só consulta (o banco também barra a gravação)
  const somenteConsulta = !podeAlterarProcesso(perfil, processo);
  return {
    supabase, perfil, om, processo: processo as Processo, militar,
    rubricas: rubricas ?? [],
    lancamentos: (lancamentos ?? []).map((l) => ({ ...l, valor: Number(l.valor) })),
    somenteConsulta,
    bloqueado: somenteConsulta || processo.situacao !== "rascunho",
  };
});

/** Só o criador do processo e o Admin alteram, emitem, reabrem e excluem (decisão de 21/10/2026). */
export function podeAlterarProcesso(perfil: Perfil | null, processo: Pick<Processo, "criado_por">) {
  return perfil?.papel === "admin" || (!!perfil && processo.criado_por === perfil.usuario_id);
}

/** OMs que o Admin pode escolher ao criar um processo (só quando há mais de uma; o operador usa a própria). */
export async function omsParaEscolha(supabase: Supabase, perfil: Perfil | null) {
  if (perfil?.papel !== "admin") return [];
  const { data } = await supabase.from("om").select("id, nome").eq("ativa", true).order("nome");
  return (data ?? []).length > 1 ? data! : [];
}

/** OM de um processo novo: a do operador; para o Admin, a escolhida no formulário ou a única cadastrada. */
export async function omParaNovoProcesso(supabase: Supabase, perfil: Perfil | null, escolhida: string | null) {
  if (!perfil) throw new Error("Usuário sem cadastro.");
  if (perfil.papel !== "admin" && perfil.om_id) return perfil.om_id;
  if (escolhida) return escolhida;
  const { data } = await supabase.from("om").select("id").eq("ativa", true);
  if (data?.length === 1) return data[0]!.id as string;
  throw new Error("Escolha a OM do processo.");
}

/**
 * Rubricas de um processo novo: as despesas da rubrica_padrao; as 12 posições de receita em branco, para o operador
 * escolher na lista da Tab_pag do SIAPPES em "Códigos lançamento" (decisão de 21/10/2026).
 */
export async function inserirRubricasIniciais(supabase: Supabase, processoId: string) {
  const { data: padrao } = await supabase.from("rubrica_padrao").select("posicao, codigo, tipo").order("posicao");
  return supabase.from("processo_rubrica").insert((padrao ?? []).map((r) => ({
    ...r, codigo: r.tipo === "Receita" ? "" : r.codigo, processo_id: processoId,
  })));
}
