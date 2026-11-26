"use server";
import { revalidatePath } from "next/cache";
import { textoBoletim } from "@/lib/averbacao";
import { auxFardAutomatico, casoAuxFard, dataDoFato, planoAuxFard, TIPOS_FATO, type DadosAuxFard, type FatoGerador } from "@/lib/aux-fard";
import { fichasLidasValidas, preencherReceitas } from "@/lib/receitas";
import { sessao } from "@/lib/sessao";
import { categoriaSoldo } from "@/lib/soldos";

const data = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");
const fato = (f: FatoGerador | undefined): FatoGerador => ({
  tipo: TIPOS_FATO.find((t) => t.id === f?.tipo)?.id,
  data: data(f?.data),
  categoria: categoriaSoldo(f?.categoria)?.id ?? "",
  multiplicador: f?.multiplicador === 1 || f?.multiplicador === 1.5 ? f.multiplicador : null,
});

/** Mês inteiro da data: "2023-05-10" → 01/05/2023 a 31/05/2023. */
const periodoDoMes = (d: string) => {
  const ano = +d.slice(0, 4), mes = +d.slice(5, 7);
  return { periodo_inicio: `${d.slice(0, 7)}-01`, periodo_fim: `${d.slice(0, 7)}-${String(new Date(Date.UTC(ano, mes, 0)).getUTCDate()).padStart(2, "0")}` };
};

/** Limpa o que vem da tela (só os campos conhecidos, com a forma certa). */
function limpar(d: DadosAuxFard): DadosAuxFard {
  const vinculos = Object.fromEntries(Object.entries(d.vinculos ?? {})
    .filter(([k, v]) => /^\d{4}-\d{1,2}-[A-Z0-9]+$/.test(k) && (v === 0 || v === 1 || v === 2)));
  return {
    caso: casoAuxFard(d.caso),
    fato1: fato(d.fato1), fato2: fato(d.fato2),
    ato2: typeof d.ato2 === "string" ? d.ato2.trim().slice(0, 100) : "",
    ultimaPromocao: data(d.ultimaPromocao),
    vinculos,
    declaracaoSemAcao: d.declaracaoSemAcao === true, reconhecimento: d.reconhecimento === true, semControversia: d.semControversia === true,
    prescricaoInterrompida: d.prescricaoInterrompida === true, reintegradoSemExpediente: d.reintegradoSemExpediente === true,
    ordemJudicial: d.ordemJudicial === true, anexosConferidos: d.anexosConferidos === true,
    relacionados: typeof d.relacionados === "string" ? d.relacionados.trim().slice(0, 300) : "",
  };
}

/**
 * Grava o quadro do Auxílio-fardamento e refaz devido e recebido automáticos.
 * Com usarTextos, a explicação do não pagamento e o documento que materializa o direito (verso) recebem os textos sugeridos.
 */
export async function salvarAuxFard(processoId: string, dados: DadosAuxFard, usarTextos: boolean): Promise<{ erro?: string; ok?: true }> {
  try {
    const { supabase } = await sessao();
    const { data: p } = await supabase.from("processo")
      .select("situacao, especie_divida, complementos, periodo_inicio, fichas_lidas, data_requerimento, documento_averbacao, adt_numero, adt_boletim, bi_numero, bi_data, om_averbacao")
      .eq("id", processoId).maybeSingle();
    if (!p) return { erro: "Processo não encontrado." };
    if (p.situacao !== "rascunho") return { erro: "Processo já emitido. Use “Corrigir” na aba Impressão para alterar." };
    if (!auxFardAutomatico(p)) return { erro: "Este processo não usa o cálculo automático do Auxílio-fardamento." };
    const auxFard = limpar(dados);
    // somente 3 anos: a data dos 3 anos é contada da última promoção do requerimento
    if (auxFard.caso === "trienio") auxFard.fato2 = { ...auxFard.fato2, tipo: "trienio", data: dataDoFato(auxFard) ?? "" };
    const complementos: Record<string, unknown> = { ...((p.complementos as object) ?? {}), auxFard };
    if (usarTextos) {
      const plano = planoAuxFard({
        fichas: fichasLidasValidas(p.fichas_lidas), dados: auxFard, dataRequerimento: p.data_requerimento,
        periodoInicio: p.periodo_inicio, averbacao: textoBoletim(p), hoje: new Date().toISOString().slice(0, 10),
      });
      if (plano.textos.explicacao) complementos.explicacao = plano.textos.explicacao;
      if (plano.textos.documentos.length) complementos.amparo = plano.textos.documentos.join("\n");
    }
    // somente 3 anos: o mês em que completou os 3 anos (última promoção + 3 anos) é o de referência da dívida (Informações), no lugar do identificado
    const periodo = auxFard.caso === "trienio" && auxFard.fato2?.data ? periodoDoMes(auxFard.fato2.data) : null;
    const { error } = await supabase.from("processo").update({ complementos, ...(periodo ?? {}) }).eq("id", processoId);
    if (error) return { erro: error.message };
    await preencherReceitas(supabase, processoId);
    revalidatePath(`/processos/${processoId}`, "layout");
    return { ok: true };
  } catch (e) {
    return { erro: (e as Error).message };
  }
}
