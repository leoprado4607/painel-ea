/**
 * OCR de PDF escaneado (27/11/2026, análise do Adicional de Habilitação): as palavras reconhecidas pelo Tesseract, com a
 * caixa de cada uma em pixels da página renderizada, viram as mesmas "palavras com posição" que o pdf.js dá num PDF com
 * texto (em pontos, origem no canto superior esquerdo). Assim o mesmo leitor de fichas e de contracheques serve aos dois.
 * Código puro (testado); o OCR em si roda no navegador (lib/ocr-navegador).
 */
import type { Palavra } from "@painel-ea/leitor-ficha";

export interface PalavraOcr {
  texto: string;
  /** 0 a 100 */
  confianca: number;
  x0: number; y0: number; x1: number; y1: number;
  /** linha de base (y), quando o Tesseract a dá */
  base?: number | null;
}

/** Abaixo disso, a palavra é ruído (borda, carimbo, sujeira da digitalização). */
export const CONFIANCA_MINIMA = 35;

const DIGITO: Record<string, string> = { O: "0", o: "0", Q: "0", D: "0", c: "0", C: "0", "/": "7", I: "1", l: "1", "|": "1", S: "5", s: "5", B: "8", Z: "2" };
const paraDigitos = (s: string) => [...s].map((c) => DIGITO[c] ?? c).join("");

/**
 * Corrige trocas típicas do OCR nos campos que o leitor procura:
 * - código do SIPPES (NR0001, AR0003, DR0003): letra, R/D e 4 dígitos ("NRO0O1" → "NR0001");
 * - código do SIAPPES (A01, A03, A85, Z01, G03): letra e 2 dígitos ("AO3" → "A03");
 * - valor em reais: dígitos com pontos de milhar e vírgula ("1.234.56" → "1.234,56", "O,OO" → "0,00").
 */
export function corrigirTextoOcr(bruto: string): string {
  // bordas das células lidas como colchete, parêntese ou barra grudados no valor ("459,00]", "[3.825,00")
  const t = bruto.trim().replace(/[‘’`´]/g, "'").replace(/^[|:;[\](){}!]+|[|:;[\](){}!]+$/g, "")
    // letra inicial dobrada no código ("Zz1o" → "Z1o")
    .replace(/^([A-Z])\1(?=[0-9A-Za-z]{2}$)/i, "$1");
  const sippes = /^([A-Za-z])([RrDd])([0-9OoQDIl|SBcC]{4})$/.exec(t);
  if (sippes) return `${sippes[1]!.toUpperCase()}${sippes[2]!.toUpperCase()}${paraDigitos(sippes[3]!)}`;
  // SIAPPES: A01, A03, A85, G03, Z01, Z02, ZR0, AL0, ZM7… ("zo2" → "Z02", "ALO" → "AL0", "AB5" → "A85")
  const siappes = /^([AZGazg])([0-9A-Za-z])([0-9A-Za-z])$/.exec(t);
  // só com algum dígito ou tudo em maiúsculas ("Ano" e outras palavras comuns ficam como estão)
  if (siappes && /[0-9OoIl]/.test(siappes[2]! + siappes[3]!) && (/\d/.test(t) || t === t.toUpperCase())) {
    const ini = siappes[1]!.toUpperCase();
    const [b, c] = [siappes[2]!, siappes[3]!];
    const dig = (x: string) => (/[OoQ]/.test(x) ? "0" : /[Il|]/.test(x) ? "1" : x === "B" ? "8" : x.toUpperCase());
    // 2º caractere: dígito se o 3º for dígito (A01, Z02, A85); senão é letra (AL0, ZR0, ZM7)
    const cDig = /[0-9OoQIl|]/.test(c);
    const r = `${ini}${cDig && /[0-9OoQIl|B]/.test(b) ? dig(b) : b.toUpperCase()}${cDig ? dig(c) : c.toUpperCase()}`;
    if (/^[AZG](\d\d|[A-Z]\d)$/.test(r)) return r;
  }
  // valor: só dígitos (ou letras confundidas), pontos e vírgulas, com dois "dígitos" no fim
  // traço da grade lido como vírgula ou ponto depois do valor ("3.825,00,")
  const semCauda = /[.,][0-9OoIlS]{2}[.,'"]+$/.test(t) ? t.replace(/[.,'"]+$/, "") : t;
  if (/^-?[0-9OoIlS.,]+$/.test(semCauda) && (/\d/.test(semCauda) || semCauda.includes(",")) && /[.,][0-9OoIlS]{2}$/.test(semCauda)) {
    let v = paraDigitos(semCauda);
    if (!v.includes(",")) v = v.replace(/\.(\d{2})$/, ",$1");
    return v;
  }
  return t;
}

/** Código de rubrica (SIAPPES "A01", SIPPES "NR0001"): o OCR costuma dar pouca confiança a eles, mas são essenciais. */
const PARECE_CODIGO = /^([A-Z][A-Z0-9]{2}|[A-Z][RD]\d{4})$/;

/** Palavras do OCR de uma página → palavras do leitor (pontos), na escala em que a página foi renderizada. */
export function palavrasDoOcr(ocr: PalavraOcr[], escala: number, pagina: number): Palavra[] {
  const out: Palavra[] = [];
  for (const w of ocr) {
    const texto = corrigirTextoOcr(w.texto);
    if (!texto) continue;
    if (w.confianca < CONFIANCA_MINIMA && !(w.confianca >= 10 && PARECE_CODIGO.test(texto))) continue;
    const altura = Math.max(1, w.y1 - w.y0);
    out.push({
      texto,
      x: w.x0 / escala,
      // o pdf.js dá a linha de base; a caixa do OCR inclui as pernas (g, p, q), então a base, quando houver, é melhor
      y: (w.base && w.base > w.y0 && w.base <= w.y1 + 2 ? w.base : w.y1) / escala,
      largura: (w.x1 - w.x0) / escala,
      pagina,
      // a caixa cobre ~70% do corpo da fonte
      tamanho: altura / escala / 0.7,
      inclinada: false,
    });
  }
  return out;
}

/**
 * Descrições da ficha do SIAPPES → código: quando o OCR perde ou troca o código de 3 caracteres ("ABS" no lugar de A85),
 * a descrição da linha (lida bem) recupera o código. Só as descrições exatas conhecidas (conferidas em fichas reais).
 */
const DESCRICAO_SIAPPES: [RegExp, string][] = [
  [/^SOLDO$/, "A01"], [/^ADIC HAB$/, "A03"], [/^ADIC MIL$/, "A14"], [/^ADIC NATAL-?1 PAR$/, "A84"], [/^ADIC NATAL$/, "A85"],
  [/^ADICIONAL FERIAS$/, "AD2"], [/^AD C DISP MIL$/, "AL0"], [/^FUSEX$/, "Z01"], [/^P MIL$/, "Z02"], [/^FUSEX DESP MED$/, "ZM3"], [/^I?R$/, "Z10"],
];
const VALOR_OCR = /^-?(\d{1,3}(\.\d{3})*|\d+),\d{2}$/;

/** Na ficha do SIAPPES lida por OCR, recoloca o código das linhas de valores em que ele se perdeu ou veio trocado. */
export function recuperarCodigosSiappes(palavras: Palavra[]): Palavra[] {
  const cod = palavras.find((p) => /^C[óo]d\.?$/.test(p.texto));
  if (!cod || !palavras.some((p) => p.texto === "Jan" && Math.abs(p.y - cod.y) < 3)) return palavras;
  const linhas: Palavra[][] = [];
  for (const p of [...palavras].sort((a, b) => a.pagina - b.pagina || a.y - b.y || a.x - b.x)) {
    const l = linhas.find((x) => x[0]!.pagina === p.pagina && Math.abs(x[0]!.y - p.y) < 2.5);
    if (l) l.push(p); else linhas.push([p]);
  }
  const out: Palavra[] = [];
  for (const l of linhas) {
    l.sort((a, b) => a.x - b.x);
    const valores = l.filter((p) => VALOR_OCR.test(p.texto));
    const primeira = l[0]!;
    const naColuna = primeira.x <= cod.x + 12;
    // código lido com dígito (A01, ZM3) fica; sem dígito ("AOS", "ABA") ou fora do padrão, a descrição decide
    if (valores.length >= 12 && !(naColuna && /^[A-Z](\d\d|[A-Z]\d)$/.test(primeira.texto))) {
      const descricao = l.filter((p) => p !== (naColuna ? primeira : null) && p.x < valores[0]!.x).map((p) => p.texto).join(" ");
      const codigo = DESCRICAO_SIAPPES.find(([re]) => re.test(descricao))?.[1];
      if (codigo) {
        const resto = naColuna ? l.slice(1) : l;
        out.push({ ...primeira, texto: codigo, x: cod.x, largura: primeira.tamanho ? primeira.tamanho * 1.8 : 10 }, ...resto);
        continue;
      }
    }
    out.push(...l);
  }
  return out;
}

/**
 * Na tabela da ficha (abaixo da linha "Jan … Dez"), toda célula de valor é dinheiro com 2 casas. O OCR às vezes perde a
 * vírgula, miúda ("29845", "000"), ou lê o 7 como barra ("8//80"): ali, só dígitos viram "298,45", "0,00", "877,80".
 */
export function recomporValoresTabela(palavras: Palavra[]): Palavra[] {
  const jan = palavras.filter((p) => p.texto === "Jan" && palavras.some((q) => q.texto === "Dez" && q.pagina === p.pagina && Math.abs(q.y - p.y) < 3));
  if (!jan.length) return palavras;
  return palavras.map((p) => {
    const cab = jan.filter((j) => j.pagina === p.pagina && j.y < p.y - 2).at(-1);
    if (cab && p.x >= cab.x - 30 && /^[0O]{2}$/.test(p.texto)) return { ...p, texto: "0,00" };
    if (!cab || p.x < cab.x - 30 || !/^[0-9OoIlS/]{3,}$/.test(p.texto) || !/\d/.test(p.texto) || /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(p.texto)) return p;
    // uma única barra seguida de 2 dígitos no fim é a vírgula ("877/80"); as demais barras são o 7 ("8//80" = 877,80)
    const digitos = paraDigitos(p.texto.split("/").length === 2 ? p.texto.replace(/\/(\d{2})$/, "$1") : p.texto);
    if (!/^\d+$/.test(digitos)) return p;
    return { ...p, texto: `${digitos.slice(0, -2)},${digitos.slice(-2)}` };
  });
}

const MESES_CAB = ["Jan", "Fev", "Mar", "Abr", "Maio", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez", "Total"];
const reaisOcr = (t: string) => Number(t.replace(/\./g, "").replace(",", "."));
const comoReais = (v: number) => {
  const [i, c] = v.toFixed(2).split(".");
  return `${i!.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${c}`;
};

/**
 * Linha da tabela com uma única célula perdida pelo OCR (12 dos 13 valores): o mês que falta é achado pela coluna
 * (posição sob o cabeçalho "Jan … Dez Total") e o valor é deduzido do total impresso da linha (total − soma dos meses).
 * A conferência do líquido de cada mês continua valendo como verificação.
 */
export function completarCelulaPerdida(palavras: Palavra[]): Palavra[] {
  const extra: Palavra[] = [];
  const cabecalhos = palavras.filter((p) => p.texto === "Jan");
  for (const jan of cabecalhos) {
    const cols = MESES_CAB.map((m) => palavras.find((p) => p.pagina === jan.pagina && Math.abs(p.y - jan.y) < 3 && p.texto === m));
    if (cols.some((c) => !c)) continue;
    const centros = cols.map((c) => c!.x + c!.largura / 2);
    const prox = cabecalhos.filter((c) => c.pagina === jan.pagina && c.y > jan.y).map((c) => c.y);
    const limite = prox.length ? Math.min(...prox) : Infinity;
    const linhas: Palavra[][] = [];
    for (const p of palavras) {
      if (p.pagina !== jan.pagina || p.y <= jan.y + 2 || p.y >= limite || !VALOR_OCR.test(p.texto) || p.x < jan.x - 30) continue;
      const l = linhas.find((x) => Math.abs(x[0]!.y - p.y) < 2.5);
      if (l) l.push(p); else linhas.push([p]);
    }
    for (const l of linhas) {
      if (l.length !== 12) continue;
      const coluna = l.map((p) => {
        const c = p.x + p.largura / 2;
        return centros.reduce((m, x, i) => (Math.abs(x - c) < Math.abs(centros[m]! - c) ? i : m), 0);
      });
      if (new Set(coluna).size !== 12 || !coluna.includes(12)) continue;
      const falta = [...Array(12).keys()].find((i) => !coluna.includes(i));
      if (falta === undefined) continue;
      const total = reaisOcr(l[coluna.indexOf(12)]!.texto);
      const soma = l.filter((_, i) => coluna[i] !== 12).reduce((s, p) => s + reaisOcr(p.texto), 0);
      const v = Math.round((total - soma) * 100) / 100;
      if (v < 0) continue;
      const ref = l[0]!;
      extra.push({ ...ref, texto: comoReais(v), x: centros[falta]! - ref.largura / 2 });
    }
  }
  return extra.length ? [...palavras, ...extra] : palavras;
}
