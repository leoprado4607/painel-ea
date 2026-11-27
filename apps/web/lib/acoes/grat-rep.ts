"use server";
import { revalidatePath } from "next/cache";
import { LIMITE_DOCUMENTO } from "@/lib/amparo";
import { textoBoletim } from "@/lib/averbacao";
import { gratRepAutomatico, planoGratRep, type DadosGratRep } from "@/lib/grat-rep";
import { fichasLidasValidas, preencherReceitas } from "@/lib/receitas";
import { sessao } from "@/lib/sessao";
import { gravarTextosVerso, textosSugeridos, type TextosVerso } from "@/lib/textos-verso";
import { categoriaSoldo } from "@/lib/soldos";

const texto = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const numero = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);

/** Limpa o que vem da tela (só os campos conhecidos, com a forma certa). */
function limpar(d: DadosGratRep): DadosGratRep {
  const hora = (h: unknown) => (typeof h === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(h) ? h : "");
  const a = d.autorizacao ?? {};
  return {
    categoria: categoriaSoldo(d.categoria)?.id ?? "",
    horaSaida: hora(d.horaSaida), horaRetorno: hora(d.horaRetorno),
    autorizacao: {
      documento: texto(a.documento, LIMITE_DOCUMENTO), transcricao: texto(a.transcricao, LIMITE_DOCUMENTO),
      publicacao: typeof a.publicacao === "string" && /^\d{4}-\d{2}-\d{2}$/.test(a.publicacao) ? a.publicacao : "",
      dias: numero(a.dias) === null ? null : Math.round(a.dias!), valor: numero(a.valor),
    },
    evento: { natureza: texto(d.evento?.natureza), local: texto(d.evento?.local), amparo: texto(d.evento?.amparo) },
    despachoOd: d.despachoOd === true, bisConferidos: d.bisConferidos === true,
    considerados: Array.isArray(d.considerados) ? d.considerados.filter((c) => typeof c === "string" && /^\d{4}-\d{1,2}-[A-Z0-9]+$/.test(c)) : [],
  };
}

/**
 * Grava o quadro da Gratificação de Representação e refaz devido e recebidos automáticos.
 * Os textos do verso editados pelo operador ficam no quadro (lib/textos-verso).
 * Com usarTextos, a explicação do não pagamento e o documento que materializa o direito (verso) recebem os editados ou, sem eles, os sugeridos.
 */
export async function salvarGratRep(processoId: string, dados: DadosGratRep, usarTextos: boolean, textosEditados?: TextosVerso | null): Promise<{ erro?: string; ok?: true }> {
  try {
    const { supabase } = await sessao();
    const { data: p } = await supabase.from("processo")
      .select("situacao, especie_divida, complementos, periodo_inicio, periodo_fim, fichas_lidas, data_requerimento, documento_averbacao, adt_numero, adt_boletim, bi_numero, bi_data, om_averbacao").eq("id", processoId).maybeSingle();
    if (!p) return { erro: "Processo não encontrado." };
    if (p.situacao !== "rascunho") return { erro: "Processo já emitido. Use “Corrigir” na aba Impressão para alterar." };
    if (!gratRepAutomatico(p)) return { erro: "Este processo não usa o cálculo automático da Gratificação de Representação." };
    const gratRep = limpar(dados);
    const complementos: Record<string, unknown> = { ...((p.complementos as object) ?? {}), gratRep };
    const plano = p.periodo_inicio && p.periodo_fim ? planoGratRep({
      fichas: fichasLidasValidas(p.fichas_lidas), inicio: p.periodo_inicio, fim: p.periodo_fim, dados: gratRep,
      dataRequerimento: p.data_requerimento, averbacao: textoBoletim(p), hoje: new Date().toISOString().slice(0, 10),
    }) : null;
    const erroTextos = gravarTextosVerso({ complementos, quadro: gratRep, sugeridos: textosSugeridos(plano?.textos ?? { explicacao: null, documentos: [] }), editados: textosEditados, usar: usarTextos });
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
