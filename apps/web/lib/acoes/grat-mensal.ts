"use server";
import { revalidatePath } from "next/cache";
import { LIMITE_DOCUMENTO } from "@/lib/amparo";
import { gratMensalAutomatico, planoGratMensal, type DadosGratMensal } from "@/lib/grat-mensal";
import { fichasLidasValidas, preencherReceitas } from "@/lib/receitas";
import { sessao } from "@/lib/sessao";
import { categoriaSoldo } from "@/lib/soldos";

const texto = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Limpa o que vem da tela (só os campos conhecidos, com a forma certa). */
function limpar(d: DadosGratMensal): DadosGratMensal {
  return {
    categoria: categoriaSoldo(d.categoria)?.id ?? "",
    localidade: d.localidade === "A" || d.localidade === "B" ? d.localidade : undefined,
    local: texto(d.local, 120), documento: texto(d.documento, LIMITE_DOCUMENTO),
    considerados: Array.isArray(d.considerados) ? d.considerados.filter((c) => typeof c === "string" && /^\d{4}-\d{1,2}-[A-Z0-9]+$/.test(c)) : [],
  };
}

/**
 * Grava o quadro das gratificações mensais (localidade especial e comando) e refaz devidos e recebidos automáticos.
 * Com usarTextos, a explicação do não pagamento e o documento que materializa o direito (verso) recebem os sugeridos.
 */
export async function salvarGratMensal(processoId: string, dados: DadosGratMensal, usarTextos: boolean): Promise<{ erro?: string; ok?: true }> {
  try {
    const { supabase } = await sessao();
    const { data: p } = await supabase.from("processo")
      .select("situacao, especie_divida, complementos, periodo_inicio, periodo_fim, fichas_lidas, data_requerimento").eq("id", processoId).maybeSingle();
    if (!p) return { erro: "Processo não encontrado." };
    if (p.situacao !== "rascunho") return { erro: "Processo já emitido. Use “Corrigir” na aba Impressão para alterar." };
    if (!gratMensalAutomatico(p)) return { erro: "Este processo não usa o cálculo automático desta gratificação." };
    const gratMensal = limpar(dados);
    const complementos: Record<string, unknown> = { ...((p.complementos as object) ?? {}), gratMensal };
    if (usarTextos && p.periodo_inicio && p.periodo_fim) {
      const plano = planoGratMensal({
        fichas: fichasLidasValidas(p.fichas_lidas), especie: p.especie_divida, inicio: p.periodo_inicio, fim: p.periodo_fim, dados: gratMensal,
        dataRequerimento: p.data_requerimento, hoje: new Date().toISOString().slice(0, 10),
      });
      if (plano.textos.explicacao) complementos.explicacao = plano.textos.explicacao;
      if (plano.textos.documentos.length) complementos.amparo = plano.textos.documentos.join("\n");
    }
    const { error } = await supabase.from("processo").update({ complementos }).eq("id", processoId);
    if (error) return { erro: error.message };
    await preencherReceitas(supabase, processoId);
    revalidatePath(`/processos/${processoId}`, "layout");
    return { ok: true };
  } catch (e) {
    return { erro: (e as Error).message };
  }
}
