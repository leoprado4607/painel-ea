/**
 * Cálculo automático da diferença de "Adicional Habilitação" (decisão de 25/11/2026). Vale só para os processos criados
 * a partir dessa data (complementos.calculoAutomaticoAdicHab).
 *
 * Base: Lei 13.954/2019, art. 9º e Anexo III (percentuais por tipo de curso, com efeitos financeiros escalonados em 1º de
 * julho de 2020 a 2023); Portaria C Ex nº 1.443/2021 (equivalência dos cursos; direito a partir da conclusão com
 * aproveitamento); Portaria Normativa nº 86/GM-MD/2020; DIEx 88-SEF/2021 e DIEx 986-10º CGCFEx/2025 (temporários).
 *
 * - Devido (A03) de cada mês = percentual da TABELA DA LEI vigente no dia × soldo da tabela (lib/soldos) do posto no dia,
 *   proporcional aos dias do mês no calendário; os dias do mês fora do período ficam com o que a ficha pagou. O pedido no
 *   requerimento não muda o percentual: se pedir mais que a tabela, é alerta (decisão do usuário, 25/11/2026).
 * - Recebido (A03) = o adicional de habilitação pago na ficha no mês (NR0003/A03), lido sozinho.
 * - Reflexos: Adicional Natalino (A85) = diferença de dezembro (mês cheio) × meses de serviço no ano ÷ 12; Adicional de
 *   Férias (AD2) = 1/3 da diferença (mês cheio) nos meses em que a ficha mostra o adicional de férias pago.
 * - Descontos sobre a diferença do A03: Fusex 3% (Z01) e cota complementar de 0,4% ou 0,5% (ZM7), pela Portaria C Ex
 *   nº 863/2005; Pensão Militar no percentual do militar (Z02).
 * Conferido em 25/11/2026 com os processos (não pagos) do Maj Couto, da 2º Ten Mulatinho e do 2º Sgt Quinebre.
 * Os alertas não bloqueiam a emissão.
 */
import type { FichaLida } from "./receitas";
import { categoriasComSoldo, categoriaSoldo, soldoNaData } from "./soldos";
import type { TextosVerso } from "@/lib/textos-verso";

export const ESPECIE_ADIC_HAB = "Adicional Habilitação";
export const RUBRICA_ADIC_HAB = "A03 - ADIC HAB";
export const RUBRICA_NATAL = "A85 - ADIC NATAL";
export const RUBRICA_FERIAS = "AD2 - ADICIONAL FERIAS";
export const RUBRICA_FUSEX = "Z01 - FUSEX";
export const RUBRICA_PMIL = "Z02 - P MIL 7,5/9,5/10,5%";
export const RUBRICA_PMIL_15 = "Z02 - P MIL 1,5%";
export const RUBRICA_FUSEX_DEP = "ZM7 - DESC DEP FUSEX";

/** Adicional de habilitação nas fichas: SIPPES NR0003 e SIAPPES A03 (os atrasados ficam para o alerta de duplicidade). */
export const CODIGOS_AH = new Set(["NR0003", "A03"]);
const CODIGOS_AH_ATRASADO = new Set(["AR0003", "ER0003", "A23"]);
const CODIGOS_FERIAS = new Set(["NR0092", "AD2"]);
const CODIGOS_SOLDO = new Set(["NR0001", "A01"]);
/** Todos os usados (a prévia das fichas não os lista como "não usados"). */
export const CODIGOS_ADIC_HAB = new Set([...CODIGOS_AH, ...CODIGOS_AH_ATRASADO]);

export type TipoCurso = "altos1" | "altos2" | "aperfeicoamento" | "especializacao" | "formacao";
/** Lei 13.954/2019, Anexo III: início de cada faixa e o percentual de cada tipo de curso. */
const FAIXAS = ["0000-01-01", "2020-07-01", "2021-07-01", "2022-07-01", "2023-07-01"] as const;
export const TABELA_AH: Record<TipoCurso, { nome: string; percentuais: readonly number[] }> = {
  altos1: { nome: "Altos Estudos Categoria I", percentuais: [30, 42, 54, 66, 73] },
  altos2: { nome: "Altos Estudos Categoria II", percentuais: [25, 37, 49, 61, 68] },
  aperfeicoamento: { nome: "Aperfeiçoamento", percentuais: [20, 27, 34, 41, 45] },
  especializacao: { nome: "Especialização", percentuais: [16, 19, 22, 25, 27] },
  formacao: { nome: "Formação", percentuais: [12, 12, 12, 12, 12] },
};
export const TIPOS_CURSO = Object.keys(TABELA_AH) as TipoCurso[];

/** Percentual da lei para o tipo de curso no dia ("AAAA-MM-DD"). */
export function percentualAH(tipo: TipoCurso, data: string): number {
  let i = 0;
  FAIXAS.forEach((f, k) => { if (data >= f) i = k; });
  return TABELA_AH[tipo].percentuais[i]!;
}

/** O tipo de curso pelo percentual pedido (o da última faixa ou o vigente na data): sugestão para a leitura do processo. */
export function tipoPeloPercentual(pct: number, data: string): TipoCurso | null {
  return TIPOS_CURSO.find((t) => t !== "formacao" && (TABELA_AH[t].percentuais.at(-1) === pct || percentualAH(t, data) === pct)) ?? (pct === 12 ? "formacao" : null);
}

/** O que o operador informa no quadro (complementos.adicHab). */
export interface DadosAdicHab {
  /** Textos do verso editados pelo operador (lib/textos-verso); sem eles, valem os sugeridos pelo cálculo. */
  textosVerso?: TextosVerso;
  /** Tipo do curso concluído (o novo adicional). */
  tipo?: TipoCurso;
  /** Nome do curso e onde foi feito. */
  curso?: string;
  /** Percentual pedido no requerimento (só para o alerta). */
  percentualPedido?: number | null;
  /** Posto/graduação no início e as promoções no período ("AAAA-MM-DD" → id de lib/soldos). Vazio: o sugerido pela ficha. */
  postos?: { desde: string; categoria: string }[];
  /** Ato que materializa o direito (BI/Adt da conclusão ou do reconhecimento). */
  documento?: string;
  /** Reflexos e descontos: o sistema calcula e o operador confere (decisão de 25/11/2026). */
  natalino?: boolean;
  /** Meses de serviço no ano, por ano ("2023" → 6). Vazio: os meses com soldo na ficha. */
  avosNatal?: Record<string, number>;
  ferias?: boolean;
  /** Meses com adicional de férias ("2025-11"). Vazio: os da ficha dentro do período. */
  mesesFerias?: string[];
  descontos?: boolean;
  /** Pensão Militar: 7,5, 9,5 ou 10,5 (%), e se há também a de 1,5%. */
  pensao?: number;
  pensao15?: boolean;
  /** Cota complementar do Fusex (Portaria C Ex nº 863/2005): 0,4% (um dependente direto além do cônjuge) ou 0,5%. */
  fusexDependentes?: 0 | 0.4 | 0.5;
}

export interface ValorMes { ano: number; mes: number; valor: number }
export interface Alerta { codigo: string; descricao: string }
export interface MesAH { ano: number; mes: number; percentual: number; soldo: number | null; dias: number; diasMes: number; devido: number | null; recebido: number; diferenca: number | null }
export interface PlanoAdicHab {
  tipo: TipoCurso | null;
  categoria: string | null;
  categoriaSugerida: boolean;
  meses: MesAH[];
  /** Devidos e recebidos por rubrica (código completo). */
  devidos: Record<string, ValorMes[]>;
  recebidos: Record<string, ValorMes[]>;
  natalino: { ano: number; diferenca: number; avos: number; avosSugeridos: number; valor: number }[];
  ferias: { ano: number; mes: number; valor: number }[];
  mesesFeriasFicha: string[];
  totais: { a03: number; natal: number; ferias: number; descontos: number };
  notas: Record<string, string>;
  alertas: Alerta[];
  pendencias: string[];
  textos: { explicacao: string | null; documentos: string[] };
}

const k = (ano: number, mes: number) => ano * 12 + mes;
const centavos = (v: number) => Math.round((v + Math.sign(v) * 1e-9) * 100) / 100;
const reais = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const br = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
const dd = (n: number) => String(n).padStart(2, "0");
const diasNoMes = (ano: number, mes: number) => new Date(Date.UTC(ano, mes, 0)).getUTCDate();
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const mmm = (ano: number, mes: number) => `${MESES[mes - 1]}/${ano}`;

/** O processo segue a automação: criado depois da mudança e com a espécie do adicional. */
export function adicHabAutomatico(p: { especie_divida?: string | null; complementos?: unknown }): boolean {
  const c = p.complementos as { calculoAutomaticoAdicHab?: unknown } | null | undefined;
  return p.especie_divida === ESPECIE_ADIC_HAB && c?.calculoAutomaticoAdicHab === true;
}

export function dadosAdicHab(complementos: unknown): DadosAdicHab {
  const d = (complementos as { adicHab?: unknown } | null | undefined)?.adicHab;
  return d && typeof d === "object" ? (d as DadosAdicHab) : {};
}

function valoresPorMes(fichas: FichaLida[], codigos: Set<string>) {
  const m = new Map<number, number>();
  for (const f of fichas)
    for (const l of f.linhas) {
      if (!codigos.has(l.codigo.trim().toUpperCase())) continue;
      l.meses.forEach((v, i) => { if (v) m.set(k(f.ano, i + 1), centavos((m.get(k(f.ano, i + 1)) ?? 0) + v)); });
    }
  return m;
}

/**
 * @param inicio data de conclusão do curso (início do direito) e fim do período da dívida ("AAAA-MM-DD")
 * @param hoje "AAAA-MM-DD", para a prescrição e o exercício corrente
 */
export function planoAdicHab(entrada: {
  fichas: FichaLida[]; inicio: string; fim: string; dados: DadosAdicHab; dataRequerimento?: string | null; hoje: string;
  /** texto do documento de averbação (entra no documento que materializou o direito) */
  averbacao?: string | null;
}): PlanoAdicHab {
  const { fichas, inicio, fim, dados, hoje } = entrada;
  const alertas: Alerta[] = [];
  const pendencias: string[] = [];
  const tipo = dados.tipo && TABELA_AH[dados.tipo] ? dados.tipo : null;
  if (!tipo) pendencias.push("Escolha o tipo do curso concluído (Lei 13.954/2019, Anexo III; equivalência pela Portaria C Ex nº 1.443/2021).");
  if (fim < inicio) pendencias.push("O fim do período é anterior ao início: confira em Informações.");
  const ini = k(+inicio.slice(0, 4), +inicio.slice(5, 7)), fi = k(+fim.slice(0, 4), +fim.slice(5, 7));
  const soldos = valoresPorMes(fichas, CODIGOS_SOLDO), ahFicha = valoresPorMes(fichas, CODIGOS_AH);

  // posto: o informado (com as promoções) ou o sugerido pelo soldo da ficha no mês de início (ou nos 2 seguintes)
  const postos = (dados.postos ?? []).filter((p) => categoriaSoldo(p.categoria) && /^\d{4}-\d{2}-\d{2}$/.test(p.desde)).sort((a, b) => a.desde.localeCompare(b.desde));
  let categoriaSugerida = false;
  let categoria = postos[0]?.categoria ?? null;
  if (!categoria) {
    const s = [ini, ini + 1, ini + 2].map((m) => soldos.get(m)).find((v) => v && categoriasComSoldo(v, inicio).length);
    const c = s ? categoriasComSoldo(s, inicio).at(-1) : undefined;
    if (c) { categoria = c.id; categoriaSugerida = true; }
  }
  if (!categoria) pendencias.push("Informe o posto/graduação no início do período (não foi possível sugerir pela NR0001 da ficha).");
  else if (categoriaSugerida) pendencias.push(`Confirme o posto/graduação: “${categoriaSoldo(categoria)!.nome}” foi sugerido pelo soldo da ficha. Se houve promoção no período, informe a data e o novo posto.`);
  const postoNoDia = (d: string) => [...postos].reverse().find((p) => p.desde <= d)?.categoria ?? categoria;

  // mês a mês: dia a dia dentro do período (percentual e soldo do dia), o resto do mês com o que a ficha pagou
  const meses: MesAH[] = [];
  if (fim >= inicio) for (let m = ini; m <= fi; m++) {
    const ano = Math.floor((m - 1) / 12), mes = ((m - 1) % 12) + 1, diasMes = diasNoMes(ano, mes);
    const recebido = ahFicha.get(m) ?? 0;
    let soma = 0, dias = 0, ok = !!tipo;
    for (let d = 1; d <= diasMes; d++) {
      const dia = `${ano}-${dd(mes)}-${dd(d)}`;
      if (dia < inicio || dia > fim) { soma += recebido / diasMes; continue; }
      dias++;
      const soldo = soldoNaData(postoNoDia(dia), dia);
      if (soldo === null || !tipo) { ok = false; continue; }
      soma += (soldo * percentualAH(tipo, dia)) / 100 / diasMes;
    }
    const meio = `${ano}-${dd(mes)}-${dd(Math.min(diasMes, 15))}`;
    const devido = ok ? centavos(soma) : null;
    meses.push({
      ano, mes, percentual: tipo ? percentualAH(tipo, meio < inicio ? inicio : meio) : 0, soldo: soldoNaData(postoNoDia(meio < inicio ? inicio : meio), meio < inicio ? inicio : meio),
      dias, diasMes, devido, recebido, diferenca: devido === null ? null : centavos(devido - recebido),
    });
  }
  if (categoria && meses.some((m) => m.soldo === null)) pendencias.push("Há meses sem soldo na tabela (a tabela começa em 2018).");
  for (const m of meses.filter((x) => x.soldo !== null && soldos.get(k(x.ano, x.mes)) && soldos.get(k(x.ano, x.mes)) !== x.soldo && x.dias === x.diasMes)) {
    alertas.push({ codigo: "SOLDO_FICHA", descricao: `Em ${mmm(m.ano, m.mes)}, a NR0001 da ficha (R$ ${reais(soldos.get(k(m.ano, m.mes))!)}) é diferente do soldo da tabela (R$ ${reais(m.soldo!)}): confira o posto e as promoções.` });
    break;
  }
  if (meses.length && meses.every((m) => m.diferenca !== null && m.diferenca <= 0.005)) alertas.push({ codigo: "SEM_DIFERENCA", descricao: "O adicional pago na ficha já cobre o devido em todos os meses: não há diferença." });

  // reflexos
  const diferencaCheia = (ano: number, mes: number) => {
    const dia = `${ano}-${dd(mes)}-${dd(diasNoMes(ano, mes))}`;
    const soldo = soldoNaData(postoNoDia(dia), dia);
    return tipo && soldo !== null ? centavos((soldo * percentualAH(tipo, dia)) / 100 - (ahFicha.get(k(ano, mes)) ?? 0)) : 0;
  };
  const natalino: PlanoAdicHab["natalino"] = [];
  if (dados.natalino !== false) {
    for (let ano = +inicio.slice(0, 4); ano <= +fim.slice(0, 4); ano++) {
      // dezembro dentro do período (o 13º é pela remuneração de dezembro)
      if (k(ano, 12) < ini || k(ano, 12) > fi) continue;
      const diferenca = diferencaCheia(ano, 12);
      if (diferenca <= 0) continue;
      const avosSugeridos = Array.from({ length: 12 }, (_, i) => soldos.get(k(ano, i + 1)) ?? 0).filter((v) => v > 0).length || 12;
      const avos = dados.avosNatal?.[String(ano)] ?? avosSugeridos;
      natalino.push({ ano, diferenca, avos, avosSugeridos, valor: centavos((diferenca * avos) / 12) });
    }
  }
  const feriasFicha = valoresPorMes(fichas, CODIGOS_FERIAS);
  const mesesFeriasFicha = [...feriasFicha.keys()].filter((m) => m >= ini && m <= fi).sort((a, b) => a - b)
    .map((m) => `${Math.floor((m - 1) / 12)}-${((m - 1) % 12) + 1}`);
  const ferias: PlanoAdicHab["ferias"] = [];
  if (dados.ferias !== false) {
    for (const chave of dados.mesesFerias?.length ? dados.mesesFerias : mesesFeriasFicha) {
      const [a, m] = chave.split("-").map(Number) as [number, number];
      const dif = diferencaCheia(a, m);
      if (dif > 0) ferias.push({ ano: a, mes: m, valor: centavos(dif / 3) });
    }
  }
  if (dados.ferias !== false && !dados.mesesFerias?.length) {
    const antes = [...feriasFicha.keys()].filter((m) => m < ini && m >= ini - 2);
    if (antes.length) pendencias.push(`A ficha mostra adicional de férias em ${antes.map((m) => mmm(Math.floor((m - 1) / 12), ((m - 1) % 12) + 1)).join(", ")}, pouco antes do início: se as férias são do período da dívida, inclua o mês no quadro.`);
  }

  // devidos e recebidos por rubrica
  const devidos: PlanoAdicHab["devidos"] = { [RUBRICA_ADIC_HAB]: meses.filter((m) => m.devido !== null).map((m) => ({ ano: m.ano, mes: m.mes, valor: m.devido! })) };
  const recebidos: PlanoAdicHab["recebidos"] = { [RUBRICA_ADIC_HAB]: meses.filter((m) => m.recebido > 0).map((m) => ({ ano: m.ano, mes: m.mes, valor: m.recebido })) };
  if (natalino.length) devidos[RUBRICA_NATAL] = natalino.map((n) => ({ ano: n.ano, mes: 12, valor: n.valor }));
  if (ferias.length) devidos[RUBRICA_FERIAS] = ferias.map((f) => ({ ...f }));
  let descontos = 0;
  if (dados.descontos !== false) {
    const pensao = [7.5, 9.5, 10.5].includes(dados.pensao ?? NaN) ? dados.pensao! : 10.5;
    const base = meses.filter((m) => (m.diferenca ?? 0) > 0);
    const z = (pct: number) => base.map((m) => ({ ano: m.ano, mes: m.mes, valor: centavos((m.diferenca! * pct) / 100) })).filter((v) => v.valor > 0);
    devidos[RUBRICA_FUSEX] = z(3);
    devidos[RUBRICA_PMIL] = z(pensao);
    if (dados.pensao15) devidos[RUBRICA_PMIL_15] = z(1.5);
    if (dados.fusexDependentes === 0.4 || dados.fusexDependentes === 0.5) devidos[RUBRICA_FUSEX_DEP] = z(dados.fusexDependentes);
    descontos = centavos([RUBRICA_FUSEX, RUBRICA_PMIL, RUBRICA_PMIL_15, RUBRICA_FUSEX_DEP].flatMap((r) => devidos[r] ?? []).reduce((s, v) => s + v.valor, 0));
    if (dados.pensao === undefined) pendencias.push("Confira a Pensão Militar do militar (10,5% foi o padrão; 7,5% ou 9,5% conforme a opção dele, e +1,5% se contribui) e o Fusex: 3%, mais 0,4% ou 0,5% se tiver dependentes além do cônjuge (Portaria C Ex nº 863/2005).");
  }

  // alertas
  if (tipo && dados.percentualPedido && meses.some((m) => m.dias > 0 && m.percentual < dados.percentualPedido!)) {
    const menores = meses.filter((m) => m.dias > 0 && m.percentual < dados.percentualPedido!);
    alertas.push({ codigo: "PERCENTUAL_PEDIDO", descricao: `O requerimento pede ${dados.percentualPedido}%, mas pela Lei 13.954/2019 (Anexo III) o ${TABELA_AH[tipo].nome} era de ${[...new Set(menores.map((m) => m.percentual))].join("%, ")}% de ${mmm(menores[0]!.ano, menores[0]!.mes)} a ${mmm(menores.at(-1)!.ano, menores.at(-1)!.mes)}. O cálculo segue a tabela da lei.` });
  }
  const atrasados = valoresPorMes(fichas, CODIGOS_AH_ATRASADO);
  for (const [m, v] of [...atrasados].filter(([m]) => m >= ini)) {
    alertas.push({ codigo: "POSSIVEL_DUPLICIDADE", descricao: `Adicional de habilitação atrasado (AR/ER0003 ou A23) de R$ ${reais(v)} em ${mmm(Math.floor((m - 1) / 12), ((m - 1) % 12) + 1)}: pode ser o pagamento desta diferença. Confira.` });
  }
  for (let ano = +inicio.slice(0, 4); ano <= +fim.slice(0, 4); ano++) {
    if (!fichas.some((f) => f.ano === ano)) alertas.push({ codigo: "FICHA_AUSENTE", descricao: `Falta a ficha financeira de ${ano}: o recebido daquele ano fica zerado.` });
  }
  if (+fim.slice(0, 4) >= +hoje.slice(0, 4)) alertas.push({ codigo: "NAO_E_DEA", descricao: `O período chega ao exercício corrente (${hoje.slice(0, 4)}): o que for deste ano é pago em folha, não por DEA.` });
  const referencia = entrada.dataRequerimento && /^\d{4}-\d{2}-\d{2}$/.test(entrada.dataRequerimento) ? entrada.dataRequerimento : hoje;
  const limite = `${+referencia.slice(0, 4) - 5}${referencia.slice(4, 10)}`;
  if (inicio < limite) alertas.push({ codigo: "PRESCRICAO", descricao: `Parte do período é anterior a ${br(limite)} (5 anos antes de ${br(referencia)}${entrada.dataRequerimento ? ", data do requerimento" : ""}): verifique a prescrição.` });
  if (entrada.dataRequerimento && entrada.dataRequerimento < inicio) alertas.push({ codigo: "DATA_REQUERIMENTO", descricao: `A data do requerimento (${br(entrada.dataRequerimento)}) é anterior à conclusão do curso (${br(inicio)}): confira (pode ser erro de digitação no ano).` });
  if (!dados.documento?.trim()) pendencias.push("Informe o ato que materializa o direito (ex.: Adt DCEM ao Bol DGP da conclusão do curso, ou o BI).");

  // notas e textos
  const notas: Record<string, string> = {};
  for (const m of meses.filter((x) => x.devido !== null)) {
    notas[`${m.ano}-${m.mes}`] = `Adicional de habilitação (${tipo ? TABELA_AH[tipo].nome : "?"}): ${m.percentual}% × R$ ${reais(m.soldo ?? 0)}${m.dias === m.diasMes ? " (mês cheio)" : ` (${m.dias}/${m.diasMes} dias no novo percentual)`} = R$ ${reais(m.devido!)}; pago na ficha R$ ${reais(m.recebido)}; diferença R$ ${reais(m.diferenca!)}.`
      + (natalino.find((n) => n.ano === m.ano && m.mes === 12) ? ` Natalino: R$ ${reais(natalino.find((n) => n.ano === m.ano)!.valor)}.` : "")
      + (ferias.find((f) => f.ano === m.ano && f.mes === m.mes) ? ` Férias (1/3): R$ ${reais(ferias.find((f) => f.ano === m.ano && f.mes === m.mes)!.valor)}.` : "");
  }
  const totais = {
    a03: centavos(meses.reduce((s, m) => s + Math.max(0, m.diferenca ?? 0), 0)),
    natal: centavos(natalino.reduce((s, n) => s + n.valor, 0)), ferias: centavos(ferias.reduce((s, f) => s + f.valor, 0)), descontos,
  };
  const explicacao = tipo
    ? `O militar concluiu com aproveitamento ${dados.curso?.trim() ? `o ${dados.curso.trim()}` : "o curso"} em ${br(inicio)}, que lhe conferiu o adicional de habilitação de ${TABELA_AH[tipo].nome} (Lei nº 13.954/2019, Anexo III; Portaria C Ex nº 1.443/2021), não pago à época no período de ${br(inicio)} a ${br(fim)}; a diferença, devida a exercício anterior, é paga como DEA.`
    : null;
  const documentos = [dados.documento?.trim().slice(0, 100), entrada.averbacao?.trim().slice(0, 100)].filter((d): d is string => !!d);
  return { tipo, categoria, categoriaSugerida, meses, devidos, recebidos, natalino, ferias, mesesFeriasFicha, totais, notas, alertas, pendencias, textos: { explicacao, documentos } };
}

interface Rubrica { posicao: number; codigo: string; tipo: string }
const ULTIMA_RECEITA = 12;

/**
 * Rubricas do adicional: as receitas (A03, A85, AD2) na que já houver ou na 1ª receita vazia; as despesas (Z01, Z02) na
 * que já houver ou na 1ª despesa vazia. Devolve as mudanças e a posição de cada código.
 */
export function rubricasAdicHab(rubricas: Rubrica[], codigos: string[]) {
  const lista = rubricas.map((r) => ({ ...r, codigo: r.codigo ?? "" }));
  const mudadas: Rubrica[] = [];
  const posicoes: Record<string, number> = {};
  for (const codigo of codigos) {
    const despesa = codigo.startsWith("Z");
    const existente = lista.find((r) => r.codigo.trim().toUpperCase() === codigo.toUpperCase());
    if (existente) { posicoes[codigo] = existente.posicao; continue; }
    const vazia = lista.find((r) => !r.codigo.trim() && (despesa ? r.posicao > ULTIMA_RECEITA : r.posicao <= ULTIMA_RECEITA));
    if (!vazia) continue;
    vazia.codigo = codigo;
    vazia.tipo = despesa ? "Despesa" : "Receita";
    mudadas.push({ ...vazia });
    posicoes[codigo] = vazia.posicao;
  }
  return { mudadas, posicoes };
}
