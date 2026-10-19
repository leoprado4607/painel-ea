/**
 * Leitura da Ficha Financeira do SIPPES (CPEx) a partir das palavras do PDF e suas posições.
 * Código puro: recebe as palavras já extraídas (ver pdf.ts) e devolve cabeçalho, linhas e conferências.
 */

export interface Palavra {
  texto: string;
  /** coordenadas em pontos, origem no canto superior esquerdo da página */
  x: number;
  y: number;
  largura: number;
  pagina: number;
  /** tamanho da fonte em pontos (marcas d'água costumam ser bem maiores que o texto) */
  tamanho?: number;
  /** texto girado ou inclinado (marca d'água) */
  inclinada?: boolean;
}

export interface LinhaFicha {
  /** Ex.: NR0001 */
  codigo: string;
  /** NR/AR = receita; ND/AD = desconto. */
  natureza: "receita" | "desconto";
  /** AR/AD: acertos (valores de outros períodos lançados no mês). */
  acerto: boolean;
  descricao: string;
  /** 12 valores, jan…dez */
  meses: number[];
  total: number;
}

export interface FichaFinanceira {
  ano: number | null;
  cabecalho: {
    posto: string | null; nome: string | null; precCp: string | null; identidade: string | null;
    cpf: string | null; codom: string | null; rm: string | null; siglaUa: string | null;
  };
  linhas: LinhaFicha[];
  /** Linha "TOTAIS LÍQUIDOS" (12 meses), se encontrada. */
  totaisLiquidos: number[] | null;
  conferencias: {
    /** Códigos cuja soma dos 12 meses não bate com o total impresso. */
    linhasDivergentes: string[];
    /** Meses (1–12) em que receitas − descontos não bate com "TOTAIS LÍQUIDOS". */
    mesesDivergentes: number[];
    ok: boolean;
  };
  avisos: string[];
}

const CODIGO = /^(NR|ND|AR|AD)\d{4}$/;
const VALOR = /^-?\d{1,3}(\.\d{3})*,\d{2}$/;
const TOLERANCIA_LINHA = 2.5;

export const lerValor = (t: string): number => Number(t.replace(/\./g, "").replace(",", "."));
const centavos = (v: number) => Math.round(v * 100);

interface Linha { pagina: number; y: number; palavras: Palavra[]; texto: string }

/** Agrupa palavras em linhas (mesma página e altura parecida), em ordem de leitura. */
export function agruparLinhas(palavras: Palavra[]): Linha[] {
  const ordenadas = [...palavras].sort((a, b) => a.pagina - b.pagina || a.y - b.y || a.x - b.x);
  const linhas: Linha[] = [];
  for (const p of ordenadas) {
    const ultima = linhas[linhas.length - 1];
    if (ultima && ultima.pagina === p.pagina && Math.abs(ultima.y - p.y) <= TOLERANCIA_LINHA) ultima.palavras.push(p);
    else linhas.push({ pagina: p.pagina, y: p.y, palavras: [p], texto: "" });
  }
  for (const l of linhas) {
    l.palavras.sort((a, b) => a.x - b.x);
    l.texto = l.palavras.map((p) => p.texto).join(" ");
  }
  return linhas;
}

function lerCabecalho(linhas: Linha[]): FichaFinanceira["cabecalho"] & { ano: number | null } {
  const buscar = (re: RegExp) => {
    for (const l of linhas) {
      const m = re.exec(l.texto);
      if (m) return m;
    }
    return null;
  };
  const nome = buscar(/^(.*?)\s*NOME:\s*(.+?)\s*$/);
  return {
    ano: Number(buscar(/\bAno\s+(\d{4})\b/)?.[1]) || null,
    posto: nome?.[1]?.trim() || null,
    nome: nome?.[2]?.trim() || null,
    precCp: buscar(/PREC\/CP:\s*(\d+)/)?.[1] ?? null,
    identidade: buscar(/IDENTIDADE:\s*(\d+)/)?.[1] ?? null,
    cpf: buscar(/\bCPF:\s*(\d+)/)?.[1] ?? null,
    codom: buscar(/CODOM:\s*(\d+)/)?.[1] ?? null,
    rm: buscar(/\bRM:\s*(\d+)/)?.[1] ?? null,
    siglaUa: buscar(/SIGLA UA:\s*(.+?)\s*$/)?.[1] ?? null,
  };
}

export function lerFicha(palavras: Palavra[]): FichaFinanceira {
  const avisos: string[] = [];
  const linhas = agruparLinhas(palavras);
  const { ano, ...cabecalho } = lerCabecalho(linhas);

  // Coluna "Jan" do cabeçalho da tabela: à esquerda dela ficam código e descrição.
  let xJan: number | null = null;
  const resultado: LinhaFicha[] = [];
  let totaisLiquidos: number[] | null = null;

  const paginas = [...new Set(linhas.map((l) => l.pagina))];
  for (const pg of paginas) {
    const daPagina = linhas.filter((l) => l.pagina === pg);
    const iCab = daPagina.findIndex((l) => /C[óo]digo/.test(l.texto) && /\bJan\b/.test(l.texto) && /Total/.test(l.texto));
    if (iCab >= 0) xJan = daPagina[iCab]!.palavras.find((p) => p.texto === "Jan")!.x;
    if (xJan === null) continue;
    const corpo = daPagina.slice(iCab + 1);
    const iTot = corpo.findIndex((l) => /TOTAIS/.test(l.texto));
    const tabela = iTot >= 0 ? corpo.slice(0, iTot) : corpo;

    // Classifica as linhas: com código, ou só continuação de descrição.
    type Item = { tipo: "codigo"; linha: Linha } | { tipo: "descricao"; texto: string };
    const itens: Item[] = [];
    for (const l of tabela) {
      if (CODIGO.test(l.palavras[0]?.texto ?? "")) itens.push({ tipo: "codigo", linha: l });
      else {
        const texto = l.palavras.filter((p) => p.x < xJan! - 2).map((p) => p.texto).join(" ").trim();
        if (texto) itens.push({ tipo: "descricao", texto });
      }
    }

    // A descrição de cada linha fica centralizada na altura do código: k linhas acima e k abaixo.
    // Entre dois códigos há (abaixo do 1º + acima do 2º) linhas; resolvendo em sequência, cada uma vai para o seu código.
    const codigos = itens.map((it, i) => (it.tipo === "codigo" ? i : -1)).filter((i) => i >= 0);
    const acima: string[][] = codigos.map(() => []);
    const abaixo: string[][] = codigos.map(() => []);
    let k = codigos[0] ?? 0; // linhas de descrição antes do 1º código
    codigos.forEach((ic, n) => {
      const antes = itens.slice(n === 0 ? 0 : codigos[n - 1]! + 1, ic).map((it) => (it as { texto: string }).texto);
      if (n > 0) {
        const doAnterior = Math.min(k, antes.length);
        abaixo[n - 1] = antes.slice(0, doAnterior);
        acima[n] = antes.slice(doAnterior);
        if (antes.length - doAnterior < 0) avisos.push(`descrição ambígua perto de ${codigoDe(itens[ic])}`);
      } else acima[n] = antes;
      k = acima[n]!.length;
    });
    if (codigos.length) {
      const resto = itens.slice(codigos[codigos.length - 1]! + 1).map((it) => (it as { texto: string }).texto);
      abaixo[codigos.length - 1] = resto;
      if (resto.length !== k) avisos.push(`descrição da última linha da página ${pg} com ${resto.length} linha(s) abaixo e ${k} acima`);
    }

    codigos.forEach((ic, n) => {
      const l = (itens[ic] as { linha: Linha }).linha;
      const codigo = l.palavras[0]!.texto;
      const valores = l.palavras.filter((p) => VALOR.test(p.texto) && p.x >= xJan! - 30);
      const naLinha = l.palavras.slice(1).filter((p) => !valores.includes(p)).map((p) => p.texto).join(" ");
      const descricao = [...acima[n]!, naLinha, ...abaixo[n]!].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
      if (valores.length !== 13) {
        avisos.push(`${codigo}: esperava 12 meses + total, encontrei ${valores.length} valores`);
        return;
      }
      const nums = valores.map((p) => lerValor(p.texto));
      resultado.push({
        codigo, descricao,
        natureza: codigo.startsWith("NR") || codigo.startsWith("AR") ? "receita" : "desconto",
        acerto: codigo.startsWith("A"),
        meses: nums.slice(0, 12),
        total: nums[12]!,
      });
    });

    if (iTot >= 0) {
      const v = corpo[iTot]!.palavras.filter((p) => VALOR.test(p.texto)).map((p) => lerValor(p.texto));
      if (v.length >= 12) totaisLiquidos = v.slice(0, 12);
      else avisos.push("linha TOTAIS LÍQUIDOS incompleta");
    }
  }

  if (xJan === null) avisos.push("tabela não encontrada (cabeçalho Código/Descrição/Jan…Total)");

  const linhasDivergentes = resultado
    .filter((l) => centavos(l.meses.reduce((a, b) => a + b, 0)) !== centavos(l.total))
    .map((l) => l.codigo);
  const mesesDivergentes: number[] = [];
  if (totaisLiquidos) {
    for (let m = 0; m < 12; m++) {
      const liq = resultado.reduce((s, l) => s + (l.natureza === "receita" ? 1 : -1) * centavos(l.meses[m]!), 0);
      if (liq !== centavos(totaisLiquidos[m]!)) mesesDivergentes.push(m + 1);
    }
  } else avisos.push("sem linha TOTAIS LÍQUIDOS para conferir");

  return {
    ano, cabecalho, linhas: resultado, totaisLiquidos,
    conferencias: { linhasDivergentes, mesesDivergentes, ok: linhasDivergentes.length === 0 && mesesDivergentes.length === 0 && !!totaisLiquidos },
    avisos,
  };
}

function codigoDe(it: unknown): string {
  return (it as { linha?: Linha }).linha?.palavras[0]?.texto ?? "?";
}
