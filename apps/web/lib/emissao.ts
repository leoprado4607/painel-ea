import { calcular } from "@painel-ea/engine";
import type { DadosDocumentos, TipoDocumento } from "@painel-ea/documentos";
import { zipSync } from "fflate";
import { caminhoDoZip, nomeDoPacote } from "./pacote";
import { createHash } from "node:crypto";
import { montarEntrada } from "./calculo";
import { dataPorExtenso, descreverRegra } from "./indice";
import { textoBoletim } from "./averbacao";
import { carregarProcesso, operadorDoProcesso } from "./processo";
import { nomeNaAssinatura, postoAbreviado } from "./postos";
import { FUNCAO_RESPONSAVEL, MESES, omDeVinculacao, VALOR_UFIR } from "./tipos";

/** Reúne tudo o que os documentos precisam e gera o PDF do pacote completo. */
export async function montarDocumentos(
  processoId: string,
  opcoes: { rascunho: boolean; versao?: number; tipo?: TipoDocumento; ano?: number },
) {
  const { supabase, perfil, om, processo, militar, rubricas, lancamentos } = await carregarProcesso(processoId);
  // operador que assina: quem criou o processo, mesmo que o PDF seja gerado pelo Admin
  const operador = await operadorDoProcesso(supabase, processoId, perfil);
  if (!om) throw new Error("OM do processo não encontrada.");
  if (!processo.periodo_inicio || !processo.periodo_fim) throw new Error("Informe o período da dívida.");
  // nome da OM e CODOM nos documentos: os da OM de vinculação do militar (o resto vem dos Dados da OM do operador)
  const omVinculacao = omDeVinculacao(militar.om_vinculacao);
  if (!omVinculacao) throw new Error("Escolha a OM de vinculação do militar em Informações.");
  const [{ data: indices }, { data: regras }] = await Promise.all([
    supabase.from("indice_composto").select("ano, mes, percentual"),
    supabase.from("regra_indice").select("vigencia_inicio, serie").order("vigencia_inicio"),
  ]);
  if (!indices?.length) throw new Error("Índices de correção indisponíveis.");
  const entrada = montarEntrada(rubricas, lancamentos, indices, { inicio: processo.periodo_inicio, fim: processo.periodo_fim });
  const resultado = calcular(entrada);
  const ate = resultado.tabela.atualizadoAte!;
  const agora = new Date();
  const quando = agora.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
  const dados: DadosDocumentos = {
    om: {
      nome: omVinculacao.nome, omOrdenador: om.nome, regiaoMilitar: om.regiao_militar, cidadeUf: om.cidade_uf, unidadeGestora: om.unidade_gestora, codom: omVinculacao.codom,
      // assinaturas: "NOME COMPLETO - Posto" (ex.: "LEONARDO PRADO DO MONTE BORGES - Maj")
      ordenadorNome: nomeNaAssinatura(om.ordenador_nome), ordenadorFuncao: om.ordenador_funcao,
    },
    // O operador que criou o processo assina como Auxiliar Div Pg Pes em todos os documentos, menos nas assinaturas do
    // Ordenador (frente da Solicitação de Pagamento, abaixo da data, e o verso) — decisões de 19 e 21/10/2026.
    responsavel: { nome: nomeNaAssinatura(operador?.nome, operador?.posto ?? null), funcao: FUNCAO_RESPONSAVEL },
    militar: {
      postoGraduacao: postoAbreviado(militar.posto_graduacao), nome: militar.nome, precCp: militar.prec_cp, identidade: militar.identidade,
      cpf: militar.cpf, banco: militar.banco, agencia: militar.agencia, conta: militar.conta, situacao: militar.situacao,
    },
    processo: {
      numero: processo.numero, especieDivida: processo.especie_divida,
      periodoInicio: processo.periodo_inicio, periodoFim: processo.periodo_fim,
      // data dos documentos: o dia em que são gerados, no fuso de Brasília ("12 de janeiro de 2026")
      dataExtenso: dataPorExtenso(agora),
      possuiPensaoJudicial: processo.possui_pensao_judicial,
      ano: processo.ano, dataRequerimento: processo.data_requerimento, biNumero: processo.bi_numero, biData: processo.bi_data,
      boletimAverbou: textoBoletim(processo) || null,
    },
    complementos: processo.complementos ?? {},
    rubricas: rubricas.map(({ posicao, codigo, tipo }) => ({ posicao, codigo, tipo })),
    resultado,
    descricaoIndice: descreverRegra(regras ?? []),
    indiceAte: `${MESES[ate.mes - 1]}/${ate.ano}`,
    valorUfir: VALOR_UFIR,
    rodape: opcoes.rascunho
      ? `RASCUNHO — não vale como documento · gerado em ${quando}`
      : `Processo ${processo.numero || "s/nº"} · emitido em ${quando} · versão ${opcoes.versao ?? 1} · índice até ${MESES[ate.mes - 1]}/${ate.ano}`,
  };
  // gerador de PDF carregado só aqui: não pesa na partida das demais páginas
  const { gerarPdf } = await import("@painel-ea/documentos");
  const pdf = await gerarPdf(dados, opcoes.tipo ?? "pacote_completo", opcoes.ano);
  return { pdf, dados, supabase, om, processo, militar, entrada, ate };
}

/**
 * Emite: gera o PDF compilado definitivo e o ZIP (uma pasta com cada documento em PDF separado, com a mesma data e
 * rodapé), guarda os dois no Storage, registra o documento e trava o processo com o índice usado.
 */
export async function emitir(processoId: string) {
  const { supabase } = await carregarProcesso(processoId);
  const { count } = await supabase.from("documento").select("id", { count: "exact", head: true })
    .eq("processo_id", processoId).eq("tipo", "pacote_completo");
  const versao = (count ?? 0) + 1;
  const { pdf, dados, om, processo, militar, entrada, ate } = await montarDocumentos(processoId, { rascunho: false, versao });
  if (processo.situacao !== "rascunho") throw new Error("Processo já emitido.");
  const caminho = `${om!.id}/${processoId}/emissao-v${versao}.pdf`;
  // arquivos separados, numa pasta dentro do ZIP
  const { gerarPartes } = await import("@painel-ea/documentos");
  const pasta = nomeDoPacote(processo.numero, militar.nome);
  const partes = await gerarPartes(dados);
  const zip = zipSync({ [pasta]: Object.fromEntries(partes.map((p) => [p.nome, new Uint8Array(p.pdf)])) });
  const up = await supabase.storage.from("documentos").upload(caminho, pdf, { contentType: "application/pdf", upsert: false });
  if (up.error) throw new Error(`Falha ao guardar o PDF: ${up.error.message}`);
  const upZip = await supabase.storage.from("documentos").upload(caminhoDoZip(caminho), zip, { contentType: "application/zip", upsert: false });
  if (upZip.error) throw new Error(`Falha ao guardar os arquivos separados: ${upZip.error.message}`);
  const indiceAte = `${ate.ano}-${String(ate.mes).padStart(2, "0")}-01`;
  const { data: doc, error } = await supabase.from("documento").insert({
    processo_id: processoId, om_id: om!.id, tipo: "pacote_completo", caminho_storage: caminho,
    sha256: createHash("sha256").update(pdf).digest("hex"), tamanho_bytes: pdf.length, indice_ate: indiceAte, versao,
  }).select("id").single();
  if (error) throw new Error(error.message);
  const usados = entrada.indices.filter((i) => i.percentual !== null);
  const { error: e2 } = await supabase.from("processo")
    .update({ situacao: "emitido", indice_ate: indiceAte, indices_usados: usados }).eq("id", processoId);
  if (e2) throw new Error(e2.message);
  return doc.id as string;
}
