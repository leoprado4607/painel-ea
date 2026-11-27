/**
 * Cálculo automático da diferença de "Auxílio fardamento" (decisão de 24/11/2026), no molde da Gratificação de
 * Representação (lib/grat-rep). Vale só para os processos criados a partir dessa data (complementos.calculoAutomaticoAuxFard).
 *
 * Base: MP 2.215-10/2001 (Tabela II do Anexo IV); art. 61 do Decreto 4.307/2002, revogado pelo Decreto 12.645/2025 (DOU
 * 02/10/2025); Parecer 645/2025/CONJUR-EB (reconhecimento administrativo; prescrição contada do 2º fato gerador);
 * Parecer 250/2026/CONJUR-EB e DIEx 2750-APG 8/SEF (triênio e promoção na mesma data: dois auxílios, com bases distintas);
 * DIEx 1677-S1/10º CGCFEx (CFO: matrícula e nomeação, 1,5 soldo cada); DIEx 757-ASSE1/SEF (reintegrado sem expediente).
 *
 * Quatro casos (26/11/2026: "somente promoção" e "somente 3 anos" a pedido do usuário):
 * - promocao: só a promoção, não paga (ou paga em parte) por já ter recebido outro auxílio em menos de 1 ano.
 *   Devido = 1 × soldo do novo posto na data da promoção.
 * - trienio: só os 3 anos no mesmo posto ou graduação, idem. Devido = 1 × soldo do posto em que completou os 3 anos.
 * - mesma_data: triênio e promoção na mesma data, e só um (ou a diferença) foi pago.
 *   Devido = triênio × soldo do posto em que completou os 3 anos + promoção × soldo do novo posto.
 * - art61: o 2º fato ocorreu em menos de 1 ano do 1º recebimento e foi pago só pela diferença.
 *   Devido = multiplicador do 2º fato × soldo do posto na data do 2º fato.
 * Em todos, o auxílio-fardamento já recebido é procurado nas fichas e ligado pela data: o pago no mês do fato ou nos
 * 12 seguintes é o recebido por ele; o pago nos 12 meses antes é o auxílio anterior (o 1º fato, no art. 61).
 * Recebido = os pagamentos das fichas ligados ao fato cobrado (o operador confirma); a diferença e a correção ficam com o motor.
 * Tudo no mês da competência (o mês do 2º fato, mesmo que pago depois), na A56 (1 soldo) ou A57 (1,5 soldo), corrigido
 * pela série composta, como os processos pagos conferidos em 25/11/2026 (64552.001271/2026-66, .000474/2026-35,
 * .001265/2026-17, 64360.000907/2026-18 e 64592.001115/2026-29).
 * Os alertas não bloqueiam a emissão.
 */
import type { FichaLida } from "./receitas";
import { categoriaSoldo, soldoNaData } from "./soldos";
import type { TextosVerso } from "@/lib/textos-verso";

export const ESPECIE_AUX_FARD = "Auxílio fardamento";
export const RUBRICA_AUX_FARD_1 = "A56 - AUX FARD 1 SOLDO";
export const RUBRICA_AUX_FARD_15 = "A57 - AUX FARD 1.5 SLD";
/** Auxílio-fardamento nas fichas: SIPPES (NR/AR/ER 0056 e 0057) e SIAPPES (A56, A57, A26 atrasado, AEG exercício anterior). */
export const CODIGOS_AUX_FARD = new Set(["NR0056", "NR0057", "AR0056", "AR0057", "ER0056", "ER0057", "A56", "A57", "A26", "AEG"]);
const CODIGOS_SOLDO = new Set(["NR0001", "A01"]);
/** Publicação do Decreto 12.645/2025, que revogou o art. 61. */
export const REVOGACAO_ART61 = "2025-10-02";

export type TipoFato = "aspirante" | "nomeacao" | "matricula_cfo" | "promocao" | "trienio" | "outro";
export const TIPOS_FATO: { id: TipoFato; nome: string; multiplicador: number | null }[] = [
  { id: "aspirante", nome: "Declaração de aspirante / promoção a 3º Sgt (alínea b)", multiplicador: 1.5 },
  { id: "nomeacao", nome: "Nomeação de oficial ou sargento (alínea c)", multiplicador: 1.5 },
  { id: "matricula_cfo", nome: "Matrícula em escola de formação / CFO (alínea c)", multiplicador: 1.5 },
  { id: "promocao", nome: "Promoção (alínea g) – 1 soldo do novo posto", multiplicador: 1 },
  { id: "trienio", nome: "Três anos no mesmo posto ou graduação (alínea h)", multiplicador: 1 },
  { id: "outro", nome: "Outra alínea (multiplicador informado)", multiplicador: null },
];

export interface FatoGerador {
  tipo?: TipoFato;
  /** "AAAA-MM-DD" (pelo BI do ato) */
  data?: string;
  /** Posto/graduação (id de lib/soldos): no triênio, o posto em que completou os 3 anos; na promoção, o novo. */
  categoria?: string;
  /** Só para "outro" (no 1º fato, se vazio, vem do valor pago ÷ soldo). */
  multiplicador?: number | null;
}

export type CasoAuxFard = "promocao" | "trienio" | "mesma_data" | "art61";
/** Opções do quadro, na ordem da tela. */
export const CASOS_AUX_FARD: { id: CasoAuxFard; nome: string }[] = [
  { id: "promocao", nome: "Somente promoção" },
  { id: "trienio", nome: "Somente 3 anos no mesmo posto ou graduação" },
  { id: "mesma_data", nome: "Promoção e 3 anos na mesma data, pago só um auxílio" },
  { id: "art61", nome: "Dois fatos em menos de 1 ano, o 2º pago só pela diferença (art. 61)" },
];
export const casoAuxFard = (v: unknown): CasoAuxFard => CASOS_AUX_FARD.find((c) => c.id === v)?.id ?? "art61";
/** Casos de um fato só (promoção ou triênio). */
export const casoUnico = (c: CasoAuxFard): c is "promocao" | "trienio" => c === "promocao" || c === "trienio";

/** O que o operador informa no quadro (complementos.auxFard). */
export interface DadosAuxFard {
  /** Textos do verso editados pelo operador (lib/textos-verso); sem eles, valem os sugeridos pelo cálculo. */
  textosVerso?: TextosVerso;
  caso?: CasoAuxFard;
  fato1?: FatoGerador;
  fato2?: FatoGerador;
  /** BI do ato do 2º fato gerador (nº e data). */
  ato2?: string;
  /** Somente 3 anos: data da última promoção informada no requerimento; os 3 anos se completam 3 anos depois. */
  ultimaPromocao?: string;
  /**
   * Pagamento das fichas → fato: "2021-7-NR0056" → 1. Vazio: o sugerido. 2 = recebido pelo fato cobrado;
   * 1 = 1º fato (art. 61) ou auxílio anterior (somente promoção / somente 3 anos); 0 = não é deste pedido;
   * 3 = recebido posterior, de outro fato gerador (não entra no cálculo nem gera o alerta de auxílio não ligado).
   */
  vinculos?: Record<string, VinculoPagamento>;
  declaracaoSemAcao?: boolean;
  reconhecimento?: boolean;
  semControversia?: boolean;
  prescricaoInterrompida?: boolean;
  reintegradoSemExpediente?: boolean;
  ordemJudicial?: boolean;
  anexosConferidos?: boolean;
  /** Outros processos de auxílio-fardamento do militar (NUP e objeto). */
  relacionados?: string;
}

export type VinculoPagamento = 0 | 1 | 2 | 3;
export interface Pagamento { ano: number; mes: number; codigo: string; descricao: string; valor: number; chave: string; fato: VinculoPagamento; sugerido: boolean }
export interface Alerta { codigo: string; descricao: string }
export interface PlanoAuxFard {
  caso: CasoAuxFard;
  pagamentos: Pagamento[];
  multiplicador1: number | null;
  multiplicador2: number | null;
  soldo1: number | null;
  soldo2: number | null;
  /** Auxílio integral devido pelo(s) fato(s) cobrado(s). */
  devido: number | null;
  recebido: number;
  diferenca: number | null;
  competencia: { ano: number; mes: number } | null;
  /** "A56 - AUX FARD 1 SOLDO" ou "A57 - AUX FARD 1.5 SLD" */
  rubrica: string;
  prescricao: { limite: string; referencia: string } | null;
  devidos: { ano: number; mes: number; valor: number }[];
  recebidos: { ano: number; mes: number; valor: number }[];
  notas: Record<string, string>;
  alertas: Alerta[];
  pendencias: string[];
  textos: { explicacao: string | null; documentos: string[] };
}

const k = (ano: number, mes: number) => ano * 12 + mes;
const centavos = (v: number) => Math.round(v * 100) / 100;
const reais = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const br = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
const mm = (ano: number, mes: number) => `${String(mes).padStart(2, "0")}/${ano}`;
const dataValida = (d: string | undefined): d is string => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d);
const somarAnos = (d: string, n: number) => `${Number(d.slice(0, 4)) + n}${d.slice(4, 10)}`;
const diasEntre = (a: string, b: string) => Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 86_400_000);
const multiplicadorDoTipo = (f: FatoGerador | undefined) =>
  f?.tipo === "outro" ? (f.multiplicador ?? null) : TIPOS_FATO.find((t) => t.id === f?.tipo)?.multiplicador ?? null;
const PELO: Record<TipoFato, string> = {
  aspirante: "pela declaração de aspirante (ou promoção a 3º Sgt)", nomeacao: "pela nomeação", matricula_cfo: "pela matrícula em escola de formação",
  promocao: "pela promoção", trienio: "pelos 3 anos no mesmo posto ou graduação", outro: "pelo fato gerador",
};
const peloFato = (t: TipoFato | undefined) => (t ? PELO[t] : "pelo fato gerador");
const FOI: Record<TipoFato, string> = {
  aspirante: "foi declarado aspirante (ou promovido a 3º Sgt)", nomeacao: "foi nomeado", matricula_cfo: "foi matriculado em escola de formação",
  promocao: "foi promovido", trienio: "completou 3 anos no mesmo posto ou graduação", outro: "teve o fato gerador",
};
const OFICIAIS = new Set(["gen-ex", "gen-div", "gen-bda", "cel", "ten-cel", "maj", "cap", "1-ten", "2-ten", "asp"]);
const AO_POSTO = (id: string) => (OFICIAIS.has(id) ? "ao posto de" : "à graduação de");
const NA_GRADUACAO = (id: string) => (OFICIAIS.has(id) ? "no posto de" : "na graduação de");
const MESES_CURTOS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
/** "25 DEZ 22", como nos processos; o dia primeiro sai "1º JUN 25". */
export const dataCurta = (d: string) => `${d.slice(8, 10) === "01" ? "1º" : d.slice(8, 10)} ${MESES_CURTOS[+d.slice(5, 7) - 1]} ${d.slice(2, 4)}`;
/** Documento que materializou o direito nos processos pagos (até 100 caracteres: lib/amparo). */
export const DOCUMENTO_DIREITO = "DIEx nº 995-APG 8/APG SubCh/APG Ch/Ch SEF - Circular, de 05 MAR 26 (Parecer da SEF)";

/** Data em que completa 3 anos no posto: a da promoção + 3 anos (29 FEV → 28 FEV). */
export function tresAnosDepois(d: string): string {
  const ano = +d.slice(0, 4) + 3, mes = +d.slice(5, 7);
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return `${ano}-${d.slice(5, 7)}-${String(Math.min(+d.slice(8, 10), ultimo)).padStart(2, "0")}`;
}

/** Data do fato cobrado: no "somente 3 anos", contada da última promoção do requerimento; nos demais, a informada. */
export function dataDoFato(dados: DadosAuxFard): string | undefined {
  if (casoAuxFard(dados.caso) !== "trienio") return dados.fato2?.data;
  // sem a última promoção, a promoção lida do processo (fato2 com tipo "promocao") é a do requerimento
  const promocao = dados.ultimaPromocao || (dados.fato2?.tipo === "promocao" ? dados.fato2.data : undefined);
  return dataValida(promocao) ? tresAnosDepois(promocao) : dados.fato2?.tipo === "promocao" ? undefined : dados.fato2?.data;
}

/** O processo segue a automação: criado depois da mudança e com a espécie do auxílio-fardamento. */
export function auxFardAutomatico(p: { especie_divida?: string | null; complementos?: unknown }): boolean {
  const c = p.complementos as { calculoAutomaticoAuxFard?: unknown } | null | undefined;
  return p.especie_divida === ESPECIE_AUX_FARD && c?.calculoAutomaticoAuxFard === true;
}

export function dadosAuxFard(complementos: unknown): DadosAuxFard {
  const d = (complementos as { auxFard?: unknown } | null | undefined)?.auxFard;
  return d && typeof d === "object" ? (d as DadosAuxFard) : {};
}

/** Teto do art. 19 da Port C Ex 1.746/2022: 4 soldos de Capitão vigentes na data. */
export const tetoArt19 = (data: string) => {
  const s = soldoNaData("cap", data);
  return s === null ? null : 4 * s;
};

function linhas(fichas: FichaLida[], codigos: Set<string>) {
  const lista: { ano: number; mes: number; codigo: string; descricao: string; valor: number }[] = [];
  for (const f of fichas)
    for (const l of f.linhas) {
      const codigo = l.codigo.trim().toUpperCase();
      if (!codigos.has(codigo)) continue;
      l.meses.forEach((v, i) => {
        if (!v) return;
        const atual = lista.find((x) => x.ano === f.ano && x.mes === i + 1 && x.codigo === codigo);
        if (atual) atual.valor = centavos(atual.valor + v);
        else lista.push({ ano: f.ano, mes: i + 1, codigo, descricao: l.descricao, valor: centavos(v) });
      });
    }
  return lista.sort((a, b) => k(a.ano, a.mes) - k(b.ano, b.mes) || a.codigo.localeCompare(b.codigo));
}

/**
 * @param periodoInicio início do período da dívida ("AAAA-MM-DD"): deve ser o mês da competência
 * @param averbacao texto do documento de averbação (entra também no documento que materializou o direito)
 * @param hoje "AAAA-MM-DD" (data da análise)
 */
export function planoAuxFard(entrada: {
  fichas: FichaLida[]; dados: DadosAuxFard; dataRequerimento?: string | null; periodoInicio?: string | null;
  averbacao?: string | null; hoje: string;
}): PlanoAuxFard {
  const { fichas, dados, hoje } = entrada;
  const caso = casoAuxFard(dados.caso);
  const unico = casoUnico(caso);
  // somente promoção / somente 3 anos: o fato cobrado é o "2º" (fato2), com o tipo do caso; não há 1º fato informado
  const f1 = unico ? {} : dados.fato1 ?? {};
  const f2: FatoGerador = unico ? { ...dados.fato2, tipo: caso, multiplicador: null, data: dataDoFato(dados) } : dados.fato2 ?? {};
  const alertas: Alerta[] = [];
  const pendencias: string[] = [];
  const soldoFicha = linhas(fichas, CODIGOS_SOLDO);
  const soldoNoMes = (ano: number, mes: number) => soldoFicha.filter((l) => l.ano === ano && l.mes === mes).reduce((s, l) => centavos(s + l.valor), 0) || null;

  // datas e postos
  const fatoCobrado = unico ? (caso === "promocao" ? "da promoção" : "dos 3 anos") : "do 2º fato gerador";
  if (!dataValida(f2.data)) pendencias.push(caso === "trienio" ? "Informe a data da última promoção (do requerimento): os 3 anos contam dela." : `Informe a data ${fatoCobrado} (pelo BI do ato).`);
  if (caso === "art61" && !dataValida(f1.data)) pendencias.push("Informe a data do 1º fato gerador.");
  if (!f2.tipo) pendencias.push("Informe o tipo do 2º fato gerador.");
  if (!categoriaSoldo(f2.categoria)) pendencias.push(
    caso === "mesma_data" || caso === "promocao" ? "Informe o novo posto/graduação (promoção)."
      : caso === "trienio" ? "Informe o posto/graduação em que completou os 3 anos." : "Informe o posto/graduação do 2º fato gerador.");
  if (caso === "mesma_data" && !categoriaSoldo(f1.categoria)) pendencias.push("Informe o posto/graduação em que completou os 3 anos (triênio).");
  // os 3 anos no posto não têm BI próprio: o documento que os ampara é o da última promoção
  if (!dados.ato2?.trim()) alertas.push({ codigo: "ATO_FATO_GERADOR_AUSENTE", descricao: caso === "trienio"
    ? "Informe o BI da última promoção (o documento que ampara os 3 anos no posto ou graduação)."
    : `Informe o BI do ato ${unico ? fatoCobrado : "do 2º fato gerador (promoção, nomeação, matrícula ou triênio)"}.` });
  // no caso de mesma data, o triênio e a promoção são na mesma data (a do 2º fato)
  const data2 = dataValida(f2.data) ? f2.data : null;
  const dataInformada1 = caso === "mesma_data" ? data2 : caso === "art61" && dataValida(f1.data) ? f1.data : null;

  // auxílio-fardamento já recebido, nas fichas, e a qual fato cada pagamento se liga (o operador confirma; sem resposta, a sugestão)
  const brutos = linhas(fichas, CODIGOS_AUX_FARD);
  const vinculos = dados.vinculos ?? {};
  const temVinculo = Object.keys(vinculos).length > 0;
  const meses = [...new Set(brutos.map((p) => k(p.ano, p.mes)))].sort((a, b) => a - b);
  const mesDe = (d: string) => k(+d.slice(0, 4), +d.slice(5, 7));
  let mesRecebido: number | undefined, mesAnterior: number | undefined;
  if (data2) {
    // pela data: o pago no mês do fato ou nos 12 seguintes é o recebido por ele (o soldo novo e o auxílio podem sair depois);
    // o anterior: no art. 61, o 1º pago a partir do 1º fato; nos demais, o último pago nos 12 meses antes do fato
    const m2 = mesDe(data2);
    mesRecebido = meses.find((m) => m >= m2 && m <= m2 + 12);
    if (caso === "art61" && dataInformada1) mesAnterior = meses.find((m) => m >= mesDe(dataInformada1) && m < m2);
    else if (caso !== "mesma_data") mesAnterior = [...meses].reverse().find((m) => m < m2 && m >= m2 - 12);
  } else if (caso === "art61") [mesAnterior, mesRecebido] = meses;
  else mesRecebido = meses[0];
  const pagamentos: Pagamento[] = brutos.map((p) => {
    const chave = `${p.ano}-${p.mes}-${p.codigo}`;
    const m = k(p.ano, p.mes);
    const sugerido: 0 | 1 | 2 = m === mesRecebido ? 2 : m === mesAnterior ? 1 : 0;
    const fato = temVinculo ? (vinculos[chave] ?? 0) : sugerido;
    return { ...p, chave, fato: caso === "mesma_data" && fato === 1 ? 0 : fato, sugerido: !temVinculo && fato !== 0 };
  });
  for (const p of pagamentos.filter((x) => x.fato === 3 && data2 && k(x.ano, x.mes) < mesDe(data2))) {
    alertas.push({ codigo: "VINCULO_INCOERENTE", descricao: `${p.codigo} de R$ ${reais(p.valor)} em ${mm(p.ano, p.mes)} foi marcado como recebido posterior, mas é anterior ao fato (${br(data2!)}): confira a ligação.` });
  }
  if (!temVinculo && pagamentos.some((p) => p.fato)) pendencias.push("Confirme a qual fato gerador se refere cada pagamento de auxílio-fardamento das fichas (a ligação foi sugerida pelas datas).");
  const pagos1 = pagamentos.filter((p) => p.fato === 1), pagos2 = pagamentos.filter((p) => p.fato === 2);
  const valorPago1 = centavos(pagos1.reduce((s, p) => s + p.valor, 0));
  const recebido = centavos(pagos2.reduce((s, p) => s + p.valor, 0));
  const data1 = dataInformada1;

  // multiplicadores e soldos
  let multiplicador1: number | null = caso === "mesma_data" ? 1 : multiplicadorDoTipo(f1);
  let soldo1: number | null = null;
  if (caso === "art61" && pagos1.length) {
    const p = pagos1[0]!;
    // soldo cheio: no mês da incorporação ou do fato, a NR0001 pode ser proporcional (Laurence: praça em 12 JUL 21);
    // vale o maior entre o mês do pagamento e os 2 seguintes
    const meses3 = [0, 1, 2].map((d) => soldoNoMes(p.ano + Math.floor((p.mes - 1 + d) / 12), ((p.mes - 1 + d) % 12) + 1)).filter((v): v is number => v !== null);
    const base = (meses3.length ? Math.max(...meses3) : null) ?? (data1 && categoriaSoldo(f1.categoria) ? soldoNaData(f1.categoria, data1) : null);
    if (base) {
      const m = Math.round((valorPago1 / base) * 100) / 100;
      soldo1 = base;
      if (m === 1 || m === 1.5) multiplicador1 = m;
      else alertas.push({ codigo: "MULTIPLICADOR_INDEFINIDO", descricao: `O auxílio do 1º fato (R$ ${reais(valorPago1)}) dividido pelo soldo do mês (R$ ${reais(base)}) dá ${m.toLocaleString("pt-BR")}, nem 1 nem 1,5 soldo.` });
    }
  } else if (caso === "mesma_data" && data2) soldo1 = soldoNaData(f1.categoria, data2);
  const multiplicador2 = multiplicadorDoTipo(f2);
  if (f2.tipo === "outro" && multiplicador2 === null) alertas.push({ codigo: "MULTIPLICADOR_INDEFINIDO", descricao: "Informe o multiplicador do 2º fato gerador (1 ou 1,5 soldo)." });
  const soldo2 = data2 ? soldoNaData(f2.categoria, data2) : null;
  if (data2 && categoriaSoldo(f2.categoria) && soldo2 === null) pendencias.push(`Não há soldo na tabela para ${br(data2)} (a tabela começa em 2018).`);

  // competência: o mês do 2º fato, mesmo que o pagamento tenha saído depois (processo 64552.000474/2026-35: promoção em
  // ago/2022, paga 1 ano depois, competência ago/2022); sem a data, o mês do pagamento
  const competencia = data2 ? { ano: +data2.slice(0, 4), mes: +data2.slice(5, 7) } : pagos2.length ? { ano: pagos2[0]!.ano, mes: pagos2[0]!.mes } : null;
  if (soldo2 !== null && competencia) {
    const fichaComp = soldoNoMes(competencia.ano, competencia.mes), fichaFato = data2 ? soldoNoMes(+data2.slice(0, 4), +data2.slice(5, 7)) : null;
    // o soldo novo pode só entrar no mês seguinte ao fato ou no do pagamento (promoção em 25 DEZ, soldo em JAN)
    const seguinte = competencia.mes === 12 ? soldoNoMes(competencia.ano + 1, 1) : soldoNoMes(competencia.ano, competencia.mes + 1);
    const confere = [fichaComp, fichaFato, seguinte, ...pagos2.map((p) => soldoNoMes(p.ano, p.mes))].some((v) => v === soldo2);
    if (!confere && (fichaComp ?? fichaFato) !== null) {
      alertas.push({ codigo: "SOLDO_DIVERGENTE", descricao: `O soldo da tabela para ${categoriaSoldo(f2.categoria)!.nome} em ${br(data2!)} é R$ ${reais(soldo2)}; a NR0001 da ficha traz R$ ${reais((fichaComp ?? fichaFato)!)} (pode ser proporcional ou de outro posto): confira.` });
    }
  }

  // devido integral
  let devido: number | null = null;
  if (caso === "mesma_data") {
    devido = soldo1 !== null && soldo2 !== null && multiplicador2 !== null ? centavos(1 * soldo1 + multiplicador2 * soldo2) : null;
  } else if (soldo2 !== null && multiplicador2 !== null) devido = centavos(multiplicador2 * soldo2);
  const diferenca = devido !== null ? centavos(devido - recebido) : null;
  if (diferenca !== null && diferenca <= 0) alertas.push({ codigo: "SEM_DIFERENCA", descricao: `O recebido ${unico ? "por este fato" : "pelo 2º fato"} (R$ ${reais(recebido)}) cobre o devido (R$ ${reais(devido!)}): não há diferença.` });

  // enquadramento
  if (caso === "art61") {
    if (data2 && (pagos1.length || data1)) {
      // 1 ano contado do 1º recebimento (Parecer 645, item 8): pelo mês do pagamento na ficha; sem ele, pela data do 1º fato
      const inicio = pagos1.length ? `${pagos1[0]!.ano}-${String(pagos1[0]!.mes).padStart(2, "0")}-01` : data1!;
      const dias = diasEntre(inicio, data2);
      if (dias >= 365 + 31) alertas.push({ codigo: "FORA_DA_TESE", descricao: `O 2º fato (${br(data2)}) é mais de 1 ano depois do 1º recebimento (${pagos1.length ? mm(pagos1[0]!.ano, pagos1[0]!.mes) : br(data1!)}): o art. 61 não se aplicava.` });
      else if (dias >= 365 - 31) pendencias.push(`O 2º fato (${br(data2)}) está perto de 1 ano do 1º recebimento (${pagos1.length ? mm(pagos1[0]!.ano, pagos1[0]!.mes) : br(data1!)}): confira o dia exato do pagamento.`);
      if (dias < 0) alertas.push({ codigo: "FORA_DA_TESE", descricao: "O 2º fato é anterior ao 1º recebimento: confira a ligação dos pagamentos." });
    }
    // valor pago pelo 2º fato = auxílio do 2º − auxílio do 1º
    if (devido !== null && pagos1.length && Math.abs(recebido - centavos(devido - valorPago1)) > 0.01) {
      alertas.push({ codigo: "FORA_DA_TESE", descricao: `O pago pelo 2º fato (R$ ${reais(recebido)}) não é a diferença entre os auxílios (R$ ${reais(devido)} − R$ ${reais(valorPago1)} = R$ ${reais(centavos(devido - valorPago1))}).` });
    }
    if (diferenca !== null && multiplicador1 !== null && multiplicador1 === multiplicador2 && pagos1.length && Math.abs(diferenca - valorPago1) > 0.01) {
      alertas.push({ codigo: "CONFERENCIA_DIFERENCA", descricao: `Com o mesmo multiplicador nos dois fatos, a diferença (R$ ${reais(diferenca)}) deveria ser igual ao 1º auxílio (R$ ${reais(valorPago1)}).` });
    }
    if ((data2 && data2 >= REVOGACAO_ART61) || (data1 && data1 >= REVOGACAO_ART61)) {
      alertas.push({ codigo: "NAO_E_DEA", descricao: `Fato gerador a partir de ${br(REVOGACAO_ART61)} (revogação do art. 61): não é DEA desta tese; o pagamento é corrente.` });
    }
  }
  if (unico && data2) {
    // a tese: não pago (ou pago em parte) por já ter recebido outro auxílio em menos de 1 ano (art. 61, revogado)
    const anterior = pagos1.at(-1);
    if (anterior) {
      const dias = diasEntre(`${anterior.ano}-${String(anterior.mes).padStart(2, "0")}-01`, data2);
      if (dias >= 365 + 31) alertas.push({ codigo: "FORA_DA_TESE", descricao: `O auxílio anterior (${mm(anterior.ano, anterior.mes)}) é de mais de 1 ano antes de ${br(data2)}: a restrição do art. 61 não se aplicava.` });
      else if (dias < 0) alertas.push({ codigo: "FORA_DA_TESE", descricao: "O auxílio anterior é posterior ao fato: confira a ligação dos pagamentos." });
    } else {
      alertas.push({ codigo: "SEM_AUXILIO_ANTERIOR", descricao: `Nenhum auxílio-fardamento nas fichas nos 12 meses antes de ${br(data2)}: confira por que o auxílio ${fatoCobrado} não foi pago à época (a tese é a restrição de 1 ano do art. 61) e se a ficha do ano anterior foi enviada.` });
    }
    if (data2 >= REVOGACAO_ART61) alertas.push({ codigo: "NAO_E_DEA", descricao: `Fato gerador a partir de ${br(REVOGACAO_ART61)} (revogação do art. 61): não é DEA desta tese; o pagamento é corrente.` });
  }
  if (competencia && competencia.ano >= +hoje.slice(0, 4)) {
    alertas.push({ codigo: "NAO_E_DEA", descricao: `A competência (${mm(competencia.ano, competencia.mes)}) é do exercício corrente: o pagamento é em folha, não por DEA.` });
  }
  if (entrada.periodoInicio && competencia && (+entrada.periodoInicio.slice(0, 4) !== competencia.ano || +entrada.periodoInicio.slice(5, 7) !== competencia.mes)) {
    alertas.push({ codigo: "DIVERGENCIA_COMPETENCIA", descricao: `O período da dívida (Informações) começa em ${mm(+entrada.periodoInicio.slice(0, 4), +entrada.periodoInicio.slice(5, 7))}, mas a competência (mês do 2º fato) é ${mm(competencia.ano, competencia.mes)}: ajuste o período.` });
  }

  // prescrição: 5 anos do 2º fato (Parecer 645, item 70.3), até o requerimento
  let prescricao: PlanoAuxFard["prescricao"] = null;
  if (data2) {
    const limite = somarAnos(data2, 5);
    const referencia = dataValida(entrada.dataRequerimento ?? undefined) ? entrada.dataRequerimento! : hoje;
    prescricao = { limite, referencia };
    if (referencia > limite) {
      if (dados.prescricaoInterrompida) pendencias.push(`Pedido depois do limite da prescrição (${br(limite)}), com interrupção ou suspensão do prazo informada: confira o ato que interrompeu.`);
      else alertas.push({ codigo: "PRESCRITO", descricao: `O pedido (${br(referencia)}) é posterior ao limite da prescrição (${br(limite)}, 5 anos do 2º fato): sugere-se indeferir.` });
    } else if (!dataValida(entrada.dataRequerimento ?? undefined) && diasEntre(hoje, limite) < 60) {
      alertas.push({ codigo: "PRAZO_PRESCRICIONAL_PROXIMO", descricao: `Faltam menos de 60 dias para o limite da prescrição (${br(limite)}).` });
    }
  }

  // duplicidade: pagamento na ficha do ano corrente (o CPEx paga parte dos casos automaticamente)
  const anoAtual = +hoje.slice(0, 4);
  if (!fichas.some((f) => f.ano === anoAtual)) alertas.push({ codigo: "FICHA_AUSENTE", descricao: `Falta a ficha financeira de ${anoAtual} (ano corrente), para conferir se o CPEx já pagou a diferença.` });
  else for (const p of pagamentos.filter((x) => x.ano === anoAtual && x.fato === 0)) {
    alertas.push({ codigo: "POSSIVEL_DUPLICIDADE", descricao: `${p.codigo} de R$ ${reais(p.valor)} em ${mm(p.ano, p.mes)} (ano corrente): pode ser o pagamento desta diferença pelo CPEx.` });
  }
  // auxílio-fardamento pago depois do fato e não ligado a este pedido (fora do ano corrente, já visto acima): pode ser o
  // próprio pagamento deste fato; os anteriores ao fato são de outros fatos geradores
  for (const p of pagamentos.filter((x) => x.ano !== anoAtual && x.fato === 0 && (!data2 || k(x.ano, x.mes) >= mesDe(data2)))) {
    alertas.push({ codigo: "AUX_FARD_NAS_FICHAS", descricao: `${p.codigo} de R$ ${reais(p.valor)} em ${mm(p.ano, p.mes)} não foi ligado a este pedido: confira se não é o pagamento deste fato.` });
  }
  if (competencia && !fichas.some((f) => f.ano === competencia.ano)) alertas.push({ codigo: "FICHA_AUSENTE", descricao: `Falta a ficha financeira de ${competencia.ano} (ano do 2º fato).` });

  // conferências do Parecer 645 (item 67) e elegibilidade
  if (dados.reintegradoSemExpediente && !dados.ordemJudicial) alertas.push({ codigo: "INELEGIVEL", descricao: "Reintegrado judicial que não responde a expediente não tem direito ao auxílio-fardamento, salvo ordem judicial expressa (DIEx 757-ASSE1/SEF)." });
  if (dados.relacionados?.trim()) alertas.push({ codigo: "PROCESSO_RELACIONADO", descricao: `Outro processo de auxílio-fardamento do militar: ${dados.relacionados.trim()}. Confirme que não trata do mesmo fato gerador.` });

  const rubrica = multiplicador2 === 1.5 ? RUBRICA_AUX_FARD_15 : RUBRICA_AUX_FARD_1;
  const devidos = devido !== null && competencia ? [{ ...competencia, valor: devido }] : [];
  const recebidos = competencia && recebido > 0 ? [{ ...competencia, valor: recebido }] : [];
  const notas: Record<string, string> = {};
  if (devido !== null && competencia) {
    const anterior = pagos1.at(-1);
    notas[`${competencia.ano}-${competencia.mes}`] = unico
      ? `Auxílio-fardamento ${peloFato(f2.tipo)} em ${br(data2!)} (restrição de 1 ano do art. 61 do Dec 4.307/2002, revogado), 1 × R$ ${reais(soldo2!)} (${categoriaSoldo(f2.categoria)!.nome}) = R$ ${reais(devido)}; recebido R$ ${reais(recebido)}; diferença R$ ${reais(diferenca!)}${anterior ? ` (auxílio anterior: R$ ${reais(valorPago1)} em ${mm(anterior.ano, anterior.mes)})` : ""}.`
      : caso === "mesma_data"
      ? `Auxílio-fardamento (triênio e promoção em ${br(data2!)}, Parecer 250/2026/CONJUR-EB): triênio 1 × R$ ${reais(soldo1!)} (${categoriaSoldo(f1.categoria)!.nome}) + promoção ${multiplicador2!.toLocaleString("pt-BR")} × R$ ${reais(soldo2!)} (${categoriaSoldo(f2.categoria)!.nome}) = R$ ${reais(devido)}; recebido R$ ${reais(recebido)}; diferença R$ ${reais(diferenca!)}.`
      : `Auxílio-fardamento (art. 61 do Dec 4.307/2002, revogado) ${peloFato(f2.tipo)} em ${br(data2!)}, ${multiplicador2!.toLocaleString("pt-BR")} × R$ ${reais(soldo2!)} (${categoriaSoldo(f2.categoria)!.nome}) = R$ ${reais(devido)}; recebido R$ ${reais(recebido)}; diferença R$ ${reais(diferenca!)}${pagos1.length ? ` (1º auxílio: R$ ${reais(valorPago1)})` : ""}.`;
  }

  let explicacao: string | null = null;
  if (data2) {
    // no modelo dos processos pagos (verso da Solicitação de Pagamento)
    const novo = categoriaSoldo(f2.categoria)?.nome;
    const posto = novo ? ` ${AO_POSTO(f2.categoria!)} ${novo}` : "";
    const naEpoca = recebido > 0 ? "só recebeu a diferença do auxílio-fardamento" : `não recebeu o auxílio-fardamento ${caso === "trienio" ? "dos 3 anos" : "da promoção"}`;
    const cat2 = categoriaSoldo(f2.categoria);
    explicacao = caso === "promocao"
      ? `O militar foi promovido em ${dataCurta(data2)}${posto}; na época, ${naEpoca}, pois já havia recebido outro em um intervalo de 1 ano. Com a edição do novo decreto, tal restrição foi expressamente suprimida, passando-se a admitir o pagamento integral do auxílio.`
      : caso === "trienio"
      ? `O militar completou 3 anos ${cat2 ? `${NA_GRADUACAO(f2.categoria!)} ${cat2.nome}` : "no mesmo posto ou graduação"} em ${dataCurta(data2)}; na época, ${naEpoca}, pois já havia recebido outro em um intervalo de 1 ano. Com a edição do novo decreto, tal restrição foi expressamente suprimida, passando-se a admitir o pagamento integral do auxílio.`
      : caso === "mesma_data"
      ? `O militar completou 3 anos ${!categoriaSoldo(f1.categoria) ? "no mesmo posto ou graduação" : OFICIAIS.has(f1.categoria!) ? "no mesmo posto" : "na mesma graduação"} em ${dataCurta(data2)} e foi promovido na mesma data${posto}; na época, só recebeu o auxílio-fardamento da promoção, pois já havia recebido outro em um intervalo de 1 ano, ocasionando dois fatos geradores. Com a edição do novo decreto, tal restrição foi expressamente suprimida, passando-se a admitir o pagamento integral do auxílio.`
      : `O militar ${f2.tipo === "promocao" || !f2.tipo ? "foi promovido" : FOI[f2.tipo]} em ${dataCurta(data2)}${f2.tipo === "promocao" || !f2.tipo ? posto : ""}; na época, só recebeu a diferença do auxílio-fardamento, pois já havia recebido outro em um intervalo de 1 ano, ocasionando dois fatos geradores. Com a edição do novo decreto, tal restrição foi expressamente suprimida, passando-se a admitir o pagamento integral do auxílio.`;
  }
  // documento que materializou o direito: o dos processos pagos e o documento de averbação
  // somente promoção: o documento do ato da promoção (nº e data) entra como 2º documento
  const atoPromocao = caso === "promocao" ? dados.ato2?.trim().slice(0, 100) : "";
  const averbacao = entrada.averbacao?.trim().slice(0, 100);
  const documentos = [DOCUMENTO_DIREITO, ...(atoPromocao ? [atoPromocao] : []), ...(averbacao && averbacao !== atoPromocao ? [averbacao] : [])];

  return {
    caso, pagamentos, multiplicador1, multiplicador2, soldo1, soldo2, devido, recebido, diferenca, competencia, rubrica, prescricao,
    devidos, recebidos, notas, alertas, pendencias, textos: { explicacao, documentos },
  };
}

interface Rubrica { posicao: number; codigo: string; tipo: string }
const ULTIMA_RECEITA = 12;

/** A56 ou A57 (Receita): a que já houver, a posição 1 vazia ou a 1ª receita vazia. */
export function rubricasAuxFard(rubricas: Rubrica[], codigo: string) {
  const lista = rubricas.map((r) => ({ ...r, codigo: r.codigo ?? "" }));
  const prefixo = codigo.slice(0, 4);
  const existente = lista.find((r) => r.codigo.trim().toUpperCase().startsWith(prefixo));
  if (existente) return { mudadas: existente.tipo === "Receita" ? [] : [{ ...existente, tipo: "Receita" }], posicao: existente.posicao };
  const vazia = lista.find((r) => r.posicao === 1 && !r.codigo.trim()) ?? lista.find((r) => r.posicao <= ULTIMA_RECEITA && !r.codigo.trim());
  return vazia ? { mudadas: [{ ...vazia, codigo, tipo: "Receita" }], posicao: vazia.posicao } : { mudadas: [], posicao: null };
}
