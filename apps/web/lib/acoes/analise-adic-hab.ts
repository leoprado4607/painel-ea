"use server";
import { lerDocumentosPdf, PdfSemTexto } from "@painel-ea/leitor-ficha";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adicHabAutomatico, dadosAdicHab, rubricasAdicHab, RUBRICA_ADIC_HAB, type DadosAdicHab } from "@/lib/adic-hab";
import { analiseAdicHabPendente, analisarAdicHab } from "@/lib/analise-adic-hab";
import { textoBoletim } from "@/lib/averbacao";
import { dadosDoFavorecido, type DocumentoExtraido } from "@/lib/favorecido";
import { lerProcesso, type Peca, type TipoPeca } from "@/lib/processo-completo";
import { fichasLidasDosDocumentos, fichasLidasValidas, mesclarFichasLidas, preencherReceitas } from "@/lib/receitas";
import { sessao } from "@/lib/sessao";
import { gravarTextosVerso, textosSugeridos } from "@/lib/textos-verso";

const hoje = () => new Date().toISOString().slice(0, 10);

/** PDFs enviados na análise: fichas (valores) e contracheques (dados bancários). As demais peças vêm já lidas no navegador. */
async function lerPdfs(form: FormData): Promise<DocumentoExtraido[]> {
  const lidos: DocumentoExtraido[] = [];
  for (const a of form.getAll("documentos").filter((f): f is File => f instanceof File && f.size > 0)) {
    let docs;
    try {
      docs = await lerDocumentosPdf(new Uint8Array(await a.arrayBuffer()));
    } catch (e) {
      throw new Error(e instanceof PdfSemTexto ? `${a.name}: o PDF não tem texto (só a imagem). Baixe a ficha do SIPPES ou do SIAPPES de novo.` : `Não foi possível ler ${a.name}.`);
    }
    for (const d of docs) {
      if (d.tipo === "contracheque") lidos.push({ arquivo: a.name, tipo: "contracheque", ficha: d.ficha, contracheque: d.contracheque });
      else if (d.ficha.ano && d.ficha.linhas.length) lidos.push({ arquivo: docs.length > 1 ? `${a.name} (${d.ficha.ano})` : a.name, tipo: "ficha", ficha: d.ficha });
    }
  }
  return lidos;
}

function pecasDoFormulario(form: FormData): Peca[] {
  const bruto = form.get("processo");
  if (typeof bruto !== "string" || !bruto) return [];
  let lista: unknown;
  try { lista = JSON.parse(bruto); } catch { return []; }
  if (!Array.isArray(lista)) return [];
  const tipos = new Set<TipoPeca>(["ficha", "contracheque", "texto", "imagem", "grande", "ignorada"]);
  return lista.slice(0, 300).filter((x): x is Peca => !!x && typeof x === "object" && typeof (x as Peca).nome === "string" && tipos.has((x as Peca).tipo))
    .map((x) => ({ nome: x.nome.slice(0, 300), tipo: x.tipo, texto: typeof x.texto === "string" ? x.texto.slice(0, 30_000) : undefined }));
}

/**
 * Documentos acrescentados na análise: as fichas entram (a de um ano substitui a guardada), o contracheque preenche os
 * dados bancários que estiverem vazios e as demais peças completam só o que ainda falta (curso, percentual, ato, período,
 * requerimento e averbação). Nada já preenchido é trocado.
 */
export async function complementarAnaliseAdicHab(processoId: string, form: FormData): Promise<{ erro?: string; ok?: true; resumo?: string }> {
  try {
    const { supabase } = await sessao();
    const { data: p } = await supabase.from("processo")
      .select("situacao, especie_divida, complementos, fichas_lidas, periodo_inicio, periodo_fim, data_requerimento, bi_numero, bi_data, documento_averbacao, militar_id")
      .eq("id", processoId).maybeSingle();
    if (!p) return { erro: "Processo não encontrado." };
    if (p.situacao !== "rascunho") return { erro: "Processo já emitido." };
    if (!analiseAdicHabPendente(p)) return { erro: "A análise já foi concluída para este processo." };
    const docs = await lerPdfs(form);
    const pecas = pecasDoFormulario(form);
    if (!docs.length && !pecas.some((x) => x.tipo === "texto")) return { erro: "Nenhum documento com texto foi lido (as peças digitalizadas não são lidas)." };
    const feitos: string[] = [];
    const mudancas: Record<string, unknown> = {};
    const novas = fichasLidasDosDocumentos(docs);
    if (novas.length) {
      mudancas.fichas_lidas = mesclarFichasLidas(fichasLidasValidas(p.fichas_lidas), novas);
      feitos.push(`fichas de ${novas.map((f) => f.ano).sort().join(", ")}`);
    }
    const leitura = pecas.length ? lerProcesso(pecas, "adic-hab") : null;
    const atual = dadosAdicHab(p.complementos);
    const lido: DadosAdicHab = leitura?.adicHab ?? {};
    const adicHab: DadosAdicHab = { ...atual };
    for (const c of ["tipo", "curso", "documento", "percentualPedido"] as const) if (atual[c] == null || atual[c] === "") if (lido[c] != null && lido[c] !== "") (adicHab as Record<string, unknown>)[c] = lido[c];
    if (!atual.postos?.length && lido.postos?.length) adicHab.postos = lido.postos;
    if (JSON.stringify(adicHab) !== JSON.stringify(atual)) {
      mudancas.complementos = { ...((p.complementos as object) ?? {}), adicHab };
      feitos.push("dados do curso");
    }
    if (leitura?.periodo && !p.periodo_inicio) { mudancas.periodo_inicio = leitura.periodo.inicio; feitos.push("início do período"); }
    if (leitura?.periodo && !p.periodo_fim) mudancas.periodo_fim = leitura.periodo.fim;
    if (leitura?.dataRequerimento && !p.data_requerimento) { mudancas.data_requerimento = leitura.dataRequerimento; feitos.push("data do requerimento"); }
    if (leitura?.averbacao && !p.bi_numero) {
      Object.assign(mudancas, { documento_averbacao: leitura.averbacao.documento, bi_numero: leitura.averbacao.numero, bi_data: leitura.averbacao.data });
      feitos.push("averbação");
    }
    if (Object.keys(mudancas).length) {
      const { error } = await supabase.from("processo").update(mudancas).eq("id", processoId);
      if (error) return { erro: error.message };
    }
    // contracheque: só os dados bancários vazios
    const banco = dadosDoFavorecido(docs.filter((d) => d.tipo === "contracheque"));
    if (banco.banco || banco.conta) {
      const { data: m } = await supabase.from("militar").select("banco, agencia, conta").eq("id", p.militar_id).maybeSingle();
      const vazios = Object.fromEntries((["banco", "agencia", "conta"] as const).filter((c) => !m?.[c] && banco[c]).map((c) => [c, banco[c]]));
      if (Object.keys(vazios).length) {
        await supabase.from("militar").update(vazios).eq("id", p.militar_id);
        feitos.push("dados bancários");
      }
    }
    revalidatePath(`/processos/${processoId}`, "layout");
    return { ok: true, resumo: feitos.length ? `Acrescentado: ${feitos.join("; ")}.` : "Os documentos foram lidos, mas não trouxeram nada que faltasse." };
  } catch (e) {
    return { erro: (e as Error).message };
  }
}

/**
 * Prossegue: grava o que a análise entende como o pagamento correto — período, quadro do adicional (postos, meses do 13º,
 * Pensão Militar, Fusex de dependentes), textos do verso — refaz os lançamentos automáticos e grava os atrasados e
 * estornos como lançamentos digitados. Tudo pode ser alterado depois nas telas, como se fosse preenchido à mão.
 */
export async function prosseguirAnaliseAdicHab(processoId: string, estender: boolean): Promise<{ erro?: string }> {
  try {
    const { supabase } = await sessao();
    const { data: p } = await supabase.from("processo")
      .select("situacao, especie_divida, complementos, fichas_lidas, periodo_inicio, periodo_fim, data_requerimento, documento_averbacao, adt_numero, adt_boletim, bi_numero, bi_data, om_averbacao")
      .eq("id", processoId).maybeSingle();
    if (!p) return { erro: "Processo não encontrado." };
    if (p.situacao !== "rascunho") return { erro: "Processo já emitido." };
    if (!analiseAdicHabPendente(p)) redirect(`/processos/${processoId}/dados`);
    const atual = dadosAdicHab(p.complementos);
    const a = analisarAdicHab({ fichas: fichasLidasValidas(p.fichas_lidas), inicio: p.periodo_inicio, fim: p.periodo_fim, dados: atual,
      dataRequerimento: p.data_requerimento, averbacao: textoBoletim(p), hoje: hoje(), estender });
    const complementos: Record<string, unknown> = { ...((p.complementos as object) ?? {}) };
    const mudancas: Record<string, unknown> = {};
    if (a.pronta && adicHabAutomatico(p)) {
      const adicHab: DadosAdicHab = { ...a.dados };
      delete adicHab.textosVerso;
      complementos.adicHab = adicHab;
      // explicação e documentos sugeridos pela análise vão para o verso (o operador edita em Lançar valor devido ou Informações)
      gravarTextosVerso({ complementos, quadro: adicHab, sugeridos: textosSugeridos(a.textos), editados: null, usar: true });
      mudancas.periodo_inicio = a.inicio;
      mudancas.periodo_fim = a.fim;
    }
    complementos.analiseAdicHab = { concluida: hoje(), periodoEstendido: !!a.fimSugerido };
    mudancas.complementos = complementos;
    const { error } = await supabase.from("processo").update(mudancas).eq("id", processoId);
    if (error) return { erro: error.message };
    if (a.pronta && adicHabAutomatico(p)) {
      await preencherReceitas(supabase, processoId);
      if (a.lancamentosDigitados.length) {
        const { data: rubricas } = await supabase.from("processo_rubrica").select("posicao, codigo, tipo").eq("processo_id", processoId);
        const codigos = [...new Set([RUBRICA_ADIC_HAB, ...a.lancamentosDigitados.map((d) => d.rubrica)])];
        const { mudadas, posicoes } = rubricasAdicHab((rubricas ?? []).map((r) => ({ posicao: r.posicao, codigo: r.codigo ?? "", tipo: r.tipo ?? "" })), codigos);
        if (mudadas.length) {
          const { error: e1 } = await supabase.from("processo_rubrica").upsert(mudadas.map((x) => ({ processo_id: processoId, posicao: x.posicao, codigo: x.codigo, tipo: x.tipo })));
          if (e1) return { erro: e1.message };
        }
        const linhas = a.lancamentosDigitados.filter((d) => posicoes[d.rubrica] !== undefined)
          .map((d) => ({ processo_id: processoId, tipo: d.tipo, ano: d.ano, mes: d.mes, posicao: posicoes[d.rubrica]!, valor: d.valor, origem: "digitado", documento_id: null }));
        const { error: e2 } = await supabase.from("lancamento").upsert(linhas);
        if (e2) return { erro: e2.message };
      }
    }
    revalidatePath(`/processos/${processoId}`, "layout");
  } catch (e) {
    if ((e as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw e;
    return { erro: (e as Error).message };
  }
  redirect(`/processos/${processoId}/dados?conferir=banco`);
}
