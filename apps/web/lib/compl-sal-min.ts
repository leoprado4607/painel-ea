/**
 * Cálculo automático do "Complemento de salário mínimo" (decisão de 17/11/2026).
 *
 * Vale só para os processos criados a partir de 17/11/2026 (complementos.calculoAutomatico): rascunhos e emitidos
 * anteriores não mudam. Com a espécie "Complemento de salário mínimo", a partir das fichas guardadas (fichas_lidas):
 * - Códigos lançamento: "AGA - COMPL SAL MIN" (Receita) na posição 1 e, se houver Gratificação de Representação
 *   Eventual no período, "AR0061 - GRAT REPRESENT EVENTUAL" logo à direita, sempre como Receita (decisão de
 *   17/11/2026): o cálculo a desconta do mês. Em "Lançar valor devido" o campo dela não aparece (nada é devido nela).
 * - Recebidos: AGA (AR0026 no SIPPES) mês a mês no período; o recebido depois do fim do período vai para "recebido
 *   após o período" (e é descontado do total); o de antes do início é desconsiderado. A gratificação, só no período.
 * - Devidos (AGA): valor fixado do ano, cheio (R$ 80,10 em 2022 e R$ 170,10 em 2023; não há complemento nos outros
 *   anos); a gratificação recebida (Receita) é descontada no cálculo. Com a gratificação igual ou maior que o valor
 *   fixado, o mês não é computado: nem o devido nem a gratificação são lançados (o mês fica zerado, sem ficar negativo).
 * - Mês de início ou de fim incompleto (ex.: dívida a partir de 15/02/2022): valor fixado ÷ dias do mês no calendário
 *   × dias do mês dentro do período; a gratificação é comparada com esse valor proporcional.
 */
import type { FichaLida } from "./receitas";

export const ESPECIE_COMPL_SAL_MIN = "Complemento de salário mínimo";
export const RUBRICA_AGA = "AGA - COMPL SAL MIN";
export const RUBRICA_GR = "AR0061 - GRAT REPRESENT EVENTUAL";
/** Valor do complemento por mês, por ano. */
export const VALOR_FIXADO: Readonly<Record<number, number>> = { 2022: 80.1, 2023: 170.1 };

/**
 * Verso do complemento de salário mínimo (decisão de 26/11/2026), pela espécie: o 2º documento que materializa o direito
 * é sempre este, e a explicação do não pagamento é automática (ano do requerimento e período da dívida), salvo se o
 * operador a editar em Informações (complementos.explicacaoEditada).
 */
export const DOCUMENTO_COMPL_SAL_MIN = "DIEx Nº 257-ASSEJUR/SSEF/SEF, de 28 ABR 23 - Base de Cálculo - Complemento de Salário Mínimo";
const MESES_MILITAR = ["JAN", "FEV", "MAR", "ABR", "MAIO", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
const data = (v: string | null | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
/** "2022-03-01" → "1º MAR 22". */
const dataMilitar = (d: string) => `${d.slice(8, 10) === "01" ? "1º" : d.slice(8, 10)} ${MESES_MILITAR[+d.slice(5, 7) - 1]} ${d.slice(2, 4)}`;

export function explicacaoComplSalMin(dataRequerimento: string | null | undefined, inicio: string | null | undefined, fim: string | null | undefined): string {
  const req = data(dataRequerimento), ini = data(inicio), f = data(fim);
  const ano = req ? req.slice(0, 4) : "(ano do requerimento)";
  const periodo = ini && f ? `${dataMilitar(ini)} a ${dataMilitar(f)}` : "(período da dívida)";
  return `O ex-militar em tela solicitou em ${ano} os valores referentes a diferença entre a remuneração recebida no período de ${periodo} `
    + "e o valor dos novos salários-mínimos estabelecidos a partir de 2022, em concordância com DIEx Nº 257-ASSEJUR/SSEF/SEF, de 28 ABR 23, "
    + "com o DIEx Nº 152-SIPPES/S1/Gab, de 15 MAIO 23, e com a MP nº 2215-10, de 31 de agosto de 2001 (LRM), que pacificam o entendimento "
    + "que todo militar que receber remuneração inferior ao salário mínimo fará jus a um complemento em valor equivalente à diferença encontrada.";
}

/** Documentos do verso com o do complemento fixo na 2ª posição (sem repetir, se o operador o tiver digitado). */
export function documentosComplSalMin(documentos: string[]): string[] {
  const fixo = DOCUMENTO_COMPL_SAL_MIN.toLocaleLowerCase("pt-BR");
  const proprios = documentos.filter((d) => d.replace(/<[^>]+>/g, "").trim().toLocaleLowerCase("pt-BR") !== fixo);
  return [...proprios.slice(0, 1), DOCUMENTO_COMPL_SAL_MIN, ...proprios.slice(1)];
}

/** Linhas da ficha: AR0026 / COMPLEMENTO SALARIO MINIMO (SIPPES) ou AGA (SIAPPES); AR0061 / GRAT REPRESENT EVENTUAL. */
const CODIGOS_AGA = new Set(["AR0026", "AGA"]);
const CODIGOS_GR = new Set(["AR0061"]);
/** Todos os códigos usados pela automação (a prévia das fichas não os lista como "não usados"). */
export const CODIGOS_COMPL_SAL_MIN = new Set([...CODIGOS_AGA, ...CODIGOS_GR]);

export interface ValorMes { ano: number; mes: number; valor: number }
export interface PlanoComplSalMin {
  /** AGA recebido dentro do período. */
  aga: ValorMes[];
  /** Gratificação de representação recebida dentro do período (sem os meses não computados). */
  gr: ValorMes[];
  /** AGA recebido depois do fim do período. */
  posPeriodo: ValorMes[];
  /** Devido do complemento, mês a mês (meses não computados ficam de fora). */
  devidos: ValorMes[];
  /** Observação do card do mês ("2022-5"), quando houve abatimento da gratificação. */
  notas: Record<string, string>;
}

const k = (ano: number, mes: number) => ano * 12 + mes;
const centavos = (v: number) => Math.round(v * 100) / 100;
const reais = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** O processo segue a automação: criado depois da mudança e com a espécie do complemento. */
export function complSalMinAutomatico(p: { especie_divida?: string | null; complementos?: unknown }): boolean {
  const c = p.complementos as { calculoAutomatico?: unknown } | null | undefined;
  return p.especie_divida === ESPECIE_COMPL_SAL_MIN && c?.calculoAutomatico === true;
}

/** Soma, mês a mês, as linhas das fichas com um dos códigos. */
function valoresDasFichas(fichas: FichaLida[], codigos: Set<string>): ValorMes[] {
  const soma = new Map<number, ValorMes>();
  for (const f of fichas)
    for (const l of f.linhas) {
      if (!codigos.has(l.codigo.trim().toUpperCase())) continue;
      l.meses.forEach((v, i) => {
        if (!v) return;
        const atual = soma.get(k(f.ano, i + 1)) ?? { ano: f.ano, mes: i + 1, valor: 0 };
        atual.valor = centavos(atual.valor + v);
        soma.set(k(f.ano, i + 1), atual);
      });
    }
  return [...soma.values()].filter((v) => v.valor !== 0).sort((a, b) => k(a.ano, a.mes) - k(b.ano, b.mes));
}

const diasDoMes = (ano: number, mes: number) => new Date(Date.UTC(ano, mes, 0)).getUTCDate();
/** "2022-02-15" → { ano, mes, dia } */
const lerData = (d: string) => ({ ano: Number(d.slice(0, 4)), mes: Number(d.slice(5, 7)), dia: Number(d.slice(8, 10)) || 1 });

/** @param inicio e fim do período da dívida, "AAAA-MM-DD" (o dia define a proporção do 1º e do último mês) */
export function planoComplSalMin(fichas: FichaLida[], inicio: string, fim: string): PlanoComplSalMin {
  const di = lerData(inicio), df = lerData(fim);
  const ini = k(di.ano, di.mes), fi = k(df.ano, df.mes);
  const noPeriodo = (v: ValorMes) => k(v.ano, v.mes) >= ini && k(v.ano, v.mes) <= fi;
  const todosAga = valoresDasFichas(fichas, CODIGOS_AGA);
  const grPeriodo = valoresDasFichas(fichas, CODIGOS_GR).filter(noPeriodo);
  const grDoMes = new Map(grPeriodo.map((v) => [k(v.ano, v.mes), v.valor]));
  const devidos: ValorMes[] = [];
  const notas: Record<string, string> = {};
  for (let c = ini; c <= fi; c++) {
    const ano = Math.floor((c - 1) / 12), mes = c - ano * 12;
    const cheio = VALOR_FIXADO[ano];
    if (cheio === undefined) continue;
    // dias do mês dentro do período (início e fim incompletos ficam proporcionais)
    const total = diasDoMes(ano, mes);
    const primeiro = c === ini ? Math.min(di.dia, total) : 1, ultimo = c === fi ? Math.min(df.dia, total) : total;
    const dias = ultimo - primeiro + 1;
    if (dias <= 0) continue;
    const fixado = dias === total ? cheio : centavos((cheio / total) * dias);
    const textos: string[] = [];
    if (dias !== total) textos.push(`Valor proporcional: R$ ${reais(cheio)} ÷ ${total} dias × ${dias} dia(s) no período = R$ ${reais(fixado)}.`);
    const g = grDoMes.get(c) ?? 0;
    if (g >= fixado) {
      textos.push(`Mês não computado: a AR0061 / GRAT REPRESENT EVENTUAL recebida (R$ ${reais(g)}) é igual ou maior que o valor ${dias !== total ? "proporcional" : "fixado"} do complemento (R$ ${reais(fixado)}); o devido e a AR0061 deste mês não são lançados.`);
      notas[`${ano}-${mes}`] = textos.join(" ");
      continue;
    }
    if (g > 0) textos.push(`Abatida a AR0061 / GRAT REPRESENT EVENTUAL recebida (Receita): R$ ${reais(fixado)} − R$ ${reais(g)} = R$ ${reais(centavos(fixado - g))}.`);
    if (textos.length) notas[`${ano}-${mes}`] = textos.join(" ");
    devidos.push({ ano, mes, valor: fixado });
  }
  // a gratificação só é lançada nos meses com complemento devido: fora de 2022/2023 (sem valor fixado) ou nos meses
  // não computados, ela deixaria o mês negativo e reduziria o total
  const comDevido = new Set(devidos.map((d) => k(d.ano, d.mes)));
  const gr = grPeriodo.filter((v) => comDevido.has(k(v.ano, v.mes)));
  return { aga: todosAga.filter(noPeriodo), gr, posPeriodo: todosAga.filter((v) => k(v.ano, v.mes) > fi && v.valor > 0), devidos, notas };
}

interface Rubrica { posicao: number; codigo: string; tipo: string }
const ULTIMA_RECEITA = 6;
const ehAga = (r: Rubrica) => r.codigo.trim().toUpperCase().startsWith("AGA ");
/** AR0061 / GRAT REPRESENT EVENTUAL: sempre Receita e sem campo em "Lançar valor devido". */
export const ehRubricaGr = (codigo: string | null | undefined) => (codigo ?? "").trim().toUpperCase().startsWith("AR0061");
const ehGr = (r: Rubrica) => r.codigo.trim().toUpperCase().startsWith("AR0061");

/**
 * Rubricas que precisam mudar: AGA (Receita) na posição 1 (ou na 1ª receita vazia) e, com gratificação no período,
 * AR0061 (Receita) logo à direita da AGA (ou na próxima vazia). Devolve as alteradas e as posições de cada uma.
 */
export function rubricasComplSalMin(rubricas: Rubrica[], temGr: boolean) {
  const lista = rubricas.map((r) => ({ ...r, codigo: r.codigo ?? "" }));
  const mudadas: Rubrica[] = [];
  const vazia = (depois = 0) => lista.find((r) => r.posicao > depois && r.posicao <= ULTIMA_RECEITA && !r.codigo.trim())
    ?? lista.find((r) => r.posicao <= ULTIMA_RECEITA && !r.codigo.trim());
  const marcar = (r: Rubrica, codigo: string, tipo: string) => {
    if (r.codigo === codigo && r.tipo === tipo) return;
    r.codigo = codigo; r.tipo = tipo;
    mudadas.push({ ...r });
  };
  let aga = lista.find(ehAga);
  if (aga) marcar(aga, aga.codigo, "Receita");
  else {
    aga = lista.find((r) => r.posicao === 1 && !r.codigo.trim()) ?? vazia();
    if (aga) marcar(aga, RUBRICA_AGA, "Receita");
  }
  let gr = lista.find(ehGr);
  if (gr) marcar(gr, gr.codigo, "Receita");
  else if (temGr) {
    gr = vazia(aga?.posicao ?? 0);
    if (gr) marcar(gr, RUBRICA_GR, "Receita");
  }
  return { mudadas, posicaoAga: aga?.posicao ?? null, posicaoGr: gr?.posicao ?? null };
}
