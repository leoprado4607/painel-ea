/**
 * Leitura no navegador das peças que o servidor não lê (27/11/2026, análise do Adicional de Habilitação):
 * PDF escaneado (só imagem) → OCR em português (Tesseract), página por página; PDF grande demais para enviar → o texto
 * é extraído aqui mesmo. Devolve as palavras com posição, que o servidor interpreta com o mesmo leitor das fichas.
 * Só importar em componente do cliente.
 */
import { lerDocumentosPalavras, type Palavra } from "@painel-ea/leitor-ficha";
import { completarCelulaPerdida, palavrasDoOcr, recomporValoresTabela, recuperarCodigosSiappes } from "./ocr-palavras";

/** Páginas lidas por OCR em cada peça (uma ficha tem 1 ou 2; o resto do processo raramente passa disso). */
export const LIMITE_PAGINAS_OCR = 12;
/**
 * Duas leituras possíveis (testadas com fichas reais do SIAPPES e do SIPPES, 27/11/2026): ~216 dpi, só sem as linhas da
 * grade, lê perfeitamente a ficha do SIAPPES; ~288 dpi em preto e branco (limiar 190) preserva a vírgula miúda da ficha do SIPPES (impressa da
 * intranet, com linhas cinza). A 2ª só roda se a 1ª não fechar com os totais impressos; fica a que fecha mais.
 */
const LEITURAS = [{ escala: 3, limiar: 170, binarizar: false }, { escala: 4, limiar: 190, binarizar: true }] as const;

type Pdfjs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
let pdfjs: Promise<Pdfjs> | null = null;
function carregarPdfjs() {
  pdfjs ??= import("pdfjs-dist/legacy/build/pdf.mjs").then((m) => {
    // mesma versão do pacote; o Tesseract também vem do jsDelivr
    m.GlobalWorkerOptions.workerSrc ||= `https://cdn.jsdelivr.net/npm/pdfjs-dist@${m.version}/legacy/build/pdf.worker.min.mjs`;
    return m;
  });
  return pdfjs;
}

/**
 * Prepara a página para o OCR: sem as linhas da grade e, se pedido, em preto e branco puro (o fundo cinza das linhas
 * alternadas da ficha do SIPPES vira branco). As linhas da grade (bordas das células) o Tesseract lê como "]", ")" ou "|" e
 * por causa delas perde células inteiras.
 * Traço contínuo horizontal com mais de ~14 pontos ou vertical com mais de ~9 pontos não é letra (a ficha usa letra de ~6 pontos).
 */
export function apagarLinhas(ctx: CanvasRenderingContext2D, w: number, h: number, escala: number, limiar: number, binarizar: boolean) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const preto = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) preto[i] = d[i * 4]! * 0.299 + d[i * 4 + 1]! * 0.587 + d[i * 4 + 2]! * 0.114 < limiar ? 1 : 0;
  const apagar = new Uint8Array(w * h);
  const minH = Math.round(14 * escala), minV = Math.round(9 * escala);
  for (let y = 0; y < h; y++) {
    let ini = -1;
    for (let x = 0; x <= w; x++) {
      const e = x < w && preto[y * w + x] === 1;
      if (e && ini < 0) ini = x;
      if (!e && ini >= 0) { if (x - ini >= minH) apagar.fill(1, y * w + ini, y * w + x); ini = -1; }
    }
  }
  for (let x = 0; x < w; x++) {
    let ini = -1;
    for (let y = 0; y <= h; y++) {
      const e = y < h && preto[y * w + x] === 1;
      if (e && ini < 0) ini = y;
      if (!e && ini >= 0) { if (y - ini >= minV) for (let k = ini; k < y; k++) apagar[k * w + x] = 1; ini = -1; }
    }
  }
  for (let i = 0; i < w * h; i++) {
    if (apagar[i]) d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = 255;
    else if (binarizar) d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = preto[i] ? 0 : 255;
  }
  ctx.putImageData(img, 0, 0);
}

export interface LidaNoNavegador { palavras: Palavra[]; ocr: boolean; paginas: number; paginasLidas: number }

/** Um leitor por envio: o Tesseract (e o idioma, ~10 MB na 1ª vez, depois em cache) é carregado só se alguma peça precisar. */
export function criarLeitorNavegador(aviso: (texto: string) => void) {
  let tesseract: Promise<import("tesseract.js").Worker> | null = null;
  let rotulo = "";
  const ocr = () => (tesseract ??= import("tesseract.js").then(({ createWorker }) => {
    aviso(`${rotulo}: preparando o leitor de texto (OCR)…`);
    return createWorker("por", 1, {
      logger: (m: { status: string; progress: number }) => {
        if (m.status === "recognizing text") aviso(`${rotulo}: reconhecendo o texto (${Math.round(m.progress * 100)}%)…`);
        else if (/loading|initializ/i.test(m.status)) aviso(`${rotulo}: preparando o leitor de texto (OCR)…`);
      },
    });
  }));

  /** OCR das páginas numa das leituras. */
  async function ocrDasPaginas(nome: string, doc: Awaited<ReturnType<Pdfjs["getDocument"]>["promise"]>, paginas: number, leitura: (typeof LEITURAS)[number], rodada: string) {
    const worker = await ocr();
    // modo 4 (uma coluna de linhas de tamanhos variados): o que melhor lê a tabela da ficha
    await worker.setParameters({ tessedit_pageseg_mode: "4" as never });
    const palavras: Palavra[] = [];
    for (let n = 1; n <= paginas; n++) {
      aviso(`${nome}: OCR da página ${n} de ${paginas}${rodada}…`);
      const pagina = await doc.getPage(n);
      const vista = pagina.getViewport({ scale: leitura.escala });
      const tela = document.createElement("canvas");
      tela.width = Math.ceil(vista.width);
      tela.height = Math.ceil(vista.height);
      const ctx = tela.getContext("2d", { willReadFrequently: true })!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, tela.width, tela.height);
      await pagina.render({ canvasContext: ctx, viewport: vista }).promise;
      apagarLinhas(ctx, tela.width, tela.height, leitura.escala, leitura.limiar, leitura.binarizar);
      const { data } = await worker.recognize(tela);
      tela.width = tela.height = 0; // libera a memória da imagem
      palavras.push(...completarCelulaPerdida(recomporValoresTabela(recuperarCodigosSiappes(palavrasDoOcr(data.words.map((w) => ({
        texto: w.text, confianca: w.confidence, x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1,
        base: w.baseline?.has_baseline ? Math.max(w.baseline.y0, w.baseline.y1) : null,
      })), leitura.escala, n)))));
    }
    return palavras;
  }

  /**
   * Nota da leitura de uma ficha: linhas lidas, menos as que não fecham com o total, as incompletas e os meses cujo
   * líquido não fecha. null: não é ficha (requerimento, BI…), uma leitura basta.
   */
  function nota(palavras: Palavra[]): { valor: number; perfeita: boolean } | null {
    if (!palavras.some((p) => p.texto === "Jan") || !palavras.some((p) => p.texto === "Dez")) return null;
    let docs;
    try { docs = lerDocumentosPalavras(palavras); } catch { return { valor: -Infinity, perfeita: false }; }
    const fichas = docs.map((d) => d.ficha).filter((f) => f.linhas.length);
    if (!fichas.length) return { valor: -Infinity, perfeita: false };
    const valor = fichas.reduce((s, f) => s + f.linhas.length - 2 * f.conferencias.linhasDivergentes.length - f.conferencias.mesesDivergentes.length / 2
      - 2 * f.avisos.filter((a) => /esperava/.test(a)).length, 0);
    return { valor, perfeita: fichas.every((f) => f.conferencias.ok && !f.avisos.some((a) => /esperava/.test(a))) };
  }

  /** forcarOcr: lê por OCR mesmo um PDF com texto (só para teste). */
  async function ler(nome: string, dados: Uint8Array, forcarOcr = false): Promise<LidaNoNavegador> {
    const { getDocument, Util } = await carregarPdfjs();
    const doc = await getDocument({ data: dados.slice(), isEvalSupported: false }).promise;
    try {
      const palavras: Palavra[] = [];
      // 1º: o texto do próprio PDF (o mesmo cálculo de posição do leitor do servidor, lib leitor-ficha/pdf)
      for (let n = 1; n <= doc.numPages; n++) {
        const pagina = await doc.getPage(n);
        const tela = pagina.getViewport({ scale: 1 }).transform as number[];
        const conteudo = await pagina.getTextContent();
        for (const item of conteudo.items as { str?: string; transform: number[]; width: number }[]) {
          if (!item.str?.trim()) continue;
          const [a, b, c, , x0, y] = Util.transform(tela, item.transform) as number[];
          const larguraChar = item.str.length ? item.width / item.str.length : 0;
          let i = 0;
          for (const parte of item.str.split(/(\s+)/)) {
            if (parte.trim()) palavras.push({ texto: parte, x: x0! + i * larguraChar, y: y!, largura: parte.length * larguraChar, pagina: n,
              tamanho: Math.hypot(a!, b!), inclinada: Math.abs(b!) > 0.01 || Math.abs(c!) > 0.01 });
            i += parte.length;
          }
        }
      }
      if (palavras.length && !forcarOcr) return { palavras, ocr: false, paginas: doc.numPages, paginasLidas: doc.numPages };

      // 2º: só imagem → OCR (a 2ª leitura só para ficha cujos totais não fecharam na 1ª)
      rotulo = nome;
      const paginasLidas = Math.min(doc.numPages, LIMITE_PAGINAS_OCR);
      let melhor = await ocrDasPaginas(nome, doc, paginasLidas, LEITURAS[0], "");
      const n1 = nota(melhor);
      if (n1 && !n1.perfeita) {
        const outra = await ocrDasPaginas(nome, doc, paginasLidas, LEITURAS[1], " (2ª leitura, para conferir os totais)");
        const n2 = nota(outra);
        if (n2 && n2.valor > n1.valor) melhor = outra;
      }
      return { palavras: melhor, ocr: true, paginas: doc.numPages, paginasLidas };
    } finally {
      await doc.destroy();
    }
  }

  async function encerrar() {
    if (tesseract) await (await tesseract).terminate().catch(() => undefined);
    tesseract = null;
  }
  return { ler, encerrar };
}
