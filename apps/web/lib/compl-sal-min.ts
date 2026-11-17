/**
 * Cálculo automático do "Complemento de salário mínimo" (decisão de 17/11/2026).
 *
 * Vale só para os processos criados a partir de 17/11/2026 (complementos.calculoAutomatico): rascunhos e emitidos
 * anteriores não mudam. Com a espécie "Complemento de salário mínimo", a partir das fichas guardadas (fichas_lidas):
 * - Códigos lançamento: "AGA - COMPL SAL MIN" (Receita) na posição 1 e, se houver Gratificação de Representação
 *   Eventual no período, "AR0061 - GRAT REPRESENT EVENTUAL" logo à direita, como neutra ("-"): ela aparece, mas já
 *   está abatida no devido do mês (como Receita seria descontada duas vezes).
 * - Recebidos: AGA (AR0026 no SIPPES) mês a mês no período; o recebido depois do fim do período vai para "recebido
 *   após o período" (e é descontado do total); o de antes do início é desconsiderado. A gratificação, só no período.
 * - Devidos: valor fixado do ano (R$ 80,10 em 2022 e R$ 170,10 em 2023; não há complemento nos outros anos) menos a
 *   gratificação do mês; com a gratificação igual ou maior que o valor fixado, o mês não é computado.
 */
import type { MesAno } from "./lancamentos";
import type { FichaLida } from "./receitas";

export const ESPECIE_COMPL_SAL_MIN = "Complemento de salário mínimo";
export const RUBRICA_AGA = "AGA - COMPL SAL MIN";
export const RUBRICA_GR = "AR0061 - GRAT REPRESENT EVENTUAL";
/** Valor do complemento por mês, por ano. */
export const VALOR_FIXADO: Readonly<Record<number, number>> = { 2022: 80.1, 2023: 170.1 };

/** Linhas da ficha: AR0026 / COMPLEMENTO SALARIO MINIMO (SIPPES) ou AGA (SIAPPES); AR0061 / GRAT REPRESENT EVENTUAL. */
const CODIGOS_AGA = new Set(["AR0026", "AGA"]);
const CODIGOS_GR = new Set(["AR0061"]);
/** Todos os códigos usados pela automação (a prévia das fichas não os lista como "não usados"). */
export const CODIGOS_COMPL_SAL_MIN = new Set([...CODIGOS_AGA, ...CODIGOS_GR]);

export interface ValorMes { ano: number; mes: number; valor: number }
export interface PlanoComplSalMin {
  /** AGA recebido dentro do período. */
  aga: ValorMes[];
  /** Gratificação de representação recebida dentro do período. */
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

export function planoComplSalMin(fichas: FichaLida[], inicio: MesAno, fim: MesAno): PlanoComplSalMin {
  const ini = k(inicio.ano, inicio.mes), fi = k(fim.ano, fim.mes);
  const noPeriodo = (v: ValorMes) => k(v.ano, v.mes) >= ini && k(v.ano, v.mes) <= fi;
  const todosAga = valoresDasFichas(fichas, CODIGOS_AGA);
  const gr = valoresDasFichas(fichas, CODIGOS_GR).filter(noPeriodo);
  const grDoMes = new Map(gr.map((v) => [k(v.ano, v.mes), v.valor]));
  const devidos: ValorMes[] = [];
  const notas: Record<string, string> = {};
  for (let c = ini; c <= fi; c++) {
    const ano = Math.floor((c - 1) / 12), mes = c - ano * 12;
    const fixado = VALOR_FIXADO[ano];
    if (fixado === undefined) continue;
    const g = grDoMes.get(c) ?? 0;
    if (g >= fixado) {
      notas[`${ano}-${mes}`] = `Mês não computado: a AR0061 / GRAT REPRESENT EVENTUAL recebida (R$ ${reais(g)}) é igual ou maior que o valor fixado do complemento (R$ ${reais(fixado)}).`;
      continue;
    }
    const valor = centavos(fixado - g);
    if (g > 0) notas[`${ano}-${mes}`] = `Abatido R$ ${reais(g)} referente à AR0061 / GRAT REPRESENT EVENTUAL: R$ ${reais(fixado)} − R$ ${reais(g)} = R$ ${reais(valor)}.`;
    devidos.push({ ano, mes, valor });
  }
  return { aga: todosAga.filter(noPeriodo), gr, posPeriodo: todosAga.filter((v) => k(v.ano, v.mes) > fi && v.valor > 0), devidos, notas };
}

interface Rubrica { posicao: number; codigo: string; tipo: string }
const ULTIMA_RECEITA = 12;
const ehAga = (r: Rubrica) => r.codigo.trim().toUpperCase().startsWith("AGA ");
const ehGr = (r: Rubrica) => r.codigo.trim().toUpperCase().startsWith("AR0061");

/**
 * Rubricas que precisam mudar: AGA (Receita) na posição 1 (ou na 1ª receita vazia) e, com gratificação no período,
 * AR0061 neutra logo à direita da AGA (ou na próxima vazia). Devolve as alteradas e as posições de cada uma.
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
  if (gr) marcar(gr, gr.codigo, "-");
  else if (temGr) {
    gr = vazia(aga?.posicao ?? 0);
    if (gr) marcar(gr, RUBRICA_GR, "-");
  }
  return { mudadas, posicaoAga: aga?.posicao ?? null, posicaoGr: gr?.posicao ?? null };
}
