/**
 * Cálculo automático das gratificações MENSAIS (decisão de 25/11/2026), no molde da Gratificação de Representação
 * eventual (lib/grat-rep). Vale só para os processos criados a partir dessa data (complementos.calculoAutomaticoGratMensal).
 *
 * - Gratificação de Localidade Especial: MP 2.215-10/2001, art. 3º, VII, e Anexo III, Tabela I (categoria A = 20% e
 *   B = 10% do soldo, por mês); Portaria GM-MD nº 379/2022 (categoria A a oeste da "Linha Alfa", B entre as linhas Alfa
 *   e Beta: o operador escolhe), alterada pela Portaria GM-MD nº 4.965/2025 (art. 2º-A: militar em comissão, operação,
 *   exercício ou destaque; período de 8 horas ou mais conta como um dia; acumula com a Grat Rep). Rubricas A07 (A) e A08 (B).
 * - Gratificação de Representação de comando, direção ou chefia de OM (e Chefe de Instrução de Tiro de Guerra, desde a
 *   Lei 13.954/2019, DIEx 268-APG 8/SEF): Lei 13.954/2019, Anexo IV (10%); Decreto 11.002/2022, art. 4º, § 2º ("dez por
 *   cento do soldo do militar, a cada mês de exercício", proporcional aos dias). Rubrica A16 - GRAT REP 10%.
 *
 * Devido de cada mês = soldo da tabela (lib/soldos) do posto/graduação no 1º dia do mês dentro do período × percentual
 * × dias do mês dentro do período ÷ dias do mês no calendário (mês cheio: o valor inteiro). Conferido em 25/11/2026 com o
 * processo pago 64360.000191/2026-41 (ST Laryerferson, Op CATRIMANI II, 20 a 31 DEZ 25: 20% × 6.447,00 × 12/31 = 499,12).
 * Recebidos: os lançamentos das fichas só entram marcados pelo operador. Os alertas não bloqueiam a emissão.
 */
import type { FichaLida } from "./receitas";
import { sugerirLocalidade } from "./localidades-especiais";
import { categoriasComSoldo, categoriaSoldo, soldoNaData } from "./soldos";

export const ESPECIE_GLE = "Gratificação de Localidade Especial";
export const ESPECIE_GR_CMDO = "Gratificação de Representação de Comando";
export const RUBRICAS_GRAT_MENSAL = { "gle-a": "A07 - G LOC ESP TP A", "gle-b": "A08 - G LOC ESP TP B", comando: "A16 - GRAT REP 10%" } as const;
export type TipoGratMensal = keyof typeof RUBRICAS_GRAT_MENSAL;
export const PERCENTUAL: Record<TipoGratMensal, number> = { "gle-a": 0.2, "gle-b": 0.1, comando: 0.1 };
/** Lançamentos nas fichas: SIPPES (NR/AR/ER) e SIAPPES (as atrasadas e as diferenças também). */
export const CODIGOS_GLE = new Set(["NR0007", "NR0008", "NR0063", "AR0007", "AR0008", "AR0063", "ER0007", "ER0008", "ER0063", "A07", "A08", "A63", "A67", "B59", "B69"]);
export const CODIGOS_GR_CMDO = new Set(["NR0016", "AR0016", "ER0016", "A16", "A36", "B22", "BR0", "BR5"]);
const CODIGOS_SOLDO = new Set(["NR0001", "A01"]);

/** O que o operador informa no quadro (complementos.gratMensal). */
export interface DadosGratMensal {
  /** Posto/graduação no período (id de lib/soldos). Vazio: o sugerido pela NR0001 da ficha. */
  categoria?: string;
  /** Localidade especial: categoria da localidade (Portaria GM-MD 379/2022). */
  localidade?: "A" | "B";
  /** Localidade (cidade/UF) ou OM/cargo (comando). */
  local?: string;
  /** Ato que materializa o direito (Adt/BI da designação, da operação ou da nomeação para o cargo). */
  documento?: string;
  /** Lançamentos das fichas que são desta dívida: "2025-12-NR0007". */
  considerados?: string[];
}

export interface ValorMes { ano: number; mes: number; valor: number }
export interface Alerta { codigo: string; descricao: string }
export interface Lancamento { ano: number; mes: number; codigo: string; descricao: string; valor: number; chave: string; considerado: boolean }
export interface PlanoGratMensal {
  tipo: TipoGratMensal | null;
  /** Localidade especial: categoria usada (a escolhida ou, sem ela, a sugerida) e a sugestão pela Portaria 379. */
  localidade: "A" | "B" | null;
  sugestao: ReturnType<typeof sugerirLocalidade>;
  rubrica: string | null;
  categoria: string | null;
  categoriaSugerida: boolean;
  meses: { ano: number; mes: number; soldo: number | null; dias: number; diasMes: number; valor: number | null }[];
  devidos: ValorMes[];
  recebidos: ValorMes[];
  posPeriodo: ValorMes[];
  lancamentos: Lancamento[];
  notas: Record<string, string>;
  alertas: Alerta[];
  pendencias: string[];
  textos: { explicacao: string | null; documentos: string[] };
}

const k = (ano: number, mes: number) => ano * 12 + mes;
const centavos = (v: number) => Math.round(v * 100) / 100;
const reais = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const br = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
const dd = (n: number) => String(n).padStart(2, "0");
const diasNoMes = (ano: number, mes: number) => new Date(Date.UTC(ano, mes, 0)).getUTCDate();

/** O processo segue a automação: criado depois da mudança e com uma das duas espécies. */
export function gratMensalAutomatico(p: { especie_divida?: string | null; complementos?: unknown }): boolean {
  const c = p.complementos as { calculoAutomaticoGratMensal?: unknown } | null | undefined;
  return (p.especie_divida === ESPECIE_GLE || p.especie_divida === ESPECIE_GR_CMDO) && c?.calculoAutomaticoGratMensal === true;
}

export function dadosGratMensal(complementos: unknown): DadosGratMensal {
  const d = (complementos as { gratMensal?: unknown } | null | undefined)?.gratMensal;
  return d && typeof d === "object" ? (d as DadosGratMensal) : {};
}

export function tipoGratMensal(especie: string | null | undefined, dados: DadosGratMensal): TipoGratMensal | null {
  if (especie === ESPECIE_GR_CMDO) return "comando";
  if (especie === ESPECIE_GLE) return dados.localidade === "A" ? "gle-a" : dados.localidade === "B" ? "gle-b" : null;
  return null;
}

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
 * @param inicio e fim do período da dívida ("AAAA-MM-DD"): os dias na localidade ou no cargo
 * @param hoje "AAAA-MM-DD", para a prescrição e o exercício corrente
 */
export function planoGratMensal(entrada: {
  fichas: FichaLida[]; especie: string | null | undefined; inicio: string; fim: string; dados: DadosGratMensal;
  dataRequerimento?: string | null; hoje: string;
  /** texto do documento de averbação (entra no documento que materializou o direito) */
  averbacao?: string | null;
}): PlanoGratMensal {
  const { fichas, inicio, fim, dados, hoje } = entrada;
  const alertas: Alerta[] = [];
  const pendencias: string[] = [];
  // categoria da localidade: a escolhida; sem ela, a sugerida pela Portaria 379 (o operador confirma)
  const gle = entrada.especie === ESPECIE_GLE;
  const sugestao = gle ? sugerirLocalidade(dados.local) : null;
  const localidade = gle ? (dados.localidade ?? sugestao?.categoria ?? null) : null;
  const tipo = tipoGratMensal(entrada.especie, { ...dados, localidade: localidade ?? undefined });
  if (gle && !dados.localidade) {
    pendencias.push(localidade ? `Confirme a categoria ${localidade}: foi sugerida pela localidade (${sugestao!.motivo})` : "Escolha a categoria da localidade especial (A ou B), pela Portaria GM-MD nº 379/2022.");
  }
  if (gle && dados.localidade && sugestao && sugestao.categoria !== dados.localidade) {
    alertas.push({ codigo: "CATEGORIA_LOCALIDADE", descricao: `Categoria escolhida: ${dados.localidade}. Pela Portaria GM-MD nº 379/2022: ${sugestao.motivo} Confira.` });
  }
  if (gle && !dados.localidade && sugestao && sugestao.categoria === null) alertas.push({ codigo: "CATEGORIA_LOCALIDADE", descricao: sugestao.motivo });
  const ini = k(+inicio.slice(0, 4), +inicio.slice(5, 7)), fi = k(+fim.slice(0, 4), +fim.slice(5, 7));
  if (fim < inicio) pendencias.push("O fim do período é anterior ao início: confira em Informações.");

  // posto/graduação: o informado ou o sugerido pela NR0001 (mês de início e os 2 seguintes, por causa do proporcional)
  const soldos = linhasDasFichas(fichas, CODIGOS_SOLDO);
  const soldoDoMes = (km: number) => soldos.filter((l) => k(l.ano, l.mes) === km).reduce((s, l) => centavos(s + l.valor), 0) || null;
  const soldosFicha = [ini, ini + 1, ini + 2].map(soldoDoMes).filter((v): v is number => v !== null);
  const soldoFicha = soldosFicha.find((v) => categoriasComSoldo(v, inicio).length) ?? soldosFicha[0] ?? null;
  let categoria = categoriaSoldo(dados.categoria)?.id ?? null;
  let categoriaSugerida = false;
  if (!categoria && soldoFicha) {
    const escolhida = categoriasComSoldo(soldoFicha, inicio).at(-1);
    if (escolhida) { categoria = escolhida.id; categoriaSugerida = true; }
  }
  if (!categoria) pendencias.push("Informe o posto/graduação no período (não foi possível sugerir pela NR0001 da ficha).");
  else if (categoriaSugerida) pendencias.push(`Confirme o posto/graduação no período: “${categoriaSoldo(categoria)!.nome}” foi sugerido pelo soldo da ficha (NR0001 de R$ ${reais(soldoFicha!)}).`);
  const soldoInicio = categoria ? soldoNaData(categoria, inicio) : null;
  if (soldoInicio !== null && soldosFicha.length && !soldosFicha.includes(soldoInicio)) {
    alertas.push({ codigo: "SOLDO_FICHA", descricao: `A NR0001 da ficha (R$ ${reais(soldoFicha!)}) é diferente do soldo da tabela para ${categoriaSoldo(categoria)!.nome} (R$ ${reais(soldoInicio)}): pode ser proporcional ou de outro posto; confira.` });
  }

  // devido mês a mês, proporcional aos dias do mês dentro do período
  const meses: PlanoGratMensal["meses"] = [];
  if (fim >= inicio) for (let m = ini; m <= fi; m++) {
    const ano = Math.floor((m - 1) / 12), mes = ((m - 1) % 12) + 1, diasMes = diasNoMes(ano, mes);
    const de = m === ini ? +inicio.slice(8, 10) : 1, ate = m === fi ? +fim.slice(8, 10) : diasMes;
    const dias = ate - de + 1;
    const soldo = categoria ? soldoNaData(categoria, `${ano}-${dd(mes)}-${dd(de)}`) : null;
    const valor = soldo !== null && tipo ? centavos(dias === diasMes ? soldo * PERCENTUAL[tipo] : (soldo * PERCENTUAL[tipo] * dias) / diasMes) : null;
    meses.push({ ano, mes, soldo, dias, diasMes, valor });
  }
  if (categoria && meses.some((m) => m.soldo === null)) pendencias.push("Há meses sem soldo na tabela (a tabela começa em 2018).");
  const devidos = meses.filter((m) => m.valor !== null && m.valor > 0).map((m) => ({ ano: m.ano, mes: m.mes, valor: m.valor! }));

  // lançamentos das fichas (a partir do início): só entram marcados
  const considerados = new Set(dados.considerados ?? []);
  const codigos = entrada.especie === ESPECIE_GR_CMDO ? CODIGOS_GR_CMDO : CODIGOS_GLE;
  const lancamentos: Lancamento[] = linhasDasFichas(fichas, codigos).filter((l) => k(l.ano, l.mes) >= ini)
    .map((l) => { const chave = `${l.ano}-${l.mes}-${l.codigo}`; return { ...l, chave, considerado: considerados.has(chave) }; });
  for (const l of lancamentos.filter((x) => !x.considerado && k(x.ano, x.mes) <= fi + 3)) {
    alertas.push({ codigo: "POSSIVEL_DUPLICIDADE", descricao: `${l.codigo} de R$ ${reais(l.valor)} em ${dd(l.mes)}/${l.ano}, no período ou logo depois, sem estar marcado como desta dívida. Se é o pagamento dela, marque-o como recebido.` });
  }
  const marcados = lancamentos.filter((l) => l.considerado);
  const recebidos = somarPorMes(marcados.filter((l) => k(l.ano, l.mes) <= fi));
  const posPeriodo = somarPorMes(marcados.filter((l) => k(l.ano, l.mes) > fi));
  const totalDevido = centavos(devidos.reduce((s, v) => s + v.valor, 0)), totalRecebido = centavos(marcados.reduce((s, l) => s + l.valor, 0));
  if (marcados.length && totalRecebido >= totalDevido && totalDevido > 0) {
    alertas.push({ codigo: "SEM_DIVIDA", descricao: `O recebido marcado (R$ ${reais(totalRecebido)}) é igual ou maior que o devido (R$ ${reais(totalDevido)}): não há dívida.` });
  }

  // exercício corrente e prescrição (5 anos do mês devido até o requerimento)
  if (+fim.slice(0, 4) >= +hoje.slice(0, 4)) alertas.push({ codigo: "NAO_E_DEA", descricao: `O período (${br(inicio)} a ${br(fim)}) chega ao exercício corrente: o que for deste ano é pago em folha, não por DEA.` });
  const referencia = entrada.dataRequerimento && /^\d{4}-\d{2}-\d{2}$/.test(entrada.dataRequerimento) ? entrada.dataRequerimento : hoje;
  const limite = `${+referencia.slice(0, 4) - 5}${referencia.slice(4, 10)}`;
  if (inicio < limite) alertas.push({ codigo: "PRESCRICAO", descricao: `Parte do período é anterior a ${br(limite)} (5 anos antes de ${br(referencia)}${entrada.dataRequerimento ? ", data do requerimento" : ""}): verifique a prescrição.` });
  if (!dados.documento?.trim()) pendencias.push(entrada.especie === ESPECIE_GR_CMDO ? "Informe o ato de nomeação ou designação para o cargo (BI/Adt)." : "Informe o ato que materializa o direito (designação, operação ou destaque: BI/Adt).");

  const rubrica = tipo ? RUBRICAS_GRAT_MENSAL[tipo] : null;
  const nome = entrada.especie === ESPECIE_GR_CMDO ? "Gratificação de Representação de comando" : `Gratificação de Localidade Especial (categoria ${localidade ?? "?"})`;
  const notas: Record<string, string> = {};
  for (const m of meses.filter((x) => x.valor !== null && tipo)) {
    notas[`${m.ano}-${m.mes}`] = `${nome}: ${Math.round(PERCENTUAL[tipo!] * 100)}% × R$ ${reais(m.soldo!)} (${categoriaSoldo(categoria)!.nome})${m.dias === m.diasMes ? " (mês cheio)" : ` × ${m.dias}/${m.diasMes} dias`} = R$ ${reais(m.valor!)}.`;
  }
  const local = dados.local?.trim();
  const explicacao = entrada.especie === ESPECIE_GR_CMDO
    ? `O militar requer o pagamento da Gratificação de Representação (10% do soldo) pelo exercício de cargo de comando, direção ou chefia${local ? ` (${local})` : ""}, no período de ${br(inicio)} a ${br(fim)}, deixando de recebê-la à época dos fatos.`
    : `O militar requer o pagamento da Gratificação de Localidade Especial (categoria ${localidade ?? "?"}) por ter permanecido${local ? ` em ${local}` : " em localidade especial"}, no período de ${br(inicio)} a ${br(fim)}, deixando de recebê-la à época dos fatos.`;
  const documentos = [dados.documento?.trim().slice(0, 100), entrada.averbacao?.trim().slice(0, 100)].filter((d): d is string => !!d);
  return { tipo, localidade, sugestao, rubrica, categoria, categoriaSugerida, meses, devidos, recebidos, posPeriodo, lancamentos, notas, alertas, pendencias, textos: { explicacao, documentos } };
}

interface Rubrica { posicao: number; codigo: string; tipo: string }
const ULTIMA_RECEITA = 12;

/** A rubrica da gratificação (Receita): a que já houver, a posição 1 vazia ou a 1ª receita vazia. */
export function rubricasGratMensal(rubricas: Rubrica[], codigo: string) {
  const lista = rubricas.map((r) => ({ ...r, codigo: r.codigo ?? "" }));
  const prefixo = codigo.slice(0, 4);
  const existente = lista.find((r) => r.codigo.trim().toUpperCase().startsWith(prefixo));
  if (existente) return { mudadas: existente.tipo === "Receita" ? [] : [{ ...existente, tipo: "Receita" }], posicao: existente.posicao };
  const vazia = lista.find((r) => r.posicao === 1 && !r.codigo.trim()) ?? lista.find((r) => r.posicao <= ULTIMA_RECEITA && !r.codigo.trim());
  return vazia ? { mudadas: [{ ...vazia, codigo, tipo: "Receita" }], posicao: vazia.posicao } : { mudadas: [], posicao: null };
}
