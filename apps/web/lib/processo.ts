import { notFound } from "next/navigation";
import { sessao } from "./sessao";
import type { Lancamento, Militar, Om, Perfil, Processo, RubricaProcesso } from "./tipos";

type Supabase = Awaited<ReturnType<typeof sessao>>["supabase"];

/** Carrega o processo (com militar, OM do processo, rubricas e lançamentos). Admin e operadores acessam todos. */
export async function carregarProcesso(id: string) {
  const { supabase, perfil } = await sessao();
  const { data: processo } = await supabase.from("processo").select("*").eq("id", id).maybeSingle<Processo>();
  if (!processo) notFound();
  const [{ data: militar }, { data: om }, { data: rubricas }, { data: lancamentos }] = await Promise.all([
    supabase.from("militar").select("*").eq("id", processo.militar_id).single<Militar>(),
    supabase.from("om").select("*").eq("id", processo.om_id).maybeSingle<Om>(),
    supabase.from("processo_rubrica").select("*").eq("processo_id", id).order("posicao").returns<RubricaProcesso[]>(),
    supabase.from("lancamento").select("processo_id, tipo, ano, mes, posicao, valor").eq("processo_id", id).returns<Lancamento[]>(),
  ]);
  return {
    supabase, perfil, om, processo, militar: militar!,
    rubricas: rubricas ?? [],
    lancamentos: (lancamentos ?? []).map((l) => ({ ...l, valor: Number(l.valor) })),
    bloqueado: processo.situacao !== "rascunho",
  };
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
