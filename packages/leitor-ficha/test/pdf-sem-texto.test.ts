/** PDF só com desenho (como o da impressora "Microsoft Print to PDF"): nenhuma palavra para ler. */
import { describe, expect, it } from "vitest";
import { lerDocumentosPdf, PdfSemTexto } from "../src";

// uma página A4 com um retângulo desenhado e nenhum texto
function pdfSemTexto(): Uint8Array {
  const conteudo = "10 10 100 100 re f";
  const objetos = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R >>",
    `<< /Length ${conteudo.length} >>\nstream\n${conteudo}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const posicoes: number[] = [];
  objetos.forEach((o, i) => { posicoes.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n${posicoes.map((p) => `${String(p).padStart(10, "0")} 00000 n \n`).join("")}`;
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}

describe("PDF sem texto", () => {
  it("é recusado com PdfSemTexto, para a tela explicar como gerar o PDF", async () => {
    await expect(lerDocumentosPdf(pdfSemTexto())).rejects.toBeInstanceOf(PdfSemTexto);
  });
});
