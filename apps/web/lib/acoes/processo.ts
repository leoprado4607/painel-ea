"use server";
import { cpfValido, precCpValido } from "@painel-ea/engine";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { omParaNovoProcesso } from "@/lib/processo";
import { sessao } from "@/lib/sessao";
import { SITUACOES } from "@/lib/tipos";
import { DOCUMENTOS_AVERBACAO, numeroBoletimValido, OMS_AVERBACAO } from "@/lib/averbacao";

export interface EstadoForm { erro?: string; campos?: Record<string, string> }

const txt = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v === "" ? null : v;
};
/** "2016-01" (input type=month) → "2016-01-01" */
/** Início e fim da dívida: data do calendário ("2025-06-15"); aceita também só o mês ("2025-06" → dia 1). Só ano e mês contam no cálculo. */
const dataPeriodo = (v: string | null) => (!v ? null : /^\d{4}-\d{2}$/.test(v) ? `${v}-01` : /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

export async function salvarProcesso(processoId: string | null, _: EstadoForm | undefined, f: FormData): Promise<EstadoForm> {
  const { supabase, perfil } = await sessao();
  const campos: Record<string, string> = {};
  const nome = txt(f, "nome");
  if (!nome) campos.nome = "Informe o nome do militar.";
  const prec = txt(f, "prec_cp");
  if (prec && !precCpValido(prec)) campos.prec_cp = "Prec-CP com dígito verificador inválido.";
  const cpf = txt(f, "cpf");
  if (cpf && !cpfValido(cpf)) campos.cpf = "CPF inválido.";
  const situacao = txt(f, "situacao");
  if (situacao && !SITUACOES.includes(situacao)) campos.situacao = "Escolha a situação do militar na lista.";
  // averbação: documento e OM só da lista; Nr BI/BAR com 3 dígitos; Nr Adt só quando o documento é "Adt"
  const documentoAverbacao = txt(f, "documento_averbacao");
  if (documentoAverbacao && !(DOCUMENTOS_AVERBACAO as readonly string[]).includes(documentoAverbacao)) campos.documento_averbacao = "Escolha BI, Adt ou BAR.";
  const omAverbacao = txt(f, "om_averbacao");
  if (omAverbacao && !(OMS_AVERBACAO as readonly string[]).includes(omAverbacao)) campos.om_averbacao = "Escolha a OM na lista.";
  const nrBoletim = txt(f, "bi_numero");
  if (nrBoletim && !numeroBoletimValido(nrBoletim)) campos.bi_numero = "Use exatamente 3 dígitos (ex.: 045).";
  const nrAdt = documentoAverbacao === "Adt" ? txt(f, "adt_numero") : null;
  if (nrAdt && !/^\d{1,3}$/.test(nrAdt)) campos.adt_numero = "Até 3 dígitos.";
  const ini = dataPeriodo(txt(f, "periodo_inicio")), fim = dataPeriodo(txt(f, "periodo_fim"));
  if (!ini || !fim) campos.periodo = "Informe o início e o fim da dívida.";
  else if (fim < ini) campos.periodo = "O fim da dívida é anterior ao início.";
  if (Object.keys(campos).length) return { erro: "Corrija os campos destacados.", campos };

  const militar = {
    nome, posto_graduacao: txt(f, "posto_graduacao"), prec_cp: prec, identidade: txt(f, "identidade"),
    cpf, banco: txt(f, "banco"), agencia: txt(f, "agencia"), conta: txt(f, "conta"), situacao: txt(f, "situacao"),
    om_vinculacao: txt(f, "om_vinculacao"),
  };
  const processo = {
    numero: txt(f, "numero"), ano: txt(f, "ano") ? Number(txt(f, "ano")) : null,
    data_requerimento: txt(f, "data_requerimento"), bi_numero: nrBoletim, bi_data: txt(f, "bi_data"),
    documento_averbacao: documentoAverbacao, adt_numero: nrAdt, om_averbacao: omAverbacao,
    especie_divida: txt(f, "especie_divida"), periodo_inicio: ini, periodo_fim: fim,
    data_solicitacao_extenso: txt(f, "data_solicitacao_extenso"), possui_pensao_judicial: f.get("possui_pensao_judicial") === "on",
  };

  if (processoId) {
    const { data: atual } = await supabase.from("processo").select("militar_id").eq("id", processoId).single();
    if (!atual) return { erro: "Processo não encontrado." };
    const r1 = await supabase.from("militar").update(militar).eq("id", atual.militar_id);
    const r2 = await supabase.from("processo").update(processo).eq("id", processoId);
    if (r1.error || r2.error) return { erro: (r1.error ?? r2.error)!.message };
    revalidatePath(`/processos/${processoId}`, "layout");
    redirect(`/processos/${processoId}/rubricas`);
  }

  let omId: string;
  try {
    omId = await omParaNovoProcesso(supabase, perfil, txt(f, "om_id"));
  } catch (e) {
    return { erro: (e as Error).message, campos: { om_id: (e as Error).message } };
  }
  const { data: m, error: e1 } = await supabase.from("militar").insert({ ...militar, om_id: omId }).select("id").single();
  if (e1) return { erro: e1.message };
  const { data: p, error: e2 } = await supabase.from("processo").insert({ ...processo, om_id: omId, militar_id: m.id }).select("id").single();
  if (e2) return { erro: e2.message };
  const { data: padrao } = await supabase.from("rubrica_padrao").select("posicao, codigo, tipo").order("posicao");
  const { error: e3 } = await supabase.from("processo_rubrica").insert((padrao ?? []).map((r) => ({ ...r, processo_id: p.id })));
  if (e3) return { erro: e3.message };
  redirect(`/processos/${p.id}/rubricas`);
}

/**
 * Exclui um processo (só o Admin; o banco também só permite ao Admin). Saem junto, em cascata, lançamentos,
 * rubricas e registros dos documentos; os PDFs emitidos são removidos do Storage; o militar é apagado se não
 * tiver outro processo. A exclusão fica registrada na auditoria.
 */
export async function excluirProcesso(processoId: string): Promise<{ erro?: string }> {
  const { supabase, perfil } = await sessao();
  if (perfil?.papel !== "admin") return { erro: "Somente o Admin pode excluir processos." };
  const { data: processo } = await supabase.from("processo").select("id, militar_id").eq("id", processoId).maybeSingle();
  if (!processo) return { erro: "Processo não encontrado." };
  const { data: docs } = await supabase.from("documento").select("caminho_storage").eq("processo_id", processoId);
  const { data: apagados, error } = await supabase.from("processo").delete().eq("id", processoId).select("id");
  if (error) return { erro: error.message };
  if (!apagados?.length) return { erro: "Não foi possível excluir o processo." };
  const caminhos = (docs ?? []).map((d) => d.caminho_storage).filter(Boolean);
  if (caminhos.length) await supabase.storage.from("documentos").remove(caminhos);
  const { count } = await supabase.from("processo").select("id", { count: "exact", head: true }).eq("militar_id", processo.militar_id);
  if (!count) await supabase.from("militar").delete().eq("id", processo.militar_id);
  revalidatePath("/processos");
  return {};
}
