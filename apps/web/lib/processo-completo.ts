/**
 * "Processo completo" do Auxílio-fardamento e da Gratificação de Representação (decisões de 25/11/2026): o operador envia o processo baixado do SPED (ZIP
 * com as peças em PDF, ou as peças soltas). Fichas e contracheque com texto seguem a leitura de sempre (lib/acoes/fichas);
 * das demais peças, só o texto vem para cá, para pré-preencher Informações e o quadro do auxílio. Tudo é sugestão: o
 * operador confere. Peças digitalizadas (só imagem) não são lidas e ficam listadas.
 */
import type { DadosAuxFard } from "./aux-fard";
import type { DadosGratRep } from "./grat-rep";
import { tipoPeloPercentual, type DadosAdicHab } from "./adic-hab";
import { mascaraNumeroProcesso } from "./numero-processo";

export type TipoPeca = "ficha" | "contracheque" | "texto" | "imagem" | "grande" | "ignorada";
/** Peça como chega do navegador: nome no processo e, se tiver, o texto. */
export interface Peca { nome: string; tipo: TipoPeca; texto?: string }

export interface LeituraProcesso {
  nup: string | null;
  ano: number | null;
  dataRequerimento: string | null;
  averbacao: { documento: "BI"; numero: string; data: string | null } | null;
  /**
   * Período da dívida ("AAAA-MM-DD"): no Auxílio-fardamento, o mês do 2º fato (a competência); na Gratificação de
   * Representação, os dias do evento do militar.
   */
  periodo: { inicio: string; fim: string } | null;
  auxFard: DadosAuxFard;
  gratRep?: DadosGratRep;
  adicHab?: DadosAdicHab;
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
const DATA = String.raw`(\d{1,2})O? D[EC] (${MESES.join("|")}) D[EC] (\d{4})|(\d{1,2}) ?(${MESES_CURTOS.join("|")})[A-Z]{0,6}\.? ?(\d{4}|\d{2})\b|(\d{1,2})/(\d{1,2})/(\d{4})`;
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
  [/SUB ?TENENTE|\bS ?TEN\b/, "s-ten"], [/\b1O (?:SGT|SARGENTO)\b|PRIMEIRO[ -]SARGENTO/, "1-sgt"], [/\b2O (?:SGT|SARGENTO)\b|SEGUNDO[ -]SARGENTO/, "2-sgt"],
  [/\b3O (?:SGT|SARGENTO)\b|TERCEIRO[ -]SARGENTO/, "3-sgt"], [/\bCABO\b|\bCB\b/, "cb-eng"],
];
const postoDe = (t: string) => POSTOS.find(([r]) => r.test(t))?.[1] ?? null;
const POSTO_TEXTO = String.raw`(?:GEN(?:ERAL)? DE \w+|TEN(?:ENTE)?[ -]?C(?:E|O)[LR]\w*|CORONEL|CEL|MAJ(?:OR)?|CAP(?:ITAO)?|[123]O TEN(?:ENTE)?|ASPIRANTE|SUB ?TENENTE|S ?TEN|[123]O (?:SGT|SARGENTO)|(?:PRIMEIRO|SEGUNDO|TERCEIRO)[ -](?:SARGENTO|TENENTE)|CABO)\b`;

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
const ehRequerimento = (p: Peca) => !ehInformacao(p) && (/^\d+\. ?REQUERIMENTO/.test(nomeNormal(p)) || (/REQUERIMENTO/.test(nomeNormal(p)) && !/INFORMACAO|ENTRADA|AVERBA/.test(nomeNormal(p))) || /^.{0,300}\bREQUERIMENTO NO \d/.test(normalizar(p.texto ?? "")));

/**
 * Lê as peças de texto do processo. A Informação de Requerimento (analisada pela OM) vem antes do requerimento e do
 * DIEx de encaminhamento para a data e o posto da promoção.
 */
export function lerProcesso(pecas: Peca[], especie: "aux-fard" | "grat-rep" | "adic-hab" = "aux-fard"): LeituraProcesso {
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
  if (especie === "aux-fard") for (const p of fontes) {
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
  if (especie === "aux-fard") for (const p of fontes) {
    const m = /MESMA DATA[^.]{0,120}?3 \(TRES\) ANOS NA MESMA (?:GRADUACAO|POSTO)(?: DE)? ([^.,;]{2,30})/.exec(T(p));
    if (m) {
      auxFard.caso = "mesma_data";
      auxFard.fato1 = { tipo: "trienio", categoria: postoDe(m[1]!) ?? undefined };
      usar(p, "triênio na mesma data da promoção");
      break;
    }
  }
  // ato do 2º fato: "conforme BI Nr 239, de 24 DEZ 21, do HGuJP"
  if (especie === "aux-fard") for (const p of fontes) {
    const original = (p.texto ?? "").replace(/\s+/g, " ");
    const m = /conforme (BI|Adt|Aditamento|Boletim)\b[^.;]{3,80}/i.exec(original);
    if (m) { auxFard.ato2 = m[0].replace(/^conforme /i, "").trim().slice(0, 100); usar(p, "BI do ato da promoção"); break; }
  }

  // peças que confirmam as conferências (pelo nome, porque costumam vir digitalizadas)
  const declaracao = pecas.find((p) => /DECLARA/.test(nomeNormal(p)) || (p.tipo === "texto" && /^.{0,300}DECLARACAO N/.test(T(p))));
  if (declaracao) { auxFard.declaracaoSemAcao = true; usar(declaracao, "declaração (sem ação judicial)"); }
  const reconhecimento = pecas.find((p) => /RECONHECIMENTO DE D\S{2,5}DA\b/.test(nomeNormal(p)) || (p.tipo === "texto" && /RECONHECIMENTO DE DIVIDA/.test(T(p)) && /ADITAMENTO|BOLETIM/.test(T(p).slice(0, 400))));
  if (reconhecimento) { auxFard.reconhecimento = true; usar(reconhecimento, "reconhecimento da dívida"); }

  // Gratificação de Representação: autorização (Adt/BI do Cmdo Mil A), item do militar, evento e datas
  const gr = especie === "grat-rep" ? lerGratRep(comTexto, pecas, infos, req, usar) : null;
  // Adicional de Habilitação: conclusão do curso, período, percentuais, curso, ato e promoções
  const ah = especie === "adic-hab" ? lerAdicHab([...infos, ...(req ? [req] : []), ...comTexto.filter((p) => !infos.includes(p) && p !== req)], usar) : null;

  // avisos
  const pagos = pecas.filter((p) => /PROTOCOLO CPEX|FOLHA CPEX|SOLICITACAO|VALORES DEVIDOS|VALORES RECEBIDOS/.test(nomeNormal(p)));
  if (pagos.length) avisos.push(`O processo já traz cálculo ou protocolo do CPEx (${pagos.map((p) => p.nome).join("; ")}): confira se não é um processo já pago (duplicidade).`);
  const fichasImagem = pecas.filter((p) => p.tipo === "imagem" && /FICHA/.test(nomeNormal(p)));
  if (fichasImagem.length) avisos.push(`Ficha financeira digitalizada (sem texto), não lida: ${fichasImagem.map((p) => p.nome).join("; ")}. Envie também a ficha baixada do SIPPES ou do SIAPPES.`);
  const grandes = pecas.filter((p) => p.tipo === "grande");
  if (grandes.length) avisos.push(`Peças grandes demais para ler (mais de 4 MB), conferidas só pelo nome: ${grandes.map((p) => p.nome).join("; ")}.`);
  if (!pecas.some((p) => p.tipo === "ficha")) avisos.push("Nenhuma ficha financeira com texto no processo: envie as fichas baixadas do SIPPES ou do SIAPPES.");
  if (!pecas.some((p) => p.tipo === "contracheque")) avisos.push("Sem contracheque: preencha banco, agência e conta em Informações.");
  if (!nup) avisos.push("Não encontrei o NUP na capa do processo: preencha o Nº do processo em Informações.");
  if (!dataRequerimento) avisos.push("Não encontrei a data do requerimento: preencha em Informações.");
  if (!averbacao) avisos.push("Não encontrei o BI de averbação do requerimento: preencha em Informações.");
  if (especie === "aux-fard" && !auxFard.fato2?.data) avisos.push("Não encontrei a data da promoção (2º fato): preencha no quadro do Auxílio-fardamento.");
  if (gr) avisos.push(...gr.avisos);
  if (ah) avisos.push(...ah.avisos);

  let periodo: LeituraProcesso["periodo"] = null;
  if (especie === "aux-fard" && auxFard.fato2?.data) {
    const [a, m] = auxFard.fato2.data.split("-").map(Number) as [number, number];
    periodo = { inicio: `${auxFard.fato2.data.slice(0, 7)}-01`, fim: `${auxFard.fato2.data.slice(0, 7)}-${dd(new Date(Date.UTC(a, m, 0)).getUTCDate())}` };
  } else if (gr?.periodo) periodo = gr.periodo;
  else if (ah?.periodo) periodo = ah.periodo;
  return {
    nup: nup ? mascaraNumeroProcesso(nup) : null, ano, dataRequerimento, averbacao, periodo, auxFard,
    ...(gr ? { gratRep: gr.dados } : {}),
    ...(ah ? { adicHab: ah.dados } : {}),
    pecas: pecas.map((p) => ({
      nome: p.nome, tipo: p.tipo,
      uso: usos.get(p)?.join("; ") ?? (p.tipo === "ficha" ? "ficha financeira (valores recebidos e dados do militar)"
        : p.tipo === "contracheque" ? "contracheque (dados bancários)" : p.tipo === "imagem" ? "digitalizada: não lida"
        : p.tipo === "grande" ? "grande demais: não lida" : p.tipo === "ignorada" ? "não usada" : "sem dado aproveitado"),
    })),
    avisos,
  };
}

const MES_CURTO = String.raw`(${MESES_CURTOS.join("|")})`;
const br = (d: string) => d.split("-").reverse().join("/");
/** "271200 SET 25" (dia, hora, minuto, mês, ano): data e hora. */
function dataHora(m: string[]): { data: string; hora: string } | null {
  const [dia, hh, mm, mes, aa] = m as [string, string, string, string, string];
  if (!(+hh <= 23 && +mm <= 59 && MESES_CURTOS.includes(mes))) return null;
  return { data: `${anoCompleto(aa)}-${dd(MESES_CURTOS.indexOf(mes) + 1)}-${dia}`, hora: `${hh}:${mm}` };
}
const limpar = (s: string) => s.replace(/\s+/g, " ").replace(/[;.,\s]+$/, "").trim();

/**
 * Gratificação de Representação: a autorização (Adt/BI do Cmdo Mil A com "PERIODO TOTAL" por item), o item do militar
 * (o número citado no requerimento; sem ele, o único item), a transcrição no BI da OM e as datas do militar (a Informação
 * traz "Dt Deslocamento" e "Dt Término"; sem elas, o período total do item). As horas só vêm quando o dia do militar é o
 * do período total.
 */
function lerGratRep(comTexto: Peca[], pecas: Peca[], infos: Peca[], req: Peca | undefined, usar: (p: Peca, u: string) => void) {
  const T = (p: Peca) => normalizar(p.texto ?? "");
  const avisos: string[] = [];
  const dados: DadosGratRep = { autorizacao: {}, evento: {} };
  const pedido = [req, ...infos].filter((p): p is Peca => !!p).map((p) => /\bITEM (\d{1,3})\b/.exec(T(p))?.[1]).find(Boolean);
  const aut = comTexto.find((p) => /PERIODO TOTAL/.test(T(p)) && /GRATIFICA\S* DE REPRESENTA/.test(T(p)) && /DOCUMENTO\(S\) DE REFER/.test(T(p)));
  let total: { inicio: { data: string; hora: string }; fim: { data: string; hora: string } } | null = null;
  if (aut) {
    const t = T(aut);
    const cab = /(?:ADITAMENTO|ADT) N\S* ?(\d+\/\d{4}) AO BI (\S+) N\S* ?(\d+)/.exec(t);
    const publicacao = primeiraData(t.slice(0, 800));
    if (cab) dados.autorizacao!.documento = `Adt nº ${cab[1]} ao BI ${cab[2]} nº ${cab[3]}${publicacao ? `, de ${br(publicacao)}` : ""}`;
    if (publicacao) dados.autorizacao!.publicacao = publicacao;
    // itens: "12. DOCUMENTO(S) DE REFERENCIA: ... PERIODO TOTAL: 271200 SET 25 a 041400 OUT 25."
    const original = (aut.texto ?? "").replace(/\s+/g, " ");
    const itens = [...original.matchAll(/(?:^|\s)(\d{1,3})\. ?DOCUMENTO\(S\) DE REFER/gi)].map((m, i, l) => ({
      numero: m[1]!, texto: original.slice(m.index!, l[i + 1]?.index ?? original.length),
    }));
    const item = (pedido && itens.find((x) => x.numero === pedido)) || (itens.length === 1 ? itens[0] : undefined);
    if (item) {
      const campo = (nome: string) => {
        const m = new RegExp(`${nome}:\\s*(.+?)(?:;\\s*[A-Z][A-Z\\s()]{1,40}:|$)`).exec(item.texto);
        return m ? limpar(m[1]!) : undefined;
      };
      dados.evento = { natureza: campo("NATUREZA DA ATIVIDADE"), local: campo("LOCAL DE REALIZA\\S{1,4}O"), amparo: campo("AMPARO LEGAL")?.slice(0, 200) };
      const mp = new RegExp(String.raw`PERIODO TOTAL: ?(\d{2})(\d{2})(\d{2}) ?${MES_CURTO} ?(\d{2}) A (\d{2})(\d{2})(\d{2}) ?${MES_CURTO} ?(\d{2})`).exec(normalizar(item.texto));
      const ini = mp && dataHora(mp.slice(1, 6)), fim = mp && dataHora(mp.slice(6, 11));
      if (ini && fim) total = { inicio: ini, fim };
      usar(aut, `autorização (item ${item.numero}): ${[dados.evento.natureza, dados.evento.local].filter(Boolean).join(", ")}`);
    } else {
      usar(aut, "autorização");
      avisos.push(pedido ? `Não encontrei o item ${pedido} na autorização: preencha o evento e o período.` : "A autorização tem vários itens e o requerimento não diz qual é o do militar: preencha o evento e o período.");
    }
  } else avisos.push("Não encontrei a autorização de pagamento com texto (Adt/BI do Cmdo Mil A): preencha a autorização no quadro da Gratificação de Representação.");

  // transcrição no BI da OM: "BI nº 174/B Adm Gu Natal, transcrição da autorização"
  for (const p of [req, ...infos, ...comTexto].filter((x): x is Peca => !!x)) {
    const m = /\b((?:BI|Bol Int|Boletim Interno)\s*n?[º°o]?\s*(\d{1,3})[^;,.]{0,40}?),?\s*\(?\s*transcri/i.exec((p.texto ?? "").replace(/\s+/g, " "));
    if (m) {
      // a data, pelo nome da peça do BI ("BI 174 20260916")
      const d = pecas.map((x) => new RegExp(`BI ${m[2]} (\\d{4})(\\d{2})(\\d{2})`).exec(nomeNormal(x))).find(Boolean);
      dados.autorizacao!.transcricao = `${limpar(m[1]!)}${d ? `, de ${d[3]}/${d[2]}/${d[1]}` : ""}`;
      usar(p, "transcrição da autorização");
      break;
    }
  }

  // datas do militar
  let periodo: { inicio: string; fim: string } | null = null;
  for (const p of [...infos, ...(req ? [req] : [])]) {
    const t = T(p);
    const ida = new RegExp(String.raw`DESLOCAMENTO[^:]{0,40}: ?(?:${DATA})`).exec(t);
    const volta = new RegExp(String.raw`(?:TERMINO|RETORNO)[^:]{0,40}: ?(?:${DATA})`).exec(t);
    const i = ida && primeiraData(ida[0].slice(ida[0].indexOf(":") + 1)), f = volta && primeiraData(volta[0].slice(volta[0].indexOf(":") + 1));
    if (i && f) { periodo = { inicio: i, fim: f }; usar(p, "datas de deslocamento e término do militar"); break; }
    const mp = new RegExp(String.raw`NO PERIODO DE (?:${DATA}) A (?:${DATA})`).exec(t);
    if (mp) {
      const datas = [...mp[0].matchAll(new RegExp(DATA, "g"))].map(lerData).filter((x): x is string => !!x);
      if (datas.length === 2) { periodo = { inicio: datas[0]!, fim: datas[1]! }; usar(p, "período do evento"); break; }
    }
  }
  const tot = total as typeof total;
  if (!periodo && tot) periodo = { inicio: tot.inicio.data, fim: tot.fim.data };
  if (tot && periodo) {
    if (periodo.inicio === tot.inicio.data) dados.horaSaida = tot.inicio.hora;
    if (periodo.fim === tot.fim.data) dados.horaRetorno = tot.fim.hora;
  }
  if (!periodo) avisos.push("Não encontrei o período do evento: preencha em Informações.");
  else if (tot && (periodo.inicio !== tot.inicio.data || periodo.fim !== tot.fim.data)) {
    avisos.push(`As datas do militar (${br(periodo.inicio)} a ${br(periodo.fim)}) diferem do período total da autorização (${br(tot.inicio.data)} a ${br(tot.fim.data)}): confira nos BI de ida e de retorno, e as horas.`);
  }
  return { dados, periodo, avisos };
}

const ultimoDia = (d: string) => { const [a, m] = d.split("-").map(Number) as [number, number]; return `${d.slice(0, 7)}-${dd(new Date(Date.UTC(a, m, 0)).getUTCDate())}`; };

/**
 * Adicional de Habilitação: a data de conclusão do curso ("concluiu em 12 DEZ 25", "a contar de 12 de dezembro de 2025",
 * "conclusão do estágio (23 de abril de 2021)"), o período ("período de 03 AGO 23 a 31 DEZ 23", "até 31 de dezembro de
 * 2025"), os percentuais ("de 45% para 68%"), o curso, o ato que materializa o direito e as promoções ("soldo de 2º
 * Sargento, a partir da data de sua promoção (1º de junho de 2024)"). A Informação vem antes do requerimento.
 */
function lerAdicHab(fontes: Peca[], usar: (p: Peca, u: string) => void) {
  const T = (p: Peca) => normalizar(p.texto ?? "");
  const avisos: string[] = [];
  const dados: DadosAdicHab = {};
  let inicio: string | null = null, fim: string | null = null;
  for (const p of fontes) {
    const t = T(p);
    const per = new RegExp(String.raw`PERIODO (?:COMPREENDIDO )?(?:DE|ENTRE) (?:${DATA}) A (?:${DATA})`).exec(t);
    if (per && !inicio) {
      const datas = [...per[0].matchAll(new RegExp(DATA, "g"))].map(lerData).filter((x): x is string => !!x);
      if (datas.length === 2) { inicio = datas[0]!; fim = datas[1]!; usar(p, "período da dívida"); }
    }
    if (!inicio) {
      const m = new RegExp(String.raw`A CONTAR DE (?:${DATA})|CONCLU[IS]\w*[^.]{0,160}?\bEM (?:${DATA})|CONCLUSAO[^.()]{0,80}\((?:${DATA})\)`).exec(t);
      const d = m && primeiraData(m[0].slice(Math.max(0, m[0].search(/\d/))));
      if (d) { inicio = d; usar(p, "data de conclusão do curso"); }
    }
    if (!fim) {
      const m = new RegExp(String.raw`\bATE (?:${DATA})`).exec(t);
      const d = m && primeiraData(m[0].slice(4));
      if (d && (!inicio || d > inicio)) { fim = d; usar(p, "fim do período"); }
    }
    if (dados.percentualPedido == null) {
      const m = /\bDE (\d{1,2}) ?% (?:\([^)]*\) )?PARA (\d{1,2}) ?%/.exec(t);
      if (m) { dados.percentualPedido = +m[2]!; usar(p, `percentual pedido (${m[1]}% para ${m[2]}%)`); }
    }
    const original = (p.texto ?? "").replace(/\s+/g, " ");
    if (!dados.curso) {
      const m = /aproveitamento,? (?:o|a) ((?:Curso|Est[áa]gio|Programa|Resid[eê]ncia|Mestrado|Doutorado|P[óo]s)[^;.]{3,120}?)(?:,| na | no | em | realizad| que |\.)/i.exec(original);
      if (m) { dados.curso = m[1]!.trim(); usar(p, "curso"); }
    }
    if (!dados.documento) {
      const m = /materializad[oa] (?:nos seguintes documentos:\s*(?:a\.|a\))?\s*|no |na |nos |em )(.{5,100}?)(?:;| e no | e na | e b\.|\.\s|$)/i.exec(original);
      if (m) { dados.documento = m[1]!.trim(); usar(p, "ato que materializa o direito"); }
    }
    if (!dados.postos?.length) {
      const postos = [...t.matchAll(new RegExp(String.raw`SOLDO DE (${POSTO_TEXTO})[^.;]{0,140}?\((?:${DATA})\)`, "g"))]
        .map((m) => ({ categoria: postoDe(m[1]!), desde: primeiraData(m[0].slice(m[0].lastIndexOf("("))) }))
        .filter((x): x is { categoria: string; desde: string } => !!x.categoria && !!x.desde);
      if (postos.length) { dados.postos = postos; usar(p, "posto/graduação e promoções"); }
    }
  }
  if (inicio && dados.percentualPedido) dados.tipo = tipoPeloPercentual(dados.percentualPedido, inicio) ?? undefined;
  if (dados.postos?.length && inicio && dados.postos[0]!.desde > inicio) dados.postos[0]!.desde = inicio;
  if (inicio && !fim) {
    fim = ultimoDia(inicio);
    avisos.push(`Não encontrei o fim do período: usei o último dia do mês da conclusão (${fim.split("-").reverse().join("/")}). Confira em Informações.`);
  }
  if (!inicio) avisos.push("Não encontrei a data de conclusão do curso: preencha o período em Informações.");
  if (!dados.tipo) avisos.push("Não identifiquei o tipo do curso pelo percentual pedido: escolha no quadro do Adicional de Habilitação.");
  return { dados, periodo: inicio && fim ? { inicio, fim } : null, avisos };
}
