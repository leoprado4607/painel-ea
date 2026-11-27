"use server";
import { lerDocumentosPalavras, lerDocumentosPdf, PdfSemTexto, type DocumentoLido, type Palavra } from "@painel-ea/leitor-ficha";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adicHabAutomatico, dadosAdicHab, rubricasAdicHab, RUBRICA_ADIC_HAB, TIPOS_CURSO, type DadosAdicHab, type TipoCurso } from "@/lib/adic-hab";
import { analiseAdicHabPendente, analisarAdicHab, type ComAnalise } from "@/lib/analise-adic-hab";
import { aplicarFichaDigitada, fichaDigitadaValida } from "@/lib/ficha-digitada";
import { textoBoletim } from "@/lib/averbacao";
import { dadosDoFavorecido, type DocumentoExtraido } from "@/lib/favorecido";
import { textoDasPalavras } from "@/lib/ler-peca";
import { lerProcesso, type Peca, type TipoPeca } from "@/lib/processo-completo";
import { fichasLidasDosDocumentos, fichasLidasValidas, mesclarFichasLidas, preencherReceitas, type FichaLida } from "@/lib/receitas";
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

/** Peças lidas no navegador (OCR de PDF escaneado, ou texto de PDF grande demais para enviar): as palavras com posição. */
interface LidaNavegador { nome: string; ocr: boolean; palavras: Palavra[] }
function lidasNoNavegador(form: FormData): LidaNavegador[] {
  const bruto = form.get("navegador");
  if (typeof bruto !== "string" || !bruto) return [];
  let lista: unknown;
  try { lista = JSON.parse(bruto); } catch { return []; }
  if (!Array.isArray(lista)) return [];
  const num = (v: unknown) => typeof v === "number" && Number.isFinite(v);
  return lista.slice(0, 60).flatMap((x) => {
    if (!x || typeof x !== "object" || typeof x.nome !== "string" || !Array.isArray(x.palavras)) return [];
    const palavras = (x.palavras as unknown[]).slice(0, 40_000).filter((p): p is Palavra => !!p && typeof p === "object"
      && typeof (p as Palavra).texto === "string" && num((p as Palavra).x) && num((p as Palavra).y) && num((p as Palavra).largura) && Number.isInteger((p as Palavra).pagina))
      .map((p) => ({ texto: p.texto.slice(0, 80), x: p.x, y: p.y, largura: p.largura, pagina: p.pagina, tamanho: num(p.tamanho) ? p.tamanho : undefined, inclinada: !!p.inclinada }));
    return [{ nome: x.nome.slice(0, 300), ocr: !!x.ocr, palavras }];
  });
}

/** Interpreta as peças lidas no navegador: ficha, contracheque (com os dados bancários) ou texto do processo. */
function interpretarLidas(lidas: LidaNavegador[]) {
  const docs: DocumentoExtraido[] = [], docsOcr: DocumentoExtraido[] = [], pecas: Peca[] = [];
  for (const l of lidas) {
    if (!l.palavras.length) { pecas.push({ nome: l.nome, tipo: "imagem" }); continue; }
    let lidos: DocumentoLido[] = [];
    try { lidos = lerDocumentosPalavras(l.palavras); } catch { /* segue como texto */ }
    const [cc] = lidos;
    const destino = l.ocr ? docsOcr : docs;
    if (cc?.tipo === "contracheque" && (cc.contracheque.cabecalho.banco || cc.contracheque.cabecalho.conta)) {
      destino.push({ arquivo: l.nome, tipo: "contracheque", ficha: cc.ficha, contracheque: cc.contracheque });
      continue;
    }
    const fichas = lidos.filter((d) => d.tipo === "ficha" && d.ficha.ano && d.ficha.linhas.length);
    if (fichas.length) {
      for (const d of fichas) destino.push({ arquivo: fichas.length > 1 ? `${l.nome} (${d.ficha.ano})` : l.nome, tipo: "ficha", ficha: d.ficha });
      continue;
    }
    pecas.push({ nome: l.nome, tipo: "texto", texto: textoDasPalavras(l.palavras) });
  }
  // fichas lidas por OCR: marcadas, com a conferência dos totais impressos (onde o OCR pode ter errado um número)
  const fichasOcr: FichaLida[] = fichasLidasDosDocumentos(docsOcr).map((f) => {
    const d = docsOcr.find((x) => x.tipo === "ficha" && x.ficha.ano === f.ano)!;
    return { ...f, origem: "ocr", arquivo: d.arquivo, conferencia: {
      linhas: d.ficha.conferencias.linhasDivergentes, meses: d.ficha.conferencias.mesesDivergentes,
      incompletas: d.ficha.avisos.map((x) => /^([A-Z0-9]{3,6}): esperava/.exec(x)?.[1]).filter((x): x is string => !!x),
      semTotais: !d.ficha.totaisLiquidos,
    } };
  });
  return { docs, docsOcr, fichasOcr, pecas };
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
    const lidasNav = lidasNoNavegador(form);
    const nav = interpretarLidas(lidasNav);
    const docs = [...await lerPdfs(form), ...nav.docs];
    const pecas = [...pecasDoFormulario(form), ...nav.pecas];
    if (!docs.length && !nav.docsOcr.length && !pecas.some((x) => x.tipo === "texto")) {
      const ilegiveis = pecas.filter((x) => x.tipo === "imagem").map((x) => x.nome);
      return { erro: ilegiveis.length
        ? `Nenhum texto foi reconhecido em: ${ilegiveis.join("; ")}. Se a digitalização estiver ilegível, digite os dados em “Dados do direito” e “Digitar valores da ficha”.`
        : "Nenhum documento do processo foi lido nos arquivos enviados." };
    }
    const feitos: string[] = [];
    const mudancas: Record<string, unknown> = {};
    // as do PDF com texto valem mais que as do OCR do mesmo ano
    const novas = mesclarFichasLidas(nav.fichasOcr, fichasLidasDosDocumentos(docs));
    if (novas.length) {
      mudancas.fichas_lidas = mesclarFichasLidas(fichasLidasValidas(p.fichas_lidas), novas);
      const ocr = novas.filter((f) => f.origem === "ocr").map((f) => f.ano);
      feitos.push(`fichas de ${novas.map((f) => f.ano).sort().join(", ")}${ocr.length ? ` (${ocr.join(", ")} por OCR: confira os valores)` : ""}`);
    }
    docs.push(...nav.docsOcr.filter((d) => d.tipo === "contracheque"));
    const comOcr = lidasNav.filter((l) => l.ocr && l.palavras.length).length;
    if (comOcr) feitos.push(`${comOcr} peça(s) escaneada(s) lida(s) por OCR`);
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

/** Abre a ação só no processo novo de Adic Hab com a análise pendente (os já registrados não mudam). */
async function processoDaAnalise(processoId: string, colunas: string) {
  const { supabase } = await sessao();
  const { data: p } = await supabase.from("processo").select(`situacao, especie_divida, complementos, ${colunas}`).eq("id", processoId).maybeSingle<Record<string, unknown> & ComAnalise & { situacao: string }>();
  if (!p) return { erro: "Processo não encontrado." } as const;
  if (p.situacao !== "rascunho") return { erro: "Processo já emitido." } as const;
  if (!analiseAdicHabPendente(p)) return { erro: "A análise já foi concluída para este processo: altere os dados nas telas seguintes." } as const;
  return { supabase, p } as const;
}

const DATA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Dados do direito digitados na análise, quando o processo (escaneado ou ilegível) não os trouxe: início do direito, fim
 * do período pedido, data do requerimento, tipo e nome do curso, ato que reconheceu o direito e percentual pedido.
 * Grava o que o operador deixou no formulário (já vem preenchido com o que foi lido).
 */
export async function informarDireitoAdicHab(processoId: string, d: {
  inicio: string; fim: string; dataRequerimento: string; tipo: string; curso: string; documento: string; percentualPedido: string;
}): Promise<{ erro?: string }> {
  try {
    const r = await processoDaAnalise(processoId, "periodo_inicio, periodo_fim, data_requerimento");
    if ("erro" in r) return { erro: r.erro };
    const { supabase, p } = r;
    for (const [rotulo, v] of [["início do direito", d.inicio], ["fim do período", d.fim], ["data do requerimento", d.dataRequerimento]] as const)
      if (v && !DATA.test(v)) return { erro: `Data inválida: ${rotulo}.` };
    if (d.inicio && d.fim && d.fim < d.inicio) return { erro: "O fim do período é anterior ao início do direito." };
    if (d.tipo && !TIPOS_CURSO.includes(d.tipo as TipoCurso)) return { erro: "Tipo do curso inválido." };
    const pct = d.percentualPedido.trim() ? Number(d.percentualPedido.replace(",", ".")) : null;
    if (pct !== null && (!Number.isFinite(pct) || pct <= 0 || pct > 100)) return { erro: "Percentual pedido inválido." };
    const atual = dadosAdicHab(p.complementos);
    const adicHab: DadosAdicHab = { ...atual, curso: d.curso.trim().slice(0, 200) || undefined, documento: d.documento.trim().slice(0, 200) || undefined,
      tipo: (d.tipo || undefined) as TipoCurso | undefined, percentualPedido: pct };
    const { error } = await supabase.from("processo").update({
      periodo_inicio: d.inicio || null, periodo_fim: d.fim || null, data_requerimento: d.dataRequerimento || null,
      complementos: { ...((p.complementos as object) ?? {}), adicHab },
    }).eq("id", processoId);
    if (error) return { erro: error.message };
    revalidatePath(`/processos/${processoId}`, "layout");
    return {};
  } catch (e) {
    return { erro: (e as Error).message };
  }
}

/** Valores da ficha de um ano digitados na análise (PDF ilegível, ou correção de um número lido por OCR). */
export async function gravarFichaDigitadaAdicHab(processoId: string, ano: number, valores: unknown): Promise<{ erro?: string }> {
  try {
    if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) return { erro: "Ano inválido." };
    const d = fichaDigitadaValida(valores);
    if (!d) return { erro: "Valores inválidos: use números como 1.234,56 (deixe em branco o que for zero)." };
    const r = await processoDaAnalise(processoId, "fichas_lidas");
    if ("erro" in r) return { erro: r.erro };
    const { supabase, p } = r;
    const fichas = aplicarFichaDigitada(fichasLidasValidas(p.fichas_lidas), ano, d);
    const { error } = await supabase.from("processo").update({ fichas_lidas: fichas }).eq("id", processoId);
    if (error) return { erro: error.message };
    revalidatePath(`/processos/${processoId}`, "layout");
    return {};
  } catch (e) {
    return { erro: (e as Error).message };
  }
}
