import { describe, expect, it } from "vitest";
import { marcacaoDosTrechos, normalizarFormatado, textoSemFormatacao, trechosFormatados } from "../src/texto-formatado";

describe("texto formatado (negrito, itálico, sublinhado)", () => {
  it("lê os trechos com estilo, inclusive aninhados", () => {
    expect(trechosFormatados("DIEx nº <b>103</b> de <b><i>20 Set</i></b> <u>2026</u>")).toEqual([
      { texto: "DIEx nº ", negrito: false, italico: false, sublinhado: false },
      { texto: "103", negrito: true, italico: false, sublinhado: false },
      { texto: " de ", negrito: false, italico: false, sublinhado: false },
      { texto: "20 Set", negrito: true, italico: true, sublinhado: false },
      { texto: " ", negrito: false, italico: false, sublinhado: false },
      { texto: "2026", negrito: false, italico: false, sublinhado: true },
    ]);
  });

  it("texto antigo ou com outras tags fica como texto comum (escapado ao gravar)", () => {
    expect(textoSemFormatacao("a < b & <script>x</script>")).toBe("a < b & <script>x</script>");
    expect(normalizarFormatado("a < b & <script>x</script>")).toBe("a &lt; b &amp; &lt;script&gt;x&lt;/script&gt;");
    expect(textoSemFormatacao(normalizarFormatado("a < b"))).toBe("a < b");
  });

  it("ida e volta, apara as pontas e conta só o texto", () => {
    const m = normalizarFormatado("  <b>Linha 1</b>\r\n<i>linha 2</i>  ");
    expect(m).toBe("<b>Linha 1</b>\n<i>linha 2</i>");
    expect(marcacaoDosTrechos(trechosFormatados(m))).toBe(m);
    expect(textoSemFormatacao(m)).toHaveLength(15);
  });
});
