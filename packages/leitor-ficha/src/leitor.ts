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
  /** 2ª letra: R = receita, D = desconto; com 1ª letra D (devolução) se inverte: DD = devolução de desconto (receita). */
  natureza: "receita" | "desconto";
  /** 1ª letra diferente de N (AR/AD, FR, DD…): acertos e lançamentos fora do mês normal. */
  acerto: boolean;
  descricao: string;
  /** 12 valores, jan…dez */
  meses: number[];
  total: number;
}

export interface FichaFinanceira {
  /** SIPPES (atual, uma ficha por ano) ou SIAPPES (antigo, vários anos no mesmo PDF). Sem o campo: SIPPES. */
  sistema?: "sippes" | "siappes";
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

// Código do SIPPES: 1ª letra = tipo (N normal, A acerto, F, D devolução…), 2ª = natureza (R receita, D desconto), 4 dígitos.
// A ficha de 2026 trouxe FR0077 e DD0013, que antes viravam "descrição" e tinham os valores perdidos.
export const CODIGO_SIPPES = /^[A-Z][RD]\d{4}$/;

/**
 * Natureza pelo código. Devolução (1ª letra D) inverte: DD0013 (devolução de despesa médica) é crédito.
 * Conferido na ficha de 2026: só com FR0077 e DD0013 como receita os totais líquidos de jan e jun fecham.
 */
export function naturezaDoCodigo(codigo: string): "receita" | "desconto" {
  const receita = codigo[1] === "R";
  return (codigo[0] === "D" ? !receita : receita) ? "receita" : "desconto";
}
/**
 * Código do SIAPPES (Tab_pag): 3 caracteres. 1ª letra A/B/C = receita (ativa, inativa, pensionista);
 * G/H/I = reposição dessas receitas (desconto); Z ou dígito = desconto.
 * Conferido nas fichas de 2021 a 2024: só assim os totais de cada mês fecham (G07 e G84 descontam).
 */
export const CODIGO_SIAPPES = /^[A-Z0-9]{3}$/;
export function naturezaSiappes(codigo: string): "receita" | "desconto" {
  return /^[ABCR]/.test(codigo) ? "receita" : "desconto";
}
const CODIGO = CODIGO_SIPPES;
/** "1.177,00"; a ficha nova do SIPPES (out/2026) escreve sem ponto de milhar: "1177,00". */
export const VALOR = /^-?(\d{1,3}(\.\d{3})*|\d+),\d{2}$/;
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

/** Rótulos do cabeçalho da ficha nova do SIPPES: vários campos na mesma linha ("Nr de idt/Cadastro: … Nome: … CPF: …"). */
const ROTULOS_NOVOS = /(Nr de idt\/Cadastro:|Nome:|CPF:|Categoria:|Posto\/Grad real:|PREC\/CP:|OM:|RM:|Número de dependentes de IR:)/;

function lerCabecalhoNovo(linhas: Linha[]): FichaFinanceira["cabecalho"] & { ano: number | null } {
  const campos: Record<string, string> = {};
  // a linha de "Nome:" do rodapé (quem acessou) vem depois: fica o 1º valor de cada rótulo
  for (const l of linhas) {
    const partes = l.texto.split(ROTULOS_NOVOS);
    for (let i = 1; i < partes.length; i += 2) campos[partes[i]!] ??= partes[i + 1]!.trim();
  }
  const digitos = (s: string | undefined) => s?.replace(/\D/g, "") || null;
  const om = campos["OM:"]?.match(/^(\d+)\s*-\s*(.+)$/);
  return {
    ano: Number(linhas.map((l) => /\bAno:?\s*(\d{4})/.exec(l.texto)?.[1]).find(Boolean)) || null,
    posto: campos["Posto/Grad real:"]?.replace(/-/g, " ") || null,
    nome: campos["Nome:"] || null,
    precCp: digitos(campos["PREC/CP:"]),
    identidade: digitos(campos["Nr de idt/Cadastro:"]),
    cpf: digitos(campos["CPF:"]),
    codom: om?.[1] ?? null,
    rm: campos["RM:"]?.match(/^(\d+)/)?.[1] ?? null,
    siglaUa: om?.[2] ?? null,
  };
}

function lerCabecalho(linhas: Linha[]): FichaFinanceira["cabecalho"] & { ano: number | null } {
  if (linhas.some((l) => /idt\/Cadastro:/.test(l.texto))) return lerCabecalhoNovo(linhas);
  const buscar = (re: RegExp) => {
    for (const l of linhas) {
      const m = re.exec(l.texto);
      if (m) return m;
    }
    return null;
  };
  const nome = buscar(/^(.*?)\s*NOME:\s*(.+?)\s*$/);
  // SIAPPES: "19 ( PRIMEIRO-SARGENTO )" → "PRIMEIRO SARGENTO"
  const posto = nome?.[1]?.trim().replace(/^\d*\s*\(\s*(.+?)\s*\)$/, (_, p: string) => p.replace(/-/g, " ")) || null;
  return {
    ano: Number(buscar(/\bAno\s+(\d{4})\b/)?.[1]) || null,
    posto,
    nome: nome?.[2]?.trim() || null,
    precCp: buscar(/PREC\/CP:\s*(\d+)/i)?.[1] ?? null,
    // SIAPPES traz a identidade com o prefixo "EB"
    identidade: buscar(/IDENTIDADE:\s*(?:[A-Z]{2})?(\d+)/i)?.[1] ?? null,
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
    // fim da tabela: "TOTAIS LÍQUIDOS"; na ficha nova, "Total Receitas", "Total Despesas" e "Total Líquido"
    const iTot = corpo.findIndex((l) => /TOTAIS|^Total\s+(Receitas|Despesas|L[íi]quido)\b/.test(l.texto));
    const iLiq = corpo.findIndex((l) => /TOTAIS|^Total\s+L[íi]quido\b/.test(l.texto));
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
        natureza: naturezaDoCodigo(codigo),
        acerto: codigo[0] !== "N",
        meses: nums.slice(0, 12),
        total: nums[12]!,
      });
    });

    if (iLiq >= 0) {
      const v = corpo[iLiq]!.palavras.filter((p) => VALOR.test(p.texto)).map((p) => lerValor(p.texto));
      if (v.length >= 12) totaisLiquidos = v.slice(0, 12);
      else avisos.push("linha TOTAIS LÍQUIDOS incompleta");
    }
  }

  if (xJan === null) avisos.push("tabela não encontrada (cabeçalho Código/Descrição/Jan…Total)");
  return { sistema: "sippes", ano, cabecalho, linhas: resultado, totaisLiquidos, conferencias: conferir(resultado, totaisLiquidos, avisos), avisos };
}

/** Soma de cada linha × total impresso, e receitas − descontos de cada mês × linha de totais líquidos. */
function conferir(linhas: LinhaFicha[], totaisLiquidos: number[] | null, avisos: string[]): FichaFinanceira["conferencias"] {
  const linhasDivergentes = linhas
    .filter((l) => centavos(l.meses.reduce((a, b) => a + b, 0)) !== centavos(l.total))
    .map((l) => l.codigo);
  const mesesDivergentes: number[] = [];
  if (totaisLiquidos) {
    for (let m = 0; m < 12; m++) {
      const liq = linhas.reduce((s, l) => s + (l.natureza === "receita" ? 1 : -1) * centavos(l.meses[m]!), 0);
      if (liq !== centavos(totaisLiquidos[m]!)) mesesDivergentes.push(m + 1);
    }
  } else avisos.push("sem linha TOTAIS LÍQUIDOS para conferir");
  return { linhasDivergentes, mesesDivergentes, ok: linhasDivergentes.length === 0 && mesesDivergentes.length === 0 && !!totaisLiquidos };
}

/** Ficha do SIAPPES: o cabeçalho da tabela começa por "Cód." (no SIPPES, "Código"). */
export function ehFichaSiappes(palavras: Palavra[]): boolean {
  return agruparLinhas(palavras).some((l) => /^C[óo]d\.\s/.test(l.texto) && /\bJan\b/.test(l.texto));
}

/**
 * Ficha Financeira do SIAPPES (sistema antigo). Um PDF traz vários anos, cada um com o próprio cabeçalho
 * ("Ano 2024 (MOEDA: REAL)", nome, Prec/CP, CODOM…) e tabela; a tabela pode continuar na página seguinte,
 * repetindo a linha "Cód. Descrição Jan … Total". Cada linha: código de 3 caracteres, descrição numa linha só,
 * 12 meses e total; a tabela fecha com "TOTAL" (12 líquidos). Devolve uma ficha por ano, na ordem do PDF.
 */
export function lerFichasSiappes(palavras: Palavra[]): FichaFinanceira[] {
  const fichas: FichaFinanceira[] = [];
  let bloco: Linha[] | null = null;
  const fechar = () => { if (bloco) fichas.push(lerAnoSiappes(bloco)); };
  for (const l of agruparLinhas(palavras)) {
    // o título "MINISTÉRIO DA DEFESA" fica 2 linhas acima de "Ano": o bloco é aberto pelo "Ano"
    if (/^Ano\s+\d{4}\b/.test(l.texto)) { fechar(); bloco = []; }
    bloco?.push(l);
  }
  fechar();
  return fichas;
}

function lerAnoSiappes(linhas: Linha[]): FichaFinanceira {
  const avisos: string[] = [];
  const { ano, ...cabecalho } = lerCabecalho(linhas);
  const resultado: LinhaFicha[] = [];
  let totaisLiquidos: number[] | null = null;
  let xJan: number | null = null;
  for (const l of linhas) {
    if (/^C[óo]d\.\s/.test(l.texto)) { xJan = l.palavras.find((p) => p.texto === "Jan")?.x ?? xJan; continue; }
    if (xJan === null) continue;
    const valores = l.palavras.filter((p) => VALOR.test(p.texto) && p.x >= xJan! - 30);
    if (/^TOT\s?AL\b/.test(l.texto)) {
      if (valores.length >= 12) totaisLiquidos = valores.slice(0, 12).map((p) => lerValor(p.texto));
      else avisos.push("linha TOTAL incompleta");
      continue;
    }
    const codigo = l.palavras[0]!.texto;
    if (!CODIGO_SIAPPES.test(codigo) || !valores.length) continue;
    if (valores.length !== 13) {
      avisos.push(`${codigo}: esperava 12 meses + total, encontrei ${valores.length} valores`);
      continue;
    }
    const nums = valores.map((p) => lerValor(p.texto));
    resultado.push({
      codigo,
      descricao: l.palavras.slice(1).filter((p) => p.x < xJan! - 2 && !valores.includes(p)).map((p) => p.texto).join(" ").trim(),
      natureza: naturezaSiappes(codigo),
      acerto: /^[GHI]/.test(codigo),
      meses: nums.slice(0, 12),
      total: nums[12]!,
    });
  }
  if (xJan === null) avisos.push("tabela não encontrada (cabeçalho Cód./Descrição/Jan…Total)");
  return { sistema: "siappes", ano, cabecalho, linhas: resultado, totaisLiquidos, conferencias: conferir(resultado, totaisLiquidos, avisos), avisos };
}

function codigoDe(it: unknown): string {
  return (it as { linha?: Linha }).linha?.palavras[0]?.texto ?? "?";
}
