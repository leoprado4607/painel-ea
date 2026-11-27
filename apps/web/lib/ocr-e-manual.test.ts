import { describe, expect, it } from "vitest";
import { analisarAdicHab, conferenciaDasFichas, faltasDasFichas, faltasDaLeituraOcr } from "./analise-adic-hab";
import { aplicarFichaDigitada, fichaDigitadaValida, numeroBr, valoresDaFicha } from "./ficha-digitada";
import { completarCelulaPerdida, corrigirTextoOcr, palavrasDoOcr, recomporValoresTabela, recuperarCodigosSiappes } from "./ocr-palavras";
import type { Palavra } from "@painel-ea/leitor-ficha";
import type { FichaLida } from "./receitas";

const doze = (v: number) => Array.from({ length: 12 }, () => v);

describe("OCR: correção das palavras", () => {
  it("códigos do SIPPES e do SIAPPES e valores em reais", () => {
    expect(["NRO0O1", "ARO003", "nr0003", "DRoOO3", "AO3", "Z0l", "G03"].map(corrigirTextoOcr)).toEqual(["NR0001", "AR0003", "NR0003", "DR0003", "A03", "Z01", "G03"]);
    expect(["1.234.56", "O,OO", "6.7l3,O0", "12,5O"].map(corrigirTextoOcr)).toEqual(["1.234,56", "0,00", "6.713,00", "12,50"]);
    expect(["SOLDO", "ADIC", "HABILITACAO", "2023", "Ten"].map(corrigirTextoOcr)).toEqual(["SOLDO", "ADIC", "HABILITACAO", "2023", "Ten"]);
  });

  it("restos da grade, letra dobrada e códigos com letras trocadas (casos das fichas reais)", () => {
    expect(["459,00]", "[3.825,00", "3.825,00,", "zo2", "ALO", "Zz1o", "nDoc4o", "INR0001".slice(1), "Ano", "ZXR", "Total"].map(corrigirTextoOcr))
      .toEqual(["459,00", "3.825,00", "3.825,00", "Z02", "AL0", "Z10", "ND0040", "NR0001", "Ano", "ZXR", "Total"]);
  });

  const pal = (texto: string, x: number, y: number, largura = 20): Palavra => ({ texto, x, y, largura, pagina: 1, tamanho: 6 });
  const MESES_CAB = ["Jan", "Fev", "Mar", "Abr", "Maio", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez", "Total"];
  const cabecalho = (y: number) => [pal("Cód.", 49, y), pal("Descrição", 110, y), ...MESES_CAB.map((m, i) => pal(m, 196 + i * 47, y, 15))];

  it("SIAPPES: código perdido ou trocado é recuperado pela descrição da linha", () => {
    const linha = (y: number, ...ini: Palavra[]) => [...ini, ...Array.from({ length: 13 }, (_, i) => pal("0,00", 200 + i * 47, y))];
    const p = recuperarCodigosSiappes([...cabecalho(100), ...linha(110, pal("ABS", 51, 110), pal("ADIC", 107, 110), pal("NATAL", 124, 110)),
      ...linha(120, pal("ADIC", 112, 120), pal("MIL", 128, 120)), ...linha(130, pal("A01", 51, 130), pal("SOLDO", 113, 130))]);
    const codigos = [110, 120, 130].map((y) => p.filter((x) => x.y === y).sort((a, b) => a.x - b.x)[0]!.texto);
    expect(codigos).toEqual(["A85", "A14", "A01"]);
  });

  it("valores da tabela: vírgula perdida, 7 lido como barra, barra no lugar da vírgula; fora da tabela nada muda", () => {
    const p = recomporValoresTabela([pal("2023", 574, 39), ...cabecalho(100), pal("29845", 250, 110), pal("000", 300, 110), pal("00", 350, 110),
      pal("877/80", 400, 110), pal("8//80", 450, 110), pal("NR0001", 62, 110), pal("12/05/2026", 300, 200)]);
    expect(p.map((x) => x.texto)).toEqual(["2023", ...cabecalho(100).map((x) => x.texto), "298,45", "0,00", "0,00", "877,80", "877,80", "NR0001", "12/05/2026"]);
  });

  it("uma célula perdida na linha: o valor sai do total impresso, no mês da coluna vazia", () => {
    const cab = cabecalho(100);
    const centro = (m: string) => { const c = cab.find((x) => x.texto === m)!; return c.x + c.largura / 2; };
    const valores = MESES_CAB.filter((m) => m !== "Mar").map((m) => pal(m === "Total" ? "5.508,00" : "459,00", centro(m) - 10, 110));
    const p = completarCelulaPerdida([...cab, pal("A03", 51, 110), ...valores]);
    const novo = p.find((x) => x.y === 110 && Math.abs(x.x + x.largura / 2 - centro("Mar")) < 1);
    expect(novo?.texto).toBe("459,00");
    // duas células perdidas: não adivinha
    expect(completarCelulaPerdida([...cab, ...valores.slice(1)])).toHaveLength(cab.length + 11);
  });

  it("caixa em pixels → posição em pontos; descarta o ruído de baixa confiança", () => {
    const p = palavrasDoOcr([
      { texto: "NRO001", confianca: 90, x0: 30, y0: 300, x1: 120, y1: 321, base: 318 },
      { texto: "~", confianca: 10, x0: 0, y0: 0, x1: 5, y1: 5 },
    ], 3, 1);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ texto: "NR0001", x: 10, y: 106, largura: 30, pagina: 1 });
  });
});

describe("ficha digitada à mão", () => {
  const lida: FichaLida = {
    ano: 2023, sistema: "sippes", linhas: [
      { codigo: "NR0001", descricao: "SOLDO", meses: doze(6000) },
      { codigo: "NR0003", descricao: "ADIC HAB", meses: doze(720) },
      { codigo: "NR0014", descricao: "ADIC MIL", meses: doze(1200) },
      { codigo: "NR0084", descricao: "13 1ª", meses: [0, 0, 0, 0, 0, 3000, 0, 0, 0, 0, 0, 0] },
      { codigo: "NR0085", descricao: "13 2ª", meses: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4920] },
    ], origem: "ocr", conferencia: { linhas: ["NR0003"], meses: [3] },
  };

  it("lê os campos da ficha (13º = as parcelas somadas)", () => {
    const v = valoresDaFicha(lida);
    expect(v.meses.soldo[0]).toBe(6000);
    expect(v.meses.adicional[2]).toBe(720);
    expect(v.decimo).toBe(7920);
    expect(v.origem).toBe("ocr");
  });

  it("corrige só o mês alterado e mantém as demais linhas; o 13º alterado vai inteiro para dezembro", () => {
    const v = valoresDaFicha(lida);
    v.meses.adicional[2] = 702;
    const d = fichaDigitadaValida({ meses: v.meses, decimo: 7900 })!;
    const [f] = aplicarFichaDigitada([lida], 2023, d);
    expect(f!.linhas.find((l) => l.codigo === "NR0003")!.meses.slice(1, 4)).toEqual([720, 702, 720]);
    expect(f!.linhas.find((l) => l.codigo === "NR0014")!.meses[0]).toBe(1200);
    expect(f!.linhas.find((l) => l.codigo === "NR0084")).toBeUndefined();
    expect(f!.linhas.find((l) => l.codigo === "NR0085")!.meses[11]).toBe(7900);
    expect(f!.editada).toBe(true);
    expect(f!.origem).toBe("ocr");
  });

  it("ano sem ficha: cria a ficha digitada com os códigos do SIPPES (o estorno vai nos descontos)", () => {
    const meses = { soldo: doze(5000), adicional: doze(600), atrasado: doze(0), estorno: [0, 0, 0, 600, 0, 0, 0, 0, 0, 0, 0, 0] };
    const fichas = aplicarFichaDigitada([lida], 2022, fichaDigitadaValida({ meses, decimo: 0 })!);
    const f = fichas.find((x) => x.ano === 2022)!;
    expect(fichas.map((x) => x.ano)).toEqual([2022, 2023]);
    expect(f.origem).toBe("manual");
    expect(f.linhas.map((l) => l.codigo)).toEqual(["NR0001", "NR0003"]);
    expect(f.descontos).toEqual([{ codigo: "DR0003", descricao: "ADIC HABILITACAO (DESCONTO)", meses: meses.estorno }]);
  });

  it("recusa valor negativo ou fora do formato", () => {
    expect(fichaDigitadaValida({ meses: { soldo: doze(-1), adicional: doze(0), atrasado: doze(0), estorno: doze(0) }, decimo: 0 })).toBeNull();
    expect(["1.234,56", "1234,5", "1234.56", "6.000", "", "R$ 10,00"].map(numeroBr)).toEqual([1234.56, 1234.5, 1234.56, 6000, 0, 10]);
    expect(Number.isNaN(numeroBr("12a"))).toBe(true);
  });
});

describe("avisos exatos do que falta", () => {
  it("ano sem ficha, com os meses do período; meses sem soldo numa ficha lida por OCR", () => {
    const fichas: FichaLida[] = [{ ano: 2022, sistema: "sippes", origem: "ocr", linhas: [{ codigo: "NR0001", descricao: "SOLDO", meses: [0, 0, 0, 0, 0, 0, 0, 0, 0, 6000, 6000, 6000] }] }];
    const f = faltasDasFichas(fichas, "2021-03-15", "2022-12-31");
    expect(f[0]).toMatch(/^Ficha financeira de 2021 \(meses do período: MAR a DEZ\/2021\)/);
    expect(f[1]).toMatch(/^Soldo \(NR0001\/A01\) de JAN, FEV, MAR, ABR, MAIO, JUN, JUL, AGO, SET\/2022: a ficha de 2022 \(lida por OCR\)/);
  });

  it("OCR: linha essencial incompleta, adicional ausente e totais líquidos não lidos viram aviso exato", () => {
    const soldo = { codigo: "NR0001", descricao: "SOLDO", meses: doze(6000) };
    expect(faltasDaLeituraOcr([{ ano: 2023, sistema: "sippes", origem: "ocr", linhas: [soldo], conferencia: { linhas: [], meses: [], incompletas: ["NR0003"] } }]))
      .toEqual(["Ficha de 2023 (lida por OCR): a linha NR0003 (adicional de habilitação pago) não foi reconhecida inteira. Digite os 12 meses em “Digitar valores da ficha”, abaixo; sem isso, a análise toma o valor como não pago."]);
    expect(faltasDaLeituraOcr([{ ano: 2023, sistema: "sippes", origem: "ocr", linhas: [soldo] }])[0]).toMatch(/a linha do adicional de habilitação pago \(NR0003\/A03\) não foi encontrada/);
    expect(conferenciaDasFichas([{ ano: 2023, sistema: "sippes", origem: "ocr", linhas: [soldo], conferencia: { linhas: [], meses: [], semTotais: true } }])[0])
      .toMatch(/a linha dos totais líquidos não foi lida/);
  });

  it("conferência da leitura por OCR e da ficha digitada", () => {
    const c = conferenciaDasFichas([
      { ano: 2023, sistema: "sippes", linhas: [], origem: "ocr", arquivo: "ficha 2023.pdf", conferencia: { linhas: ["NR0003"], meses: [3, 4] } },
      { ano: 2024, sistema: "sippes", linhas: [], origem: "manual" },
    ]);
    expect(c[0]).toBe("Ficha de 2023 lida por OCR (ficha 2023.pdf): a soma dos meses não bate com o total impresso na linha NR0003; receitas menos descontos não fecham com o líquido em MAR, ABR. Algum número foi mal reconhecido: compare com a ficha e corrija em “Digitar valores da ficha” (os meses a conferir ficam destacados).");
    expect(c[1]).toMatch(/^Ficha de 2024 digitada à mão/);
  });

  it("sem fichas e sem dados: diz exatamente o quê e onde informar", () => {
    const a = analisarAdicHab({ fichas: [], inicio: "2021-03-15", fim: "2021-12-31", dados: {}, hoje: "2026-11-27" });
    expect(a.pronta).toBe(false);
    expect(a.faltas).toEqual([
      "Tipo do curso (formação, especialização, aperfeiçoamento ou altos estudos): não identificado no requerimento nem no BI lidos. Informe em “Dados do direito”, abaixo.",
      "Ficha financeira de 2021 (meses do período: MAR a DEZ/2021): soldo (NR0001/A01) e adicional de habilitação pago (NR0003/A03) de cada mês. Carregue o PDF da ficha (o escaneado é lido por OCR) ou digite os valores em “Digitar valores da ficha”, abaixo.",
    ]);
  });
});
