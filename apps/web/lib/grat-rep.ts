/**
 * Cálculo automático da "Gratificação de Representação" (decisão de 23/11/2026), no molde do complemento de salário
 * mínimo (lib/compl-sal-min). Vale só para os processos criados a partir dessa data (complementos.calculoAutomaticoGratRep).
 *
 * - Soldo base: tabela de soldos (lib/soldos) do posto/graduação NA DATA DO FATO, na vigência do dia de início.
 *   A NR0001 (SOLDO) da ficha no mês do fato só confere (e sugere a graduação); nunca é usada no lugar da tabela.
 * - Valor diário = soldo × 2%, arredondado a centavos. Dias = corridos do início ao fim do período, inclusive os dois
 *   (Decreto 11.002/2022, art. 4º, § 1º: "período igual ou superior a oito horas" é um dia; o dia de saída conta se a saída foi
 *   até 16h00; o de retorno, se o retorno foi às 08h00 ou depois. A Port 927-Cmt Ex/2016 foi revogada pela Port C Ex 1.887/2022).
 * - Só a gratificação EVENTUAL (2% do soldo por dia, Anexo IV da Lei 13.954/2019). A de comando, direção ou chefia (10% do
 *   soldo por mês, art. 4º, § 2º, do Decreto) é outra hipótese e não é calculada aqui.
 * - Devido = dias × valor diário, todo no mês de início (competência), na rubrica "A62 - GRAT REP 2%" (Receita).
 * - Recebidos: os lançamentos de Grat Rep das fichas (AR0061, ER0061, NR0061; A62 e B26 no SIAPPES) NUNCA são abatidos
 *   sozinhos: o operador marca os que são do mesmo evento. Marcado no período, entra como recebido do mês; depois do
 *   fim do período, como "recebido após o período".
 * - Alertas (não bloqueiam a emissão): divergência com a autorização, soldo da ficha, possível duplicidade, não é DEA,
 *   prescrição e pendências de conferência.
 */
import type { FichaLida } from "./receitas";
import { categoriasComSoldo, categoriaSoldo, soldoNaData } from "./soldos";

export const ESPECIE_GRAT_REP = "Gratificação de Representação";
export const RUBRICA_GRAT_REP = "A62 - GRAT REP 2%";
/** Linhas de Grat Rep nas fichas: SIPPES (AR/ER/NR0061) e SIAPPES (A62 e B26, a de atrasados). */
export const CODIGOS_GRAT_REP = new Set(["AR0061", "ER0061", "NR0061", "A62", "B26"]);
const CODIGOS_SOLDO = new Set(["NR0001", "A01"]);
export const PERCENTUAL_DIARIO = 0.02;

/** O que o operador informa no quadro da Grat Rep (complementos.gratRep). */
export interface DadosGratRep {
  /** Posto/graduação na data do fato (id de lib/soldos). Vazio: o sugerido pela NR0001 da ficha. */
  categoria?: string;
  /** "HH:MM" da saída (BI de ida) e do retorno (BI de retorno). */
  horaSaida?: string;
  horaRetorno?: string;
  autorizacao?: {
    /** Adt/BI do Cmdo Mil A, nº e data. */
    documento?: string;
    /** Transcrição no BI da OM. */
    transcricao?: string;
    /** Data de publicação da autorização ("AAAA-MM-DD"). */
    publicacao?: string;
    dias?: number | null;
    valor?: number | null;
  };
  evento?: { natureza?: string; local?: string; amparo?: string };
  /** Despacho de reconhecimento do OD (art. 16 da Port C Ex 1.746/2022) anexado. */
  despachoOd?: boolean;
  /** Nome do militar conferido no BI de ida, no BI de retorno e na autorização. */
  bisConferidos?: boolean;
  /** Lançamentos de Grat Rep das fichas que são do mesmo evento: "2023-12-AR0061". */
  considerados?: string[];
}

export interface ValorMes { ano: number; mes: number; valor: number }
export interface LancamentoGr { ano: number; mes: number; codigo: string; descricao: string; valor: number; chave: string; considerado: boolean; justificativa: string }
export interface Alerta { codigo: string; descricao: string }
export interface PlanoGratRep {
  categoria: string | null;
  /** A graduação veio da NR0001 da ficha (não foi confirmada pelo operador). */
  categoriaSugerida: boolean;
  soldo: number | null;
  soldoFicha: number | null;
  valorDiario: number | null;
  dias: number;
  devido: number | null;
  competencia: { ano: number; mes: number };
  lancamentosGr: LancamentoGr[];
  recebidos: ValorMes[];
  posPeriodo: ValorMes[];
  devidos: ValorMes[];
  notas: Record<string, string>;
  alertas: Alerta[];
  pendencias: string[];
  textos: { explicacao: string | null; documentos: string[] };
}

const k = (ano: number, mes: number) => ano * 12 + mes;
const centavos = (v: number) => Math.round(v * 100) / 100;
const reais = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const br = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
const utc = (d: string) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)) || 1);
const hora = (h: string | undefined) => (h && /^\d{2}:\d{2}$/.test(h) ? h : null);

/** O processo segue a automação: criado depois da mudança e com a espécie da Grat Rep. */
export function gratRepAutomatico(p: { especie_divida?: string | null; complementos?: unknown }): boolean {
  const c = p.complementos as { calculoAutomaticoGratRep?: unknown } | null | undefined;
  return p.especie_divida === ESPECIE_GRAT_REP && c?.calculoAutomaticoGratRep === true;
}

/** Confere a forma do que vem do banco (jsonb). */
export function dadosGratRep(complementos: unknown): DadosGratRep {
  const g = (complementos as { gratRep?: unknown } | null | undefined)?.gratRep;
  return g && typeof g === "object" ? (g as DadosGratRep) : {};
}

/** Dias corridos do início ao fim, inclusive, com a regra das 8 horas nos extremos. */
export function diasDoEvento(inicio: string, fim: string, horaSaida?: string, horaRetorno?: string) {
  const corridos = Math.round((utc(fim) - utc(inicio)) / 86_400_000) + 1;
  const motivos: string[] = [];
  let dias = corridos;
  const s = hora(horaSaida), r = hora(horaRetorno);
  if (s && s > "16:00") { dias--; motivos.push(`o dia de saída (${br(inicio)}) não conta: saída às ${s}, depois das 16h00`); }
  if (r && r < "08:00") { dias--; motivos.push(`o dia de retorno (${br(fim)}) não conta: retorno às ${r}, antes das 08h00`); }
  return { corridos, dias: Math.max(0, dias), motivos };
}

/** Linhas das fichas com um dos códigos, mês a mês (uma por código e mês). */
function linhasDasFichas(fichas: FichaLida[], codigos: Set<string>) {
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

const somarPorMes = (lista: { ano: number; mes: number; valor: number }[]): ValorMes[] => {
  const m = new Map<number, ValorMes>();
  for (const v of lista) {
    const atual = m.get(k(v.ano, v.mes)) ?? { ano: v.ano, mes: v.mes, valor: 0 };
    atual.valor = centavos(atual.valor + v.valor);
    m.set(k(v.ano, v.mes), atual);
  }
  return [...m.values()].sort((a, b) => k(a.ano, a.mes) - k(b.ano, b.mes));
};

/**
 * @param inicio e fim do período da dívida ("AAAA-MM-DD"): o dia de início é o da ida e o de fim, o do retorno
 * @param hoje "AAAA-MM-DD", para a prescrição quando não há data de requerimento
 */
export function planoGratRep(entrada: {
  fichas: FichaLida[]; inicio: string; fim: string; dados: DadosGratRep;
  dataRequerimento?: string | null; hoje: string;
}): PlanoGratRep {
  const { fichas, inicio, fim, dados } = entrada;
  const competencia = { ano: Number(inicio.slice(0, 4)), mes: Number(inicio.slice(5, 7)) };
  const ini = k(competencia.ano, competencia.mes), fi = k(Number(fim.slice(0, 4)), Number(fim.slice(5, 7)));
  const alertas: Alerta[] = [];
  const pendencias: string[] = [];

  // soldo da ficha no mês do fato: confere a tabela e sugere a graduação. No mês da incorporação ou da promoção a
  // NR0001 pode ser proporcional: valem também os 2 meses seguintes (o 1º deles com soldo de alguma graduação)
  const soldos = linhasDasFichas(fichas, CODIGOS_SOLDO);
  const soldoDoMes = (km: number) => soldos.filter((l) => k(l.ano, l.mes) === km).reduce((s, l) => centavos(s + l.valor), 0) || null;
  const soldosFicha = [ini, ini + 1, ini + 2].map(soldoDoMes).filter((v): v is number => v !== null);
  const soldoFicha = soldosFicha.find((v) => categoriasComSoldo(v, inicio).length) ?? soldosFicha[0] ?? null;
  let categoria = categoriaSoldo(dados.categoria)?.id ?? null;
  let categoriaSugerida = false;
  if (!categoria && soldoFicha) {
    const candidatas = categoriasComSoldo(soldoFicha, inicio);
    // mesmo soldo em mais de uma graduação (ex.: Cb não engajado e Sd EV): a mais moderna; o posto do cadastro é o
    // atual (o militar pode ter sido promovido depois do fato), por isso não serve para escolher
    const escolhida = candidatas.at(-1);
    if (escolhida) { categoria = escolhida.id; categoriaSugerida = true; }
  }
  if (!categoria) pendencias.push("Informe o posto/graduação na data do fato (não foi possível sugerir pela NR0001 da ficha do mês de início).");
  else if (categoriaSugerida) pendencias.push(`Confirme o posto/graduação na data do fato: “${categoriaSoldo(categoria)!.nome}” foi sugerido pelo soldo da ficha (NR0001 de R$ ${reais(soldoFicha!)}).`);

  const soldo = categoria ? soldoNaData(categoria, inicio) : null;
  if (categoria && soldo === null) pendencias.push(`Não há soldo na tabela para ${br(inicio)} (a tabela começa em 2018).`);
  if (soldo !== null && soldoFicha !== null && !soldosFicha.includes(soldo)) {
    alertas.push({ codigo: "SOLDO_FICHA", descricao: `O soldo da ficha em ${String(competencia.mes).padStart(2, "0")}/${competencia.ano} (NR0001: R$ ${reais(soldoFicha)}) é diferente do soldo da tabela para ${categoriaSoldo(categoria)!.nome} (R$ ${reais(soldo)}). A ficha pode trazer o soldo proporcional ou outra graduação: confira.` });
  }

  const { corridos, dias, motivos } = diasDoEvento(inicio, fim, dados.horaSaida, dados.horaRetorno);
  if (!hora(dados.horaSaida) || !hora(dados.horaRetorno)) pendencias.push("Informe a hora de saída e a hora de retorno (regra das 8 horas do Decreto 11.002/2022, art. 4º, § 1º).");
  const valorDiario = soldo !== null ? centavos(soldo * PERCENTUAL_DIARIO) : null;
  const devido = valorDiario !== null && dias > 0 ? centavos(dias * valorDiario) : null;

  // autorização
  const aut = dados.autorizacao ?? {};
  const difDias = aut.dias != null && aut.dias !== dias;
  const difValor = aut.valor != null && devido !== null && centavos(aut.valor) !== devido;
  if (difDias || difValor) {
    alertas.push({ codigo: "DIVERGENCIA_AUTORIZACAO", descricao: `Calculado: ${dias} dia(s)${devido !== null ? ` / R$ ${reais(devido)}` : ""}; autorizado: ${aut.dias ?? "?"} dia(s)${aut.valor != null ? ` / R$ ${reais(aut.valor)}` : ""}. A Div Pg Pes paga pelos dias corridos, inclusive o de saída e o de retorno; confirme com o OD se o montante autorizado é teto.` });
  }
  if (aut.publicacao && /^\d{4}-\d{2}-\d{2}$/.test(aut.publicacao)) {
    if (Number(aut.publicacao.slice(0, 4)) <= competencia.ano) {
      alertas.push({ codigo: "NAO_E_DEA", descricao: `A autorização foi publicada em ${br(aut.publicacao)}, no mesmo exercício do fato gerador: não é DEA.` });
    }
  } else pendencias.push("Informe a data de publicação da autorização (define se é DEA e o texto do motivo).");
  const referencia = entrada.dataRequerimento && /^\d{4}-\d{2}-\d{2}/.test(entrada.dataRequerimento) ? entrada.dataRequerimento : entrada.hoje;
  const cincoAnos = `${Number(inicio.slice(0, 4)) + 5}${inicio.slice(4, 10)}`;
  if (referencia.slice(0, 10) > cincoAnos) {
    alertas.push({ codigo: "PRESCRICAO", descricao: `O fato gerador (${br(inicio)}) tem mais de 5 anos em ${br(referencia.slice(0, 10))}${entrada.dataRequerimento ? " (data do requerimento)" : ""}: verifique a prescrição.` });
  }
  if (!dados.despachoOd) pendencias.push("Despacho de reconhecimento do OD (art. 16 da Port C Ex 1.746/2022) não marcado como anexado.");
  if (!dados.bisConferidos) pendencias.push("Confira o nome do militar no BI de ida, no BI de retorno e na autorização.");

  // lançamentos de Grat Rep das fichas, a partir do mês do fato
  const considerados = new Set(dados.considerados ?? []);
  const lancamentosGr: LancamentoGr[] = linhasDasFichas(fichas, CODIGOS_GRAT_REP).filter((l) => k(l.ano, l.mes) >= ini).map((l) => {
    const chave = `${l.ano}-${l.mes}-${l.codigo}`;
    const considerado = considerados.has(chave);
    const igual = (devido !== null && l.valor === devido) || (aut.valor != null && l.valor === centavos(aut.valor));
    const justificativa = considerado
      ? `Marcado pelo operador como pagamento deste evento${k(l.ano, l.mes) > fi ? " (recebido após o período)" : ""}.`
      : igual ? "Valor igual ao devido ou ao autorizado: possível pagamento deste evento (confira o BI)." : "Não marcado como deste evento.";
    return { ...l, chave, considerado, justificativa };
  });
  for (const l of lancamentosGr.filter((x) => !x.considerado && x.justificativa.startsWith("Valor igual"))) {
    alertas.push({ codigo: "POSSIVEL_DUPLICIDADE", descricao: `${l.codigo} de R$ ${reais(l.valor)} em ${String(l.mes).padStart(2, "0")}/${l.ano}, igual ao devido ou ao autorizado, sem estar marcado como deste evento. Se já foi pago, marque-o como recebido.` });
  }
  const marcados = lancamentosGr.filter((l) => l.considerado);
  const recebidos = somarPorMes(marcados.filter((l) => k(l.ano, l.mes) <= fi));
  const posPeriodo = somarPorMes(marcados.filter((l) => k(l.ano, l.mes) > fi));
  const totalRecebido = centavos(marcados.reduce((s, l) => s + l.valor, 0));
  if (devido !== null && marcados.length && totalRecebido >= devido) {
    alertas.push({ codigo: "SEM_DIVIDA", descricao: `O recebido marcado (R$ ${reais(totalRecebido)}) é igual ou maior que o devido (R$ ${reais(devido)}): não há dívida.` });
  }

  const devidos = devido !== null ? [{ ...competencia, valor: devido }] : [];
  const notas: Record<string, string> = {};
  if (devido !== null) {
    notas[`${competencia.ano}-${competencia.mes}`] = `Gratificação de Representação: soldo de ${categoriaSoldo(categoria)!.nome} em ${br(inicio)}, R$ ${reais(soldo!)} × 2% = R$ ${reais(valorDiario!)} por dia × ${dias} dia(s) (${br(inicio)} a ${br(fim)}${motivos.length ? `; ${corridos} corridos, ${motivos.join("; ")}` : ", corridos, inclusive o de saída e o de retorno"}) = R$ ${reais(devido)}. Todo o valor é lançado no mês de início (competência).`;
  }

  // textos sugeridos para o verso
  let explicacao: string | null = null;
  if (aut.publicacao && /^\d{4}-\d{2}-\d{2}$/.test(aut.publicacao)) {
    const anos = Number(aut.publicacao.slice(0, 4)) - competencia.ano;
    const quando = anos === 1 ? "no exercício seguinte ao fato gerador" : anos > 1 ? `${anos} anos após o fato gerador` : "no mesmo exercício do fato gerador";
    explicacao = `A autorização para pagamento foi publicada em ${br(aut.publicacao)}${aut.documento ? ` (${aut.documento.trim()})` : ""}, ${quando} (${br(inicio)} a ${br(fim)}), transformando o pagamento em DEA.`;
  }
  // no modelo dos processos pagos (64552.003413/2025-49 e .004696/2025-46): a atividade, o local e o período
  const natureza = dados.evento?.natureza?.trim();
  if (natureza) {
    const local = dados.evento?.local?.trim();
    explicacao = `O militar requer o pagamento da Gratificação de Representação por ter participado da atividade “${natureza}”${local ? `, em ${local}` : ""}, no período de ${br(inicio)} a ${br(fim)}, deixando de recebê-la à época dos fatos.${explicacao ? ` ${explicacao}` : ""}`;
  }
  const documentos = [aut.documento, aut.transcricao].map((d) => (d ?? "").trim()).filter(Boolean);

  return {
    categoria, categoriaSugerida, soldo, soldoFicha, valorDiario, dias, devido, competencia, lancamentosGr, recebidos, posPeriodo,
    devidos, notas, alertas, pendencias, textos: { explicacao, documentos },
  };
}

interface Rubrica { posicao: number; codigo: string; tipo: string }
const ULTIMA_RECEITA = 12;
const ehA62 = (r: Rubrica) => r.codigo.trim().toUpperCase().startsWith("A62 ");

/** "A62 - GRAT REP 2%" (Receita): a que já houver, a posição 1 vazia ou a 1ª receita vazia. */
export function rubricasGratRep(rubricas: Rubrica[]) {
  const lista = rubricas.map((r) => ({ ...r, codigo: r.codigo ?? "" }));
  const existente = lista.find(ehA62);
  if (existente) {
    return { mudadas: existente.tipo === "Receita" ? [] : [{ ...existente, tipo: "Receita" }], posicao: existente.posicao };
  }
  const vazia = lista.find((r) => r.posicao === 1 && !r.codigo.trim()) ?? lista.find((r) => r.posicao <= ULTIMA_RECEITA && !r.codigo.trim());
  return vazia ? { mudadas: [{ ...vazia, codigo: RUBRICA_GRAT_REP, tipo: "Receita" }], posicao: vazia.posicao } : { mudadas: [], posicao: null };
}
