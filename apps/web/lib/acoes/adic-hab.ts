"use server";
import { revalidatePath } from "next/cache";
import { LIMITE_DOCUMENTO } from "@/lib/amparo";
import { textoBoletim } from "@/lib/averbacao";
import { adicHabAutomatico, planoAdicHab, TABELA_AH, type DadosAdicHab, type TipoCurso } from "@/lib/adic-hab";
import { fichasLidasValidas, preencherReceitas } from "@/lib/receitas";
import { sessao } from "@/lib/sessao";
import { gravarTextosVerso, textosSugeridos, type TextosVerso } from "@/lib/textos-verso";
import { categoriaSoldo } from "@/lib/soldos";

const texto = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const data = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");

/** Limpa o que vem da tela (só os campos conhecidos, com a forma certa). */
function limpar(d: DadosAdicHab): DadosAdicHab {
  const avos = Object.fromEntries(Object.entries(d.avosNatal ?? {}).filter(([a, v]) => /^\d{4}$/.test(a) && Number.isInteger(v) && v >= 1 && v <= 12));
  return {
    tipo: d.tipo && TABELA_AH[d.tipo as TipoCurso] ? d.tipo : undefined,
    curso: texto(d.curso, 160), documento: texto(d.documento, LIMITE_DOCUMENTO),
    percentualPedido: typeof d.percentualPedido === "number" && d.percentualPedido > 0 && d.percentualPedido <= 100 ? d.percentualPedido : null,
    postos: (Array.isArray(d.postos) ? d.postos : []).map((p) => ({ desde: data(p?.desde), categoria: categoriaSoldo(p?.categoria)?.id ?? "" }))
      .filter((p) => p.desde && p.categoria).slice(0, 10),
    natalino: d.natalino !== false, avosNatal: avos,
    ferias: d.ferias !== false,
    mesesFerias: (Array.isArray(d.mesesFerias) ? d.mesesFerias : []).filter((m) => typeof m === "string" && /^\d{4}-\d{1,2}$/.test(m)).slice(0, 60),
    descontos: d.descontos !== false,
    pensao: [7.5, 9.5, 10.5].includes(d.pensao ?? NaN) ? d.pensao : undefined, pensao15: d.pensao15 === true,
    fusexDependentes: d.fusexDependentes === 0.4 || d.fusexDependentes === 0.5 ? d.fusexDependentes : 0,
  };
}

/**
 * Grava o quadro do Adicional de Habilitação e refaz devidos e recebidos automáticos.
 * Os textos do verso editados pelo operador ficam no quadro (lib/textos-verso).
 * Com usarTextos, a explicação do não pagamento e o documento que materializa o direito (verso) recebem os editados ou, sem eles, os sugeridos.
 */
export async function salvarAdicHab(processoId: string, dados: DadosAdicHab, usarTextos: boolean, textosEditados?: TextosVerso | null): Promise<{ erro?: string; ok?: true }> {
  try {
    const { supabase } = await sessao();
    const { data: p } = await supabase.from("processo")
      .select("situacao, especie_divida, complementos, periodo_inicio, periodo_fim, fichas_lidas, data_requerimento, documento_averbacao, adt_numero, adt_boletim, bi_numero, bi_data, om_averbacao").eq("id", processoId).maybeSingle();
    if (!p) return { erro: "Processo não encontrado." };
    if (p.situacao !== "rascunho") return { erro: "Processo já emitido. Use “Corrigir” na aba Impressão para alterar." };
    if (!adicHabAutomatico(p)) return { erro: "Este processo não usa o cálculo automático do Adicional de Habilitação." };
    const adicHab = limpar(dados);
    const complementos: Record<string, unknown> = { ...((p.complementos as object) ?? {}), adicHab };
    const plano = p.periodo_inicio && p.periodo_fim ? planoAdicHab({
      fichas: fichasLidasValidas(p.fichas_lidas), inicio: p.periodo_inicio, fim: p.periodo_fim, dados: adicHab,
      dataRequerimento: p.data_requerimento, averbacao: textoBoletim(p), hoje: new Date().toISOString().slice(0, 10),
    }) : null;
    const erroTextos = gravarTextosVerso({ complementos, quadro: adicHab, sugeridos: textosSugeridos(plano?.textos ?? { explicacao: null, documentos: [] }), editados: textosEditados, usar: usarTextos });
    if (erroTextos) return { erro: erroTextos };
    const { error } = await supabase.from("processo").update({ complementos }).eq("id", processoId);
    if (error) return { erro: error.message };
    await preencherReceitas(supabase, processoId);
    revalidatePath(`/processos/${processoId}`, "layout");
    return { ok: true };
  } catch (e) {
    return { erro: (e as Error).message };
  }
}
