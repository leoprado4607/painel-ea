/**
 * "Processo completo" do Auxílio-fardamento (decisão de 25/11/2026): o operador envia o processo baixado do SPED (ZIP
 * com as peças em PDF, ou as peças soltas). Fichas e contracheque com texto seguem a leitura de sempre (lib/acoes/fichas);
 * das demais peças, só o texto vem para cá, para pré-preencher Informações e o quadro do auxílio. Tudo é sugestão: o
 * operador confere. Peças digitalizadas (só imagem) não são lidas e ficam listadas.
 */
import type { DadosAuxFard } from "./aux-fard";
import { mascaraNumeroProcesso } from "./numero-processo";

export type TipoPeca = "ficha" | "contracheque" | "texto" | "imagem" | "grande" | "ignorada";
/** Peça como chega do navegador: nome no processo e, se tiver, o texto. */
export interface Peca { nome: string; tipo: TipoPeca; texto?: string }

export interface LeituraProcesso {
  nup: string | null;
  ano: number | null;
  dataRequerimento: string | null;
  averbacao: { documento: "BI"; numero: string; data: string | null } | null;
  /** Mês do 2º fato ("AAAA-MM"): vira o período da dívida (a competência). */
  competencia: string | null;
  auxFard: DadosAuxFard;
  /** O que foi lido de cada peça (para a tela). */
  pecas: { nome: string; tipo: TipoPeca; uso: string }[];
  avisos: string[];
}

/** O que fica guardado em complementos.leituraProcesso (para o quadro mostrar). */
export interface LeituraGuardada { pecas: LeituraProcesso["pecas"]; avisos: string[] }
export function leituraGuardada(complementos: unknown): LeituraGuardada | null {
  const l = (complementos as { leituraProcesso?: LeituraGuardada } | null | undefined)?.leituraProcesso;
  return l && Array.isArray(l.pecas) && Array.isArray(l.avisos) ? l : null;
}

/** Maiúsculas, sem acento e com espaços simples (para casar padrões). */
export const normalizar = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[º°ª]/g, "O").toUpperCase().replace(/\s+/g, " ").trim();

const MESES = ["JANEIRO", "FEVEREIRO", "MARCO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
const MESES_CURTOS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
const dd = (n: number) => String(n).padStart(2, "0");
const anoCompleto = (a: string) => (a.length === 2 ? 2000 + Number(a) : Number(a));

/** Datas no texto normalizado: "25 DE DEZEMBRO DE 2021", "1O DE JUNHO DE 2024", "25 DEZ 21", "01JUN25", "24/12/2021". */
const DATA = String.raw`(\d{1,2})O? DE (${MESES.join("|")}) DE (\d{4})|(\d{1,2}) ?(${MESES_CURTOS.join("|")}) ?(\d{4}|\d{2})\b|(\d{1,2})/(\d{1,2})/(\d{4})`;
function lerData(m: RegExpExecArray | RegExpMatchArray): string | null {
  let d: number, mes: number, ano: number;
  if (m[1]) [d, mes, ano] = [+m[1], MESES.indexOf(m[2]!) + 1, +m[3]!];
  else if (m[4]) [d, mes, ano] = [+m[4], MESES_CURTOS.indexOf(m[5]!) + 1, anoCompleto(m[6]!)];
  else [d, mes, ano] = [+m[7]!, +m[8]!, +m[9]!];
  if (!(d >= 1 && d <= 31 && mes >= 1 && mes <= 12 && ano >= 2000 && ano <= 2100)) return null;
  return `${ano}-${dd(mes)}-${dd(d)}`;
}
const primeiraData = (t: string) => {
  const m = new RegExp(DATA).exec(t);
  return m ? lerData(m) : null;
};

/** Postos e graduações no texto → id de lib/soldos (do mais específico ao mais genérico). */
const POSTOS: [RegExp, string][] = [
  [/GEN(ERAL)? DE EXERCITO/, "gen-ex"], [/GEN(ERAL)? DE DIVISAO/, "gen-div"], [/GEN(ERAL)? DE BRIGADA/, "gen-bda"],
  [/TEN(ENTE)?[ -]?CEL|TENENTE[ -]CORONEL|TEN CEL/, "ten-cel"], [/\bCEL\b|CORONEL/, "cel"], [/\bMAJ(OR)?\b/, "maj"], [/\bCAP(ITAO)?\b/, "cap"],
  [/\b1O TEN(ENTE)?\b|PRIMEIRO[ -]TENENTE/, "1-ten"], [/\b2O TEN(ENTE)?\b|SEGUNDO[ -]TENENTE/, "2-ten"], [/ASPIRANTE|\bASP\b/, "asp"],
  [/SUB ?TENENTE|\bS ?TEN\b/, "s-ten"], [/\b1O SGT\b|PRIMEIRO[ -]SARGENTO/, "1-sgt"], [/\b2O SGT\b|SEGUNDO[ -]SARGENTO/, "2-sgt"],
  [/\b3O SGT\b|TERCEIRO[ -]SARGENTO/, "3-sgt"], [/\bCABO\b|\bCB\b/, "cb-eng"],
];
const postoDe = (t: string) => POSTOS.find(([r]) => r.test(t))?.[1] ?? null;
const POSTO_TEXTO = String.raw`(?:GEN(?:ERAL)? DE \w+|TEN(?:ENTE)?[ -]?C(?:E|O)[LR]\w*|CORONEL|CEL|MAJ(?:OR)?|CAP(?:ITAO)?|[123]O TEN(?:ENTE)?|ASPIRANTE|SUB ?TENENTE|S ?TEN|[123]O SGT|(?:PRIMEIRO|SEGUNDO|TERCEIRO)[ -](?:SARGENTO|TENENTE)|CABO)\b`;

/** O posto de destino da promoção: "a 2º Tenente", "ao posto de Capitão", "à graduação de Subtenente". */
function postoDaPromocao(trecho: string): string | null {
  const r = new RegExp(String.raw`(?:\bA|\bAO|POSTO DE|GRADUACAO DE) (${POSTO_TEXTO})`, "g");
  for (const m of trecho.matchAll(r)) {
    const id = postoDe(m[1]!);
    if (id) return id;
  }
  return null;
}

const nomeNormal = (p: Peca) => normalizar(p.nome);
const ehInformacao = (p: Peca) => /INFORMACAO DE REQUERIMENTO|INF\. DE REQUERIMENTO/.test(nomeNormal(p)) || /^.{0,300}INF\. DE REQUERIMENTO/.test(normalizar(p.texto ?? ""));
const ehRequerimento = (p: Peca) => !ehInformacao(p) && (/^\d+\. ?REQUERIMENTO/.test(nomeNormal(p)) || /^.{0,300}\bREQUERIMENTO NO \d/.test(normalizar(p.texto ?? "")));

/**
 * Lê as peças de texto do processo. A Informação de Requerimento (analisada pela OM) vem antes do requerimento e do
 * DIEx de encaminhamento para a data e o posto da promoção.
 */
export function lerProcesso(pecas: Peca[]): LeituraProcesso {
  const avisos: string[] = [];
  const usos = new Map<Peca, string[]>();
  const usar = (p: Peca, u: string) => usos.set(p, [...(usos.get(p) ?? []), u]);
  const comTexto = pecas.filter((p) => p.tipo === "texto" && p.texto);
  const T = (p: Peca) => normalizar(p.texto ?? "");

  // NUP: o da capa (ou o primeiro "EB: ..." de uma peça)
  let nup: string | null = null;
  const capa = comTexto.find((p) => /CAPA DO PROCESSO/.test(nomeNormal(p)) || /PROCESSO NUP/.test(T(p)));
  const mNup = capa && /(\d{5}\.\d{6}\/\d{4}-\d{2})/.exec(T(capa));
  if (capa && mNup) { nup = mNup[1]!; usar(capa, `NUP ${nup}`); }
  const ano = nup ? Number(nup.slice(13, 17)) : null;

  // data do requerimento: a do próprio requerimento; sem ele, "Requerimento datado de ..." da Informação
  let dataRequerimento: string | null = null;
  const req = comTexto.find(ehRequerimento);
  if (req) {
    const m = new RegExp(String.raw`[A-Z]{2}, (?:${DATA})`).exec(T(req));
    // "Natal, RN, 28 de setembro de 2026": a data depois da UF
    if (m) dataRequerimento = primeiraData(m[0].slice(4));
    if (dataRequerimento) usar(req, `data do requerimento ${dataRequerimento.split("-").reverse().join("/")}`);
  }
  const infos = comTexto.filter(ehInformacao);
  if (!dataRequerimento) {
    for (const p of infos) {
      const m = new RegExp(String.raw`REQUERIMENTO DATADO DE (?:${DATA})`).exec(T(p));
      if (m) { dataRequerimento = primeiraData(m[0]); if (dataRequerimento) { usar(p, "data do requerimento"); break; } }
    }
  }

  // averbação: "publicado para averbação no BI nº 29, de 12 de fevereiro de 2026"
  let averbacao: LeituraProcesso["averbacao"] = null;
  for (const p of [...infos, ...comTexto]) {
    const m = new RegExp(String.raw`AVERBACAO NO BI N\w* (\d{1,3}),? DE (?:${DATA})`).exec(T(p));
    if (m) {
      const data = primeiraData(m[0].slice(m[0].indexOf(" DE ") + 4));
      averbacao = { documento: "BI", numero: m[1]!, data };
      usar(p, `averbação no BI ${m[1]}`);
      break;
    }
  }
  if (!averbacao) {
    // peça da averbação pelo nome: "Averbação de Requerimento - BI Nr 67 da Cia C 7ª Bda Inf Mtz - 12 JUN 26"
    const p = pecas.find((x) => /AVERBA/.test(nomeNormal(x)) && /BI N\w* ?\d/.test(nomeNormal(x)));
    const m = p && /BI N\w* ?(\d{1,3})/.exec(nomeNormal(p));
    if (p && m) { averbacao = { documento: "BI", numero: m[1]!, data: primeiraData(nomeNormal(p).slice(m.index + m[0].length)) }; usar(p, `averbação no BI ${m[1]}`); }
  }

  // 2º fato (promoção): data e posto, perto da palavra "promoção"
  const auxFard: DadosAuxFard = { caso: "art61", fato1: {}, fato2: {} };
  const fontes = [...infos, ...comTexto.filter((p) => p === req), ...comTexto.filter((p) => !infos.includes(p) && p !== req && !/CAPA/.test(nomeNormal(p)))];
  for (const p of fontes) {
    const t = T(p);
    for (const m of t.matchAll(/PROMO(?:CAO|VID[AO])/g)) {
      const depois = t.slice(m.index!, m.index! + 220), antes = t.slice(Math.max(0, m.index! - 120), m.index!);
      const mData = new RegExp(String.raw`\bEM (?:${DATA})`).exec(depois);
      const data = mData ? primeiraData(mData[0].slice(3)) : null;
      if (!data) continue;
      // sem o posto junto da data ("promovido à graduação atual, em 1º de junho"), o de outra menção à promoção
      const outra = [...t.matchAll(/PROMO(?:CAO|VID[AO])/g)].map((x) => postoDaPromocao(t.slice(x.index!, x.index! + 60))).find(Boolean);
      auxFard.fato2 = { tipo: "promocao", data, categoria: postoDaPromocao(depois.slice(0, mData!.index)) ?? postoDaPromocao(antes) ?? outra ?? undefined };
      usar(p, "data e posto da promoção (2º fato)");
      break;
    }
    if (auxFard.fato2?.data) break;
  }
  // triênio na mesma data: "completou na mesma data ... 3 (três) anos na mesma graduação de 2º Sgt"
  for (const p of fontes) {
    const m = /MESMA DATA[^.]{0,120}?3 \(TRES\) ANOS NA MESMA (?:GRADUACAO|POSTO)(?: DE)? ([^.,;]{2,30})/.exec(T(p));
    if (m) {
      auxFard.caso = "mesma_data";
      auxFard.fato1 = { tipo: "trienio", categoria: postoDe(m[1]!) ?? undefined };
      usar(p, "triênio na mesma data da promoção");
      break;
    }
  }
  // ato do 2º fato: "conforme BI Nr 239, de 24 DEZ 21, do HGuJP"
  for (const p of fontes) {
    const original = (p.texto ?? "").replace(/\s+/g, " ");
    const m = /conforme (BI|Adt|Aditamento|Boletim)\b[^.;]{3,80}/i.exec(original);
    if (m) { auxFard.ato2 = m[0].replace(/^conforme /i, "").trim().slice(0, 100); usar(p, "BI do ato da promoção"); break; }
  }

  // peças que confirmam as conferências (pelo nome, porque costumam vir digitalizadas)
  const declaracao = pecas.find((p) => /DECLARA/.test(nomeNormal(p)));
  if (declaracao) { auxFard.declaracaoSemAcao = true; usar(declaracao, "declaração (sem ação judicial)"); }
  const reconhecimento = pecas.find((p) => /RECONHECIMENTO DE D\S{2,5}DA\b/.test(nomeNormal(p)) || (p.tipo === "texto" && /RECONHECIMENTO DE DIVIDA/.test(T(p)) && /ADITAMENTO|BOLETIM/.test(T(p).slice(0, 400))));
  if (reconhecimento) { auxFard.reconhecimento = true; usar(reconhecimento, "reconhecimento da dívida"); }

  // avisos
  const pagos = pecas.filter((p) => /PROTOCOLO CPEX|FOLHA CPEX|SOLICITACAO|VALORES DEVIDOS|VALORES RECEBIDOS/.test(nomeNormal(p)));
  if (pagos.length) avisos.push(`O processo já traz cálculo ou protocolo do CPEx (${pagos.map((p) => p.nome).join("; ")}): confira se não é um processo já pago (duplicidade).`);
  const fichasImagem = pecas.filter((p) => p.tipo === "imagem" && /FICHA/.test(nomeNormal(p)));
  if (fichasImagem.length) avisos.push(`Ficha financeira digitalizada (sem texto), não lida: ${fichasImagem.map((p) => p.nome).join("; ")}. Envie também a ficha baixada do SIPPES ou do SIAPPES.`);
  const grandes = pecas.filter((p) => p.tipo === "grande");
  if (grandes.length) avisos.push(`Peças grandes demais para ler (mais de 4 MB), conferidas só pelo nome: ${grandes.map((p) => p.nome).join("; ")}.`);
  if (!pecas.some((p) => p.tipo === "ficha")) avisos.push("Nenhuma ficha financeira com texto no processo: envie as fichas baixadas do SIPPES ou do SIAPPES.");
  if (!nup) avisos.push("Não encontrei o NUP na capa do processo: preencha o Nº do processo em Informações.");
  if (!dataRequerimento) avisos.push("Não encontrei a data do requerimento: preencha em Informações.");
  if (!averbacao) avisos.push("Não encontrei o BI de averbação do requerimento: preencha em Informações.");
  if (!auxFard.fato2?.data) avisos.push("Não encontrei a data da promoção (2º fato): preencha no quadro do Auxílio-fardamento.");

  const competencia = auxFard.fato2?.data ? auxFard.fato2.data.slice(0, 7) : null;
  return {
    nup: nup ? mascaraNumeroProcesso(nup) : null, ano, dataRequerimento, averbacao, competencia, auxFard,
    pecas: pecas.map((p) => ({
      nome: p.nome, tipo: p.tipo,
      uso: usos.get(p)?.join("; ") ?? (p.tipo === "ficha" ? "ficha financeira (valores recebidos e dados do militar)"
        : p.tipo === "contracheque" ? "contracheque (dados bancários)" : p.tipo === "imagem" ? "digitalizada: não lida"
        : p.tipo === "grande" ? "grande demais: não lida" : p.tipo === "ignorada" ? "não usada" : "sem dado aproveitado"),
    })),
    avisos,
  };
}
