/**
 * Análise do Adicional de Habilitação antes das Informações (pedido do usuário, 27/11/2026): a memória de cálculo que o
 * sistema entende como o pagamento correto, explicada ao operador. Vale só para os processos novos (complementos.analiseAdicHab).
 *
 * Roteiro (validado com o processo pago do Maj Couto e aplicado aos do Cb Kyldery, da 2º Ten Mulatinho e do 2º Sgt Quinebre):
 * 1. Percentual da Lei 13.954/2019 (Anexo III) vigente em cada dia, escalonado em 1º de julho de 2020 a 2023 (planoAdicHab).
 * 2. Posto e promoções sugeridos pelo soldo das fichas (NR0001/A01), quando o quadro não os informa.
 * 3. Natalino: diferença de dezembro × os meses do 13º efetivamente pago (13º ÷ remuneração de dezembro), não os meses com soldo.
 * 4. Período: se as fichas mostram o percentual antigo depois do fim pedido (até dezembro do ano anterior), sugere estender.
 * 5. Atrasados do adicional (AR0003/ER0003/A23): o cálculo automático não os conta como recebidos; aqui cada um é ligado ao
 *    mês a que se refere — o pagamento atrasado do percentual antigo (mês com recebido zerado) ou o retroativo da majoração
 *    (valor = n × diferença mensal: os n meses anteriores ao pagamento) — e vira recebido DIGITADO, com Fusex e Pensão Militar
 *    proporcionais (os descontos "AT" já cobrados na folha).
 * 6. Documentos que faltam para fechar a análise (fichas do período e do ano seguinte, ato do direito, requerimento).
 */
import { calcular } from "@painel-ea/engine";
import {
  CODIGOS_AH, ESPECIE_ADIC_HAB, planoAdicHab, percentualAH, RUBRICA_ADIC_HAB, RUBRICA_FERIAS, RUBRICA_FUSEX, RUBRICA_FUSEX_DEP, RUBRICA_NATAL,
  RUBRICA_PMIL, RUBRICA_PMIL_15, TABELA_AH, type Alerta, type DadosAdicHab, type PlanoAdicHab,
} from "./adic-hab";
import { montarEntrada } from "./calculo";
import type { FichaLida } from "./receitas";
import { categoriasComSoldo, categoriaSoldo } from "./soldos";

const CODIGOS_SOLDO = new Set(["NR0001", "A01"]);
const CODIGOS_ATRASADO = new Set(["AR0003", "ER0003", "A23"]);
/** Descontos guardados à parte nas fichas (lib/receitas DESCONTOS_GUARDADOS). */
const CODIGOS_ESTORNO_AH = new Set(["G03", "DR0003"]);
const CODIGOS_PMIL = new Set(["Z02", "ZKC", "ND0002", "ND0039"]);
const CODIGOS_FUSEX_DEP = new Set(["ZM5", "ZM7", "ND0011"]);
/** Base do Fusex e da Pensão Militar: soldo, adicional de habilitação, adicional militar e adicional de compensação por disponibilidade. */
const BASE_DESCONTOS = new Set(["NR0001", "A01", "NR0003", "A03", "NR0014", "A14", "NR0170", "AL0"]);
/** Parcelas do 13º: a 2ª (às vezes já o 13º inteiro) e a 1ª (adiantamento). */
const NATAL_2 = new Set(["NR0085", "A85"]);
const NATAL_1 = new Set(["NR0084", "A84"]);
/** Remuneração de dezembro que serve de base ao 13º: soldo, adicionais e gratificações mensais. */
const BASE_13 = new Set(["NR0001", "A01", "NR0003", "A03", "NR0014", "A14", "NR0170", "AL0", "A07", "A08", "NR0007", "NR0008", "NR0010", "A10"]);

export type ComAnalise = { especie_divida?: string | null; complementos?: unknown };
const marcador = (p: ComAnalise) => (p.complementos as { analiseAdicHab?: { pendente?: boolean; concluida?: string } } | null | undefined)?.analiseAdicHab;
/** Processo novo de Adicional de Habilitação criado com a análise (marcador gravado na criação, a partir de 27/11/2026). */
export const temAnaliseAdicHab = (p: ComAnalise) => p.especie_divida === ESPECIE_ADIC_HAB && !!marcador(p);
/** A análise ainda não foi concluída (o operador não clicou em Prosseguir). */
export const analiseAdicHabPendente = (p: ComAnalise) => temAnaliseAdicHab(p) && !marcador(p)!.concluida;

export interface EntradaAnaliseAdicHab {
  fichas: FichaLida[];
  /** Início do direito (conclusão do curso ou termo inicial) e fim do período pedido ("AAAA-MM-DD"). */
  inicio: string | null;
  fim: string | null;
  dados: DadosAdicHab;
  dataRequerimento?: string | null;
  averbacao?: string | null;
  hoje: string;
  /** false: mantém o período pedido (não estende até o último mês com o percentual antigo). */
  estender?: boolean;
}
export interface LinhaMemoria {
  ano: number; mes: number; soldo: number | null; percentual: number; dias: number; diasMes: number;
  devido: number; recebidoFicha: number; atrasado: number; diferenca: number;
  natal: number; ferias: number; fusex: number; pensao: number; pensao15: number; dependente: number; liquido: number;
}
export interface AtrasadoAnalisado {
  ano: number; mes: number; valor: number;
  tipo: "percentual-antigo" | "majoracao" | "estorno" | "fora-do-periodo" | "indefinido";
  meses: { ano: number; mes: number; valor: number }[];
  explicacao: string;
}
export interface NatalAnalisado { ano: number; diferenca: number; avos: number; avosMesesSoldo: number; pago13: number | null; base13: number | null; valor: number; explicacao: string }
export interface AnaliseAdicHab {
  pronta: boolean;
  inicio: string | null; fimPedido: string | null; fim: string | null; fimSugerido: string | null;
  /** Último mês (até dezembro do ano anterior) em que as fichas ainda pagam o percentual antigo depois do fim pedido. */
  fimPossivel: string | null;
  tipo: string | null; tipoNome: string | null; percentualRecebido: number | null;
  faixas: { de: string; ate: string; percentual: number; diferenca: number | null }[];
  postos: { desde: string; categoria: string; nome: string }[]; postosSugeridos: boolean;
  natalino: NatalAnalisado[];
  ferias: { ano: number; mes: number; valor: number }[];
  atrasados: AtrasadoAnalisado[];
  memoria: LinhaMemoria[];
  totais: { a03: number; natal: number; ferias: number; fusex: number; pensao: number; pensao15: number; dependente: number; liquido: number };
  /** O quadro do adicional com as sugestões (postos, avos), para gravar ao prosseguir. */
  dados: DadosAdicHab;
  /**
   * Lançamentos a gravar como DIGITADOS (o automático não os sobrescreve): o recebido A03 inteiro dos meses com atrasado ou
   * estorno; os descontos já cobrados sobre o atrasado (recebido Z01/Z02/ZM7) ou os devidos de novo pelo estorno (devido).
   */
  lancamentosDigitados: { tipo: "devido" | "recebido"; ano: number; mes: number; rubrica: string; valor: number }[];
  /** De onde vieram a Pensão Militar e o Fusex de dependentes (true: lidos nos descontos da ficha). */
  descontosDaFicha: { pensao: boolean; dependentes: boolean };
  /** Lançamentos que o cálculo automático gravará (origem pdf). */
  plano: PlanoAdicHab | null;
  /** Dados que faltam para a análise, cada um com o que é preciso e onde obter (carregar o PDF ou digitar). */
  faltas: string[];
  /** Leitura a conferir: fichas lidas por OCR (totais que não fecham) ou digitadas à mão. */
  conferir: string[];
  pendencias: string[]; alertas: Alerta[];
  textos: { explicacao: string | null; documentos: string[] };
  fichasAnos: number[];
}

const k = (ano: number, mes: number) => ano * 12 + mes;
const de = (m: number) => ({ ano: Math.floor((m - 1) / 12), mes: ((m - 1) % 12) + 1 });
const centavos = (v: number) => Math.round((v + Math.sign(v) * 1e-9) * 100) / 100;
const dd = (n: number) => String(n).padStart(2, "0");
const diasNoMes = (ano: number, mes: number) => new Date(Date.UTC(ano, mes, 0)).getUTCDate();
const MESES = ["JAN", "FEV", "MAR", "ABR", "MAIO", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
const mmm = (ano: number, mes: number) => `${MESES[mes - 1]}/${ano}`;
const br = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
const curta = (d: string) => `${+d.slice(8, 10) === 1 ? "1º" : d.slice(8, 10)} ${MESES[+d.slice(5, 7) - 1]} ${d.slice(2, 4)}`;
const ultimoDia = (ano: number, mes: number) => `${ano}-${dd(mes)}-${dd(diasNoMes(ano, mes))}`;
const reais = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function porMes(fichas: FichaLida[], codigos: Set<string>, descontos = false) {
  const m = new Map<number, number>();
  for (const f of fichas) for (const l of descontos ? f.descontos ?? [] : f.linhas) {
    if (!codigos.has(l.codigo.trim().toUpperCase())) continue;
    l.meses.forEach((v, i) => { if (v) m.set(k(f.ano, i + 1), centavos((m.get(k(f.ano, i + 1)) ?? 0) + v)); });
  }
  return m;
}

/** Meses do 13º pagos no ano: o 13º (só a 2ª parcela, ou as duas) ÷ remuneração de dezembro × 12, quando dá um número inteiro de meses. */
export function avosDo13(fichas: FichaLida[], ano: number): { avos: number; pago: number; base: number } | null {
  const f = fichas.filter((x) => x.ano === ano);
  if (!f.length) return null;
  const soma = (codigos: Set<string>, mes?: number) => centavos(f.flatMap((x) => x.linhas).filter((l) => codigos.has(l.codigo.trim().toUpperCase()))
    .reduce((s, l) => s + (mes ? l.meses[mes - 1] ?? 0 : l.meses.reduce((a, b) => a + b, 0)), 0));
  const base = soma(BASE_13, 12);
  if (base <= 0) return null;
  // SIAPPES: a A85 é o 13º inteiro (o adiantamento A84 é descontado depois); SIPPES: as duas parcelas (NR0084 + NR0085)
  const siappes = f.every((x) => x.sistema === "siappes");
  for (const pago of siappes ? [soma(NATAL_2)] : [centavos(soma(NATAL_2) + soma(NATAL_1)), soma(NATAL_2)]) {
    const r = (pago / base) * 12;
    if (pago > 0 && Math.abs(r - Math.round(r)) <= 0.05 && Math.round(r) >= 1 && Math.round(r) <= 12) return { avos: Math.round(r), pago, base };
  }
  return null;
}

/** Posto no início e promoções, pelo soldo das fichas (a categoria cujo soldo da tabela bate com o pago no mês). */
export function postosPelaFicha(fichas: FichaLida[], inicio: string, fim: string) {
  const soldos = porMes(fichas, CODIGOS_SOLDO);
  const ini = k(+inicio.slice(0, 4), +inicio.slice(5, 7)), fi = k(+fim.slice(0, 4), +fim.slice(5, 7));
  const postos: { desde: string; categoria: string }[] = [];
  for (let m = ini; m <= fi; m++) {
    const v = soldos.get(m);
    if (!v) continue;
    const { ano, mes } = de(m);
    const dia = m === ini ? inicio : `${ano}-${dd(mes)}-01`;
    const c = categoriasComSoldo(v, dia).at(-1);
    if (!c) continue;
    if (postos.at(-1)?.categoria !== c.id) postos.push({ desde: postos.length ? dia : inicio, categoria: c.id });
  }
  return postos;
}

const ONDE_LIDO = "no requerimento nem no BI lidos";
const INFORME = "Informe em “Dados do direito”, abaixo";
const COMO_FICHA = "Carregue o PDF da ficha (o escaneado é lido por OCR) ou digite os valores em “Digitar valores da ficha”, abaixo";

/** Trecho de meses do período num ano ("MAR a DEZ/2022", "JUL/2023"). */
function trecho(ano: number, m0: number, m1: number) {
  return m0 === m1 ? mmm(ano, m0) : `${MESES[m0 - 1]} a ${MESES[m1 - 1]}/${ano}`;
}

/** Fichas que faltam, ano a ano, e meses do período sem o soldo lido (ficha incompleta ou OCR que não reconheceu a linha). */
export function faltasDasFichas(fichas: FichaLida[], inicio: string, fim: string): string[] {
  const soldo = porMes(fichas, CODIGOS_SOLDO);
  const out: string[] = [];
  const a0 = +inicio.slice(0, 4), a1 = +fim.slice(0, 4);
  const semFicha: { ano: number; m0: number; m1: number }[] = [];
  for (let ano = a0; ano <= a1; ano++) {
    const m0 = ano === a0 ? +inicio.slice(5, 7) : 1, m1 = ano === a1 ? +fim.slice(5, 7) : 12;
    const f = fichas.find((x) => x.ano === ano);
    if (!f) { semFicha.push({ ano, m0, m1 }); continue; }
    const sem: number[] = [];
    for (let m = m0; m <= m1; m++) if (!soldo.get(k(ano, m))) sem.push(m);
    if (sem.length) out.push(`Soldo (NR0001/A01) de ${sem.length === m1 - m0 + 1 ? trecho(ano, m0, m1) : `${sem.map((m) => MESES[m - 1]).join(", ")}/${ano}`}: a ficha de ${ano}${f.origem === "ocr" ? " (lida por OCR)" : f.origem === "manual" ? " (digitada)" : ""} não traz esse valor${f.origem === "ocr" ? ", talvez o OCR não tenha reconhecido a linha" : ""}. Digite o soldo e o adicional pago desses meses em “Digitar valores da ficha”, abaixo.`);
  }
  if (semFicha.length) out.unshift(...semFicha.map(({ ano, m0, m1 }) => `Ficha financeira de ${ano} (meses do período: ${trecho(ano, m0, m1)}): soldo (NR0001/A01) e adicional de habilitação pago (NR0003/A03) de cada mês. ${COMO_FICHA}.`));
  return out;
}

/** Fichas lidas por OCR (com os totais que não fecham) e fichas digitadas: o que o operador deve conferir. */
export function conferenciaDasFichas(fichas: FichaLida[]): string[] {
  const out: string[] = [];
  for (const f of fichas) {
    const de = `Ficha de ${f.ano} lida por OCR${f.arquivo ? ` (${f.arquivo})` : ""}`;
    if (f.origem === "ocr" && f.editada) out.push(`${de} e corrigida à mão: confira os valores da memória com a ficha.`);
    else if (f.origem === "ocr") {
      const c = f.conferencia ?? { linhas: [], meses: [] };
      const presentes = new Set(f.linhas.map((l) => l.codigo));
      const incompletas = (c.incompletas ?? []).filter((x) => !presentes.has(x));
      const erros = [
        incompletas.length ? (incompletas.length > 1 ? `as linhas ${incompletas.join(", ")} não foram reconhecidas inteiras e ficaram de fora` : `a linha ${incompletas[0]} não foi reconhecida inteira e ficou de fora`) : "",
        c.linhas.length ? `a soma dos meses não bate com o total impresso ${c.linhas.length > 1 ? `nas linhas ${c.linhas.join(", ")}` : `na linha ${c.linhas[0]}`}` : "",
        c.meses.length ? `receitas menos descontos não fecham com o líquido em ${c.meses.map((m) => MESES[m - 1]).join(", ")}` : "",
        c.semTotais ? "a linha dos totais líquidos não foi lida, então os meses não puderam ser conferidos: compare todas as linhas com a ficha" : "",
      ].filter(Boolean);
      out.push(erros.length
        ? `${de}: ${erros.join("; ")}. Algum número foi mal reconhecido: compare com a ficha e corrija em “Digitar valores da ficha” (os meses a conferir ficam destacados).`
        : `${de}: os totais impressos conferem com os meses; mesmo assim, compare o soldo e o adicional da memória com a ficha.`);
    } else if (f.origem === "manual") out.push(`Ficha de ${f.ano} digitada à mão: anexe a ficha ao processo (mesmo escaneada) para a conferência do CPEx.`);
    else if (f.editada) out.push(`Ficha de ${f.ano}: valores alterados à mão sobre a ficha lida.`);
  }
  return out;
}

/** Linhas essenciais (soldo e adicional) que o OCR não reconheceu inteiras: sem elas, a análise tomaria o recebido por zero. */
export function faltasDaLeituraOcr(fichas: FichaLida[]): string[] {
  const nomes: Record<string, string> = { NR0001: "soldo", A01: "soldo", NR0003: "adicional de habilitação pago", A03: "adicional de habilitação pago",
    AR0003: "adicional atrasado", A23: "adicional atrasado" };
  return fichas.filter((f) => f.origem === "ocr").flatMap((f) => {
    const presentes = new Set(f.linhas.map((l) => l.codigo));
    const essenciais = (f.conferencia?.incompletas ?? []).filter((x) => nomes[x] && !presentes.has(x));
    const out = essenciais.length ? [`Ficha de ${f.ano} (lida por OCR): ${essenciais.map((x) => `a linha ${x} (${nomes[x]})`).join(" e ")} não foi reconhecida inteira. Digite os 12 meses em “Digitar valores da ficha”, abaixo; sem isso, a análise toma o valor como não pago.`] : [];
    // a linha inteira (com o código) pode ter se perdido: com soldo e sem nenhum adicional, pergunta
    const temSoldo = f.linhas.some((l) => CODIGOS_SOLDO.has(l.codigo) && l.meses.some((v) => v));
    if (temSoldo && !f.editada && !f.linhas.some((l) => CODIGOS_AH.has(l.codigo)) && !essenciais.some((x) => /0003$|^A03$/.test(x)))
      out.push(`Ficha de ${f.ano} (lida por OCR): a linha do adicional de habilitação pago (NR0003/A03) não foi encontrada. Se o militar recebia o adicional nesse ano, digite os valores em “Digitar valores da ficha”, abaixo; sem isso, a análise toma o adicional como não pago.`);
    return out;
  });
}

export function analisarAdicHab(e: EntradaAnaliseAdicHab): AnaliseAdicHab {
  const { fichas, hoje } = e;
  const faltas: string[] = [], pendencias: string[] = [], alertas: Alerta[] = [], conferir: string[] = [];
  const fichasAnos = [...new Set(fichas.map((f) => f.ano))].sort();
  const vazio: AnaliseAdicHab = { conferir,
    pronta: false, inicio: e.inicio, fimPedido: e.fim, fim: e.fim, fimSugerido: null, fimPossivel: null, tipo: null, tipoNome: null, percentualRecebido: null,
    faixas: [], postos: [], postosSugeridos: false, natalino: [], ferias: [], atrasados: [], memoria: [],
    totais: { a03: 0, natal: 0, ferias: 0, fusex: 0, pensao: 0, pensao15: 0, dependente: 0, liquido: 0 },
    dados: e.dados, lancamentosDigitados: [], descontosDaFicha: { pensao: false, dependentes: false }, plano: null, faltas, pendencias, alertas, textos: { explicacao: null, documentos: [] }, fichasAnos,
  };
  const tipo = e.dados.tipo && TABELA_AH[e.dados.tipo] ? e.dados.tipo : null;
  if (!e.inicio) faltas.push(`Início do direito (data de conclusão do curso ou termo inicial do reconhecimento): não encontrado ${ONDE_LIDO}. ${INFORME}.`);
  if (!tipo) faltas.push(`Tipo do curso (formação, especialização, aperfeiçoamento ou altos estudos): ${e.dados.percentualPedido ? `o percentual pedido (${String(e.dados.percentualPedido).replace(".", ",")}%) não indica o tipo` : `não identificado ${ONDE_LIDO}`}. ${INFORME}.`);
  conferir.push(...conferenciaDasFichas(fichas));
  faltas.push(...faltasDaLeituraOcr(fichas));
  if (!e.inicio || !tipo || !fichas.length) {
    if (!fichas.length) faltas.push(...(e.inicio ? faltasDasFichas(fichas, e.inicio, e.fim && e.fim >= e.inicio ? e.fim : ultimoDia(+e.inicio.slice(0, 4), 12))
      : [`Fichas financeiras do período (SIPPES ou SIAPPES): soldo (NR0001/A01) e adicional de habilitação pago (NR0003/A03) de cada mês. ${COMO_FICHA}.`]));
    return vazio;
  }
  const inicio = e.inicio;
  const anoFechado = +hoje.slice(0, 4) - 1;
  let fimPedido = e.fim && e.fim >= inicio ? e.fim : ultimoDia(+inicio.slice(0, 4), 12);
  if (+fimPedido.slice(0, 4) > anoFechado) fimPedido = ultimoDia(anoFechado, 12) < inicio ? fimPedido : ultimoDia(anoFechado, 12);

  // posto e promoções pelo soldo da ficha (quando o quadro não traz)
  const ahFicha = porMes(fichas, CODIGOS_AH), soldoFicha = porMes(fichas, CODIGOS_SOLDO);
  // fim sugerido: meses seguidos depois do fim pedido em que a ficha ainda paga menos que a lei (até dezembro do ano anterior)
  let fimSugerido: string | null = null;
  let fimPossivel: string | null = null;
  for (let m = k(+fimPedido.slice(0, 4), +fimPedido.slice(5, 7)) + 1; m <= k(anoFechado, 12); m++) {
    const { ano, mes } = de(m), s = soldoFicha.get(m), pago = ahFicha.get(m) ?? 0;
    if (!s || !fichas.some((f) => f.ano === ano)) break;
    if (pago >= centavos((s * percentualAH(tipo, ultimoDia(ano, mes))) / 100) - 0.01) break;
    fimPossivel = ultimoDia(ano, mes);
  }
  if (e.estender !== false) fimSugerido = fimPossivel;
  const fim = fimSugerido ?? fimPedido;
  const postosInformados = (e.dados.postos ?? []).filter((p) => categoriaSoldo(p.categoria) && /^\d{4}-\d{2}-\d{2}$/.test(p.desde));
  const postosFicha = postosInformados.length ? [] : postosPelaFicha(fichas, inicio, fim);
  const postos = postosInformados.length ? postosInformados : postosFicha;

  // meses do 13º pelo que foi pago (quando diferem dos meses com soldo)
  const avosNatal: Record<string, number> = { ...(e.dados.avosNatal ?? {}) };
  const do13: Record<number, ReturnType<typeof avosDo13>> = {};
  for (let ano = +inicio.slice(0, 4); ano <= +fim.slice(0, 4); ano++) {
    do13[ano] = avosDo13(fichas, ano);
    if (avosNatal[String(ano)] === undefined && do13[ano]) avosNatal[String(ano)] = do13[ano]!.avos;
  }
  // Pensão Militar e Fusex de dependentes pelos descontos da ficha (quando guardados), no 1º mês do período que os tenha
  const ini0 = k(+inicio.slice(0, 4), +inicio.slice(5, 7)), fi0 = k(+fim.slice(0, 4), +fim.slice(5, 7));
  const base = porMes(fichas, BASE_DESCONTOS), pmil = porMes(fichas, CODIGOS_PMIL, true), dep = porMes(fichas, CODIGOS_FUSEX_DEP, true);
  // o percentual mais frequente nos meses (um mês incompleto ou com acerto não decide)
  const pctNoPeriodo = (mapa: Map<number, number>) => {
    const conta = new Map<number, number>();
    for (let m = ini0; m <= fi0 + 12; m++) if (mapa.get(m) && base.get(m)) {
      const p = Math.round((mapa.get(m)! / base.get(m)!) * 1000) / 10;
      conta.set(p, (conta.get(p) ?? 0) + 1);
    }
    return [...conta].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  };
  let pensao = e.dados.pensao, pensao15 = e.dados.pensao15, fusexDependentes = e.dados.fusexDependentes;
  let pensaoDaFicha = false, dependentesDaFicha = false;
  const pPm = pctNoPeriodo(pmil);
  if (pensao === undefined && pPm !== null) {
    const op = [7.5, 9.5, 10.5].flatMap((p) => [{ p, mais: false, t: p }, { p, mais: true, t: p + 1.5 }]).find((o) => Math.abs(o.t - pPm) <= 0.1);
    if (op) { pensao = op.p; pensao15 = op.mais; pensaoDaFicha = true; }
  }
  const pDep = pctNoPeriodo(dep);
  if (!fusexDependentes && pDep !== null) {
    const op = ([0.4, 0.5] as const).find((p) => Math.abs(p - pDep) <= 0.06);
    if (op) { fusexDependentes = op; dependentesDaFicha = true; }
  }
  const dados: DadosAdicHab = { ...e.dados, postos, avosNatal, ...(pensao !== undefined ? { pensao, pensao15 } : {}), ...(fusexDependentes ? { fusexDependentes } : {}) };
  const plano = planoAdicHab({ fichas, inicio, fim, dados, dataRequerimento: e.dataRequerimento, averbacao: e.averbacao, hoje });
  const porChave = new Map(plano.meses.map((m) => [k(m.ano, m.mes), m]));
  const ini = k(+inicio.slice(0, 4), +inicio.slice(5, 7)), fi = k(+fim.slice(0, 4), +fim.slice(5, 7));
  const pensaoPct = [7.5, 9.5, 10.5].includes(dados.pensao ?? NaN) ? dados.pensao! : 10.5;
  const depPct = dados.fusexDependentes === 0.4 || dados.fusexDependentes === 0.5 ? dados.fusexDependentes : 0;

  // atrasados do adicional: ligados ao mês a que se referem
  const alocado = new Map<number, number>();
  const atrasados: AtrasadoAnalisado[] = [];
  for (const [p, valor] of [...porMes(fichas, CODIGOS_ATRASADO)].filter(([p]) => p > ini && p <= fi + 12).sort((a, b) => a[0] - b[0])) {
    const { ano, mes } = de(p);
    const antes = [...porChave.values()].filter((m) => k(m.ano, m.mes) < p).sort((a, b) => k(b.ano, b.mes) - k(a.ano, a.mes));
    // diferença mensal de referência: a do mês anterior ao pagamento (no período, a do cálculo; fora dele, pela ficha e pela lei)
    const anterior = porChave.get(p - 1);
    const fichaAnterior = soldoFicha.get(p - 1) ? centavos((soldoFicha.get(p - 1)! * percentualAH(tipo, ultimoDia(de(p - 1).ano, de(p - 1).mes))) / 100 - (ahFicha.get(p - 1) ?? 0)) : 0;
    const cheio = anterior && anterior.dias === anterior.diasMes && (anterior.diferenca ?? 0) > 0 ? anterior
      : fichaAnterior > 0 ? { diferenca: fichaAnterior } : antes.find((m) => m.dias === m.diasMes && (m.diferenca ?? 0) > 0);
    const n = cheio ? valor / cheio.diferenca! : 0;
    // retroativo da majoração: n × a diferença mensal, pagando os n meses imediatamente anteriores ao pagamento
    if (cheio && Math.round(n) >= 1 && Math.abs(n - Math.round(n)) <= 0.02) {
      const alvo: { ano: number; mes: number; valor: number }[] = [];
      for (let m = p - 1, i = 0; i < Math.round(n) && m >= ini; m--, i++) {
        const x = porChave.get(m);
        if (x && (x.diferenca ?? 0) > 0) alvo.push({ ano: x.ano, mes: x.mes, valor: centavos(x.diferenca! - (alocado.get(m) ?? 0)) });
      }
      for (const a of alvo) alocado.set(k(a.ano, a.mes), centavos((alocado.get(k(a.ano, a.mes)) ?? 0) + a.valor));
      const fora = Math.round(n) - alvo.length;
      atrasados.push({ ano, mes, valor, tipo: alvo.length ? "majoracao" : "fora-do-periodo", meses: alvo.reverse(),
        explicacao: `R$ ${reais(valor)} = ${Math.round(n)} × R$ ${reais(cheio.diferenca!)} (a diferença mensal): retroativo da majoração de ${Math.round(n)} ${Math.round(n) > 1 ? "meses" : "mês"}, ligado ${alvo.length ? `aos meses imediatamente anteriores ao pagamento (${alvo.map((a) => mmm(a.ano, a.mes)).join(", ")})` : "a meses fora do período"}${fora > 0 && alvo.length ? `; ${fora} fora do período` : ""}. Confira no demonstrativo do pagamento se os meses são esses.` });
      continue;
    }
    // pagamento atrasado do percentual antigo: o mês anterior com o adicional zerado na ficha
    const vizinho = [p - 1, p, p + 1].map((m) => ahFicha.get(m) ?? 0).find((v) => v > 0) ?? 0;
    const zerado = antes.find((m) => m.recebido === 0 && (alocado.get(k(m.ano, m.mes)) ?? 0) === 0);
    if (vizinho > 0 && valor <= vizinho * 1.02 && zerado) {
      const diasPagos = Math.min(zerado.diasMes, Math.round((valor / vizinho) * zerado.diasMes));
      const v = centavos(Math.min(valor, (vizinho * Math.min(diasPagos, zerado.dias)) / zerado.diasMes));
      alocado.set(k(zerado.ano, zerado.mes), v);
      atrasados.push({ ano, mes, valor, tipo: "percentual-antigo", meses: [{ ano: zerado.ano, mes: zerado.mes, valor: v }],
        explicacao: `R$ ${reais(valor)} = ${diasPagos}/${zerado.diasMes} dias do adicional antigo (R$ ${reais(vizinho)}): é o pagamento atrasado de ${mmm(zerado.ano, zerado.mes)}, que na ficha está zerado.${v < valor ? ` Entra como recebido só a parte do período (${zerado.dias} dias: R$ ${reais(v)}).` : ""}` });
      continue;
    }
    if (p > fi && !antes.length) continue;
    atrasados.push({ ano, mes, valor, tipo: "indefinido", meses: [],
      explicacao: `R$ ${reais(valor)} não corresponde a meses inteiros da diferença nem ao adicional antigo de um mês: confira no demonstrativo a que meses se refere e lance o recebido em "Lançar valor recebido".` });
    faltas.push(`Demonstrativo do adicional atrasado de R$ ${reais(valor)} pago em ${mmm(ano, mes)}: a que meses ele se refere (o valor não bate com meses inteiros da diferença). Carregue o demonstrativo, ou lance esse recebido em “Lançar valor recebido” depois de prosseguir.`);
  }

  // adicional pago e descontado depois (G03/DR0003): o mês volta a ficar sem pagamento
  for (const [p, valor] of [...porMes(fichas, CODIGOS_ESTORNO_AH, true)].filter(([p]) => p > ini && p <= fi + 12).sort((a, b) => a[0] - b[0])) {
    const { ano, mes } = de(p);
    const alvo = [p - 1, p - 2, p - 3].find((m) => m >= ini && porChave.has(m) && Math.abs((ahFicha.get(m) ?? 0) - valor) <= Math.max(0.05, valor * 0.01));
    if (alvo) {
      alocado.set(alvo, centavos((alocado.get(alvo) ?? 0) - valor));
      atrasados.push({ ano, mes, valor, tipo: "estorno", meses: [{ ...de(alvo), valor: -valor }],
        explicacao: `Desconto do adicional de R$ ${reais(valor)} em ${mmm(ano, mes)}: estorna o adicional pago em ${mmm(de(alvo).ano, de(alvo).mes)}, que passa a contar como não pago (com o Fusex e a Pensão Militar devidos de novo).` });
    } else {
      atrasados.push({ ano, mes, valor, tipo: "indefinido", meses: [], explicacao: `Desconto do adicional de R$ ${reais(valor)} em ${mmm(ano, mes)} que não corresponde a um adicional pago nos meses anteriores: confira a que mês se refere.` });
      faltas.push(`Demonstrativo do desconto do adicional de R$ ${reais(valor)} feito em ${mmm(ano, mes)}: a que mês ele se refere (não corresponde ao adicional pago nos 3 meses anteriores). Carregue o demonstrativo, ou ajuste o recebido em “Lançar valor recebido” depois de prosseguir.`);
    }
  }

  // memória mês a mês
  const natalPorAno = new Map(plano.natalino.map((x) => [x.ano, x.valor]));
  const feriasPorMes = new Map(plano.ferias.map((x) => [k(x.ano, x.mes), x.valor]));
  const memoria: LinhaMemoria[] = plano.meses.map((m) => {
    const atrasado = alocado.get(k(m.ano, m.mes)) ?? 0;
    const diferenca = centavos(Math.max(0, (m.diferenca ?? 0) - atrasado));
    const z = (pct: number) => (dados.descontos === false ? 0 : centavos((diferenca * pct) / 100));
    const natal = m.mes === 12 ? natalPorAno.get(m.ano) ?? 0 : 0, ferias = feriasPorMes.get(k(m.ano, m.mes)) ?? 0;
    const fusex = z(3), pensao = z(pensaoPct), pensao15 = dados.pensao15 ? z(1.5) : 0, dependente = depPct ? z(depPct) : 0;
    return { ano: m.ano, mes: m.mes, soldo: m.soldo, percentual: m.percentual, dias: m.dias, diasMes: m.diasMes, devido: m.devido ?? 0, recebidoFicha: m.recebido, atrasado, diferenca,
      natal, ferias, fusex, pensao, pensao15, dependente, liquido: centavos(diferenca + natal + ferias - fusex - pensao - pensao15 - dependente) };
  });
  const soma = (c: keyof LinhaMemoria) => centavos(memoria.reduce((s, l) => s + (l[c] as number), 0));
  const totais = { a03: soma("diferenca"), natal: soma("natal"), ferias: soma("ferias"), fusex: soma("fusex"), pensao: soma("pensao"), pensao15: soma("pensao15"), dependente: soma("dependente"), liquido: soma("liquido") };

  // lançamentos digitados: o A03 inteiro do mês (ficha + atrasado − estorno) e os descontos do atrasado (recebidos) ou do estorno (devidos)
  const lancamentosDigitados: AnaliseAdicHab["lancamentosDigitados"] = [];
  const devidoAuto = (rubrica: string, m: number) => plano.devidos[rubrica]?.find((x) => k(x.ano, x.mes) === m)?.valor ?? 0;
  for (const [m, v] of [...alocado].sort((a, b) => a[0] - b[0])) {
    if (!v) continue;
    const { ano, mes } = de(m);
    lancamentosDigitados.push({ tipo: "recebido", ano, mes, rubrica: RUBRICA_ADIC_HAB, valor: centavos(Math.max(0, (ahFicha.get(m) ?? 0) + v)) });
    if (dados.descontos === false) continue;
    const pcts: [string, number][] = [[RUBRICA_FUSEX, 3], [RUBRICA_PMIL, pensaoPct], ...(dados.pensao15 ? [[RUBRICA_PMIL_15, 1.5] as [string, number]] : []), ...(depPct ? [[RUBRICA_FUSEX_DEP, depPct] as [string, number]] : [])];
    for (const [rubrica, pct] of pcts) {
      if (v > 0) lancamentosDigitados.push({ tipo: "recebido", ano, mes, rubrica, valor: centavos((v * pct) / 100) });
      else lancamentosDigitados.push({ tipo: "devido", ano, mes, rubrica, valor: centavos(devidoAuto(rubrica, m) + (-v * pct) / 100) });
    }
  }

  // faixas do percentual da lei no período
  const faixas: AnaliseAdicHab["faixas"] = [];
  for (const l of memoria) {
    const ultima = faixas.at(-1);
    const dia = l.ano === +inicio.slice(0, 4) && l.mes === +inicio.slice(5, 7) ? inicio : `${l.ano}-${dd(l.mes)}-01`;
    if (ultima && ultima.percentual === l.percentual) ultima.ate = l.ano === +fim.slice(0, 4) && l.mes === +fim.slice(5, 7) ? fim : ultimoDia(l.ano, l.mes);
    else faixas.push({ de: dia, ate: l.ano === +fim.slice(0, 4) && l.mes === +fim.slice(5, 7) ? fim : ultimoDia(l.ano, l.mes), percentual: l.percentual, diferenca: null });
  }
  // percentual recebido: o adicional pago ÷ soldo, num mês cheio com ficha
  const mesRef = plano.meses.find((m) => m.recebido > 0 && soldoFicha.get(k(m.ano, m.mes)));
  const percentualRecebido = mesRef ? Math.round((mesRef.recebido / soldoFicha.get(k(mesRef.ano, mesRef.mes))!) * 1000) / 10 : null;
  for (const f of faixas) f.diferenca = percentualRecebido === null ? null : Math.round((f.percentual - percentualRecebido) * 10) / 10;

  // natalino explicado
  const natalino: NatalAnalisado[] = plano.natalino.map((n) => {
    const d13 = do13[n.ano] ?? null;
    return { ano: n.ano, diferenca: n.diferenca, avos: n.avos, avosMesesSoldo: n.avosSugeridos, pago13: d13?.pago ?? null, base13: d13?.base ?? null, valor: n.valor,
      explicacao: d13 ? `O 13º de ${n.ano} foi pago com ${d13.avos}/12 (R$ ${reais(d13.pago)} sobre a remuneração de dezembro de R$ ${reais(d13.base)}), sem o novo percentual: diferença de dezembro R$ ${reais(n.diferenca)} × ${n.avos}/12.`
        : `Diferença de dezembro R$ ${reais(n.diferenca)} × ${n.avos}/12 (meses com soldo na ficha; o 13º pago não foi identificado na ficha: confira).` };
  });
  for (let ano = +inicio.slice(0, 4); ano <= +fim.slice(0, 4); ano++) {
    if (k(ano, 12) >= ini && k(ano, 12) <= fi && !plano.natalino.some((n) => n.ano === ano) && do13[ano])
      natalino.push({ ano, diferenca: 0, avos: do13[ano]!.avos, avosMesesSoldo: 0, pago13: do13[ano]!.pago, base13: do13[ano]!.base, valor: 0, explicacao: `O 13º de ${ano} (R$ ${reais(do13[ano]!.pago)}) já foi pago com o percentual devido em dezembro: não há diferença de natalino.` });
  }
  natalino.sort((a, b) => a.ano - b.ano);

  // documentos que faltam
  faltas.push(...faltasDasFichas(fichas, inicio, fim));
  const seguinte = +fim.slice(0, 4) + 1;
  if (seguinte <= +hoje.slice(0, 4) && !fichasAnos.includes(seguinte)) faltas.push(`Ficha financeira de ${seguinte} (o ano seguinte ao período): para conferir se houve retroativo (AR0003/A23) ou desconto (DR0003/G03) do adicional depois do período e se o novo percentual já foi implantado. ${COMO_FICHA}.`);
  if (!e.fim) faltas.push(`Fim do período pedido: não encontrado ${ONDE_LIDO}; a análise usou ${br(fimPedido)}. ${INFORME}.`);
  if (!dados.documento?.trim()) faltas.push(`Ato que reconheceu o direito (nº e data do BI, Adt ou despacho): não encontrado ${ONDE_LIDO}. ${INFORME}.`);
  if (!e.dataRequerimento) faltas.push(`Data do requerimento: não encontrada nas peças lidas. ${INFORME}.`);
  if (fimSugerido) pendencias.push(`O pedido vai até ${br(fimPedido)}, mas as fichas mostram o percentual antigo até ${br(fimSugerido)}: o período foi estendido até lá. A OM deve aditar o requerimento para incluir esse trecho (ou desmarque a extensão).`);
  else if (fimPossivel) pendencias.push(`As fichas mostram o percentual antigo até ${br(fimPossivel)}, depois do fim pedido (${br(fimPedido)}). O cálculo segue o pedido; se a OM aditar o requerimento, marque a extensão do período.`);
  if (!postosInformados.length && postos.length) pendencias.push(`Posto e promoções sugeridos pelo soldo das fichas: ${postos.map((p) => `${categoriaSoldo(p.categoria)!.nome} desde ${br(p.desde)}`).join("; ")}. Confira com as promoções do militar.`);
  const temDescontos = fichas.some((f) => f.descontos?.length);
  if (dados.pensao === undefined && dados.descontos !== false) pendencias.push(`Pensão Militar: 10,5% (o padrão). ${temDescontos ? "A alíquota não foi identificada nos descontos da ficha" : "As fichas não trazem os descontos"}: se o militar contribui com 7,5% ou 9,5% (ou mais 1,5%), ajuste no quadro do adicional.`);
  if (!depPct && !temDescontos && dados.descontos !== false) pendencias.push("Fusex de dependentes (0,4% ou 0,5%): não incluído. Se a ficha mostrar o desconto de dependente (ZM5/ZM7/ND0011), marque no quadro do adicional.");
  const nao = plano.alertas.filter((a) => a.codigo !== "POSSIVEL_DUPLICIDADE" && a.codigo !== "SOLDO_FICHA");
  alertas.push(...nao);
  pendencias.push(...plano.pendencias.filter((p) => !/^Confirme o posto|^Confira a Pensão Militar/.test(p)));

  // explicação sugerida (até 800 caracteres)
  const faixasTxt = faixas.map((f) => `${f.percentual}% de ${curta(f.de)} a ${curta(f.ate)}`).join(", ");
  const retro = atrasados.filter((a) => a.tipo === "majoracao" || a.tipo === "percentual-antigo");
  let explicacao = `O(a) militar concluiu com aproveitamento ${dados.curso?.trim() ? `o ${dados.curso.trim()}` : "o curso"}, equivalente a curso de ${TABELA_AH[tipo].nome.toLowerCase()} para fins do adicional de habilitação${dados.documento?.trim() ? ` (${dados.documento.trim()})` : ""}, com direito a contar de ${curta(inicio)}.`
    + (percentualRecebido !== null ? ` À época recebeu o adicional de ${String(percentualRecebido).replace(".", ",")}%, e a diferença não foi paga no exercício.` : "")
    + ` Pela Lei nº 13.954/2019 (Anexo III), o percentual devido foi de ${faixasTxt}.`
    + (retro.length ? ` Parte foi paga depois em folha (${retro.map((a) => mmm(a.ano, a.mes)).join(", ")}) e foi abatida.` : "")
    + ` Resta a diferença de ${curta(inicio)} a ${curta(fim)}${totais.natal ? ", com reflexo no adicional natalino" : ""}${totais.ferias ? `${totais.natal ? " e" : ", com reflexo"} no adicional de férias` : ""}, deduzidos os descontos de Fusex e Pensão Militar.`;
  if (explicacao.length > 800) explicacao = `${explicacao.slice(0, 797)}...`;

  return {
    conferir, pronta: true, inicio, fimPedido, fim, fimSugerido, fimPossivel, tipo, tipoNome: TABELA_AH[tipo].nome, percentualRecebido, faixas,
    postos: postos.map((p) => ({ ...p, nome: categoriaSoldo(p.categoria)!.nome })), postosSugeridos: !postosInformados.length && postos.length > 0,
    natalino, ferias: plano.ferias, atrasados, memoria, totais, dados, lancamentosDigitados, descontosDaFicha: { pensao: pensaoDaFicha, dependentes: dependentesDaFicha }, plano, faltas, pendencias, alertas,
    textos: { explicacao, documentos: plano.textos.documentos }, fichasAnos,
  };
}

/** Posições das rubricas usadas pela análise (as do cálculo automático: A03 1, A85 2, AD2 3; Z01 13, Z02 14...). */
const POSICOES_PADRAO: Record<string, number> = { [RUBRICA_ADIC_HAB]: 1, [RUBRICA_NATAL]: 2, [RUBRICA_FERIAS]: 3, [RUBRICA_FUSEX]: 13, [RUBRICA_PMIL]: 14, [RUBRICA_PMIL_15]: 15, [RUBRICA_FUSEX_DEP]: 17 };

/** Os lançamentos que ficarão no processo: os automáticos e, por cima, os recebidos digitados. */
export function lancamentosDaAnalise(a: AnaliseAdicHab, posicoes: Record<string, number> = POSICOES_PADRAO) {
  if (!a.plano) return [];
  const out = new Map<string, { tipo: "devido" | "recebido"; ano: number; mes: number; posicao: number; valor: number }>();
  const por = (tipo: "devido" | "recebido", lista: Record<string, { ano: number; mes: number; valor: number }[]>) => {
    for (const [r, l] of Object.entries(lista)) if (posicoes[r] !== undefined) for (const v of l) out.set(`${tipo}-${v.ano}-${v.mes}-${posicoes[r]}`, { tipo, ano: v.ano, mes: v.mes, posicao: posicoes[r]!, valor: v.valor });
  };
  por("devido", a.plano.devidos);
  por("recebido", a.plano.recebidos);
  for (const d of a.lancamentosDigitados) if (posicoes[d.rubrica] !== undefined) out.set(`${d.tipo}-${d.ano}-${d.mes}-${posicoes[d.rubrica]}`, { tipo: d.tipo, ano: d.ano, mes: d.mes, posicao: posicoes[d.rubrica]!, valor: d.valor });
  return [...out.values()];
}

/** Valor sem e com correção (série do sistema), pelo mesmo motor da emissão. */
export function valorDaAnalise(a: AnaliseAdicHab, indices: { ano: number; mes: number; percentual: number | string }[]) {
  if (!a.pronta || !a.inicio || !a.fim) return null;
  const rubricas = Object.entries(POSICOES_PADRAO).map(([codigo, posicao]) => ({ posicao, codigo, tipo: (posicao >= 13 ? "Despesa" : "Receita") as "Despesa" | "Receita" }));
  const r = calcular(montarEntrada(rubricas, lancamentosDaAnalise(a), indices, { inicio: a.inicio, fim: a.fim })).cpex;
  const ate = [...indices].filter((i) => i.percentual !== null && i.percentual !== "").sort((x, y) => y.ano * 100 + y.mes - (x.ano * 100 + x.mes))[0];
  return { semCorrecao: r.totalSemCorrecao, corrigido: r.importanciaBasicaTotalCorrigida, porRubrica: r.comCorrecao, ate: ate ? `${MESES[ate.mes - 1]}/${ate.ano}` : null };
}
