/** Ficha sintética (dados inventados) montada palavra a palavra, no layout do SIPPES. */
import { describe, expect, it } from "vitest";
import { lerFicha, lerValor, type Palavra } from "../src/leitor";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Maio", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const xMes = (i: number) => 150 + i * 42;
let y = 0;
const linha = (pal: [string, number][], dy = 10): Palavra[] => {
  y += dy;
  return pal.map(([texto, x]) => ({ texto, x, y, largura: texto.length * 4, pagina: 1 }));
};
const valores = (v: string[]) => v.map((t, i) => [t, xMes(i)] as [string, number]);

function fichaSintetica(totalJan = "4.850,00"): Palavra[] {
  y = 0;
  return [
    ...linha([["FICHA", 300], ["FINANCEIRA", 330]]),
    ...linha([["Ano", 300], ["2024", 320], ["(MOEDA:", 340], ["REAL)", 380]]),
    ...linha([["1º", 40], ["SGT", 52], ["NOME:", 120], ["FULANO", 150], ["DE", 185], ["TAL", 200]]),
    ...linha([["PREC/CP:", 40], ["123456789", 80], ["IDENTIDADE:", 150], ["0000000000", 200], ["CPF:", 260], ["00000000000", 280]]),
    ...linha([["CODOM:", 40], ["001420", 80], ["RM:", 150], ["10", 170], ["SIGLA", 220], ["UA:", 250], ["B", 270], ["ADM", 280]]),
    ...linha([["Código", 40], ["Descrição", 80], ...MESES.map((m, i) => [m, xMes(i)] as [string, number]), ["Total", 660]]),
    ...linha([["NR0001", 40], ["SOLDO", 80], ...valores(["5.000,00", ...Array(11).fill("5.000,00")]), ["60.000,00", 660]]),
    // descrição em 3 linhas, com o código na do meio
    ...linha([["ADICIONAL", 80]]),
    ...linha([["NR0003", 40], ["DE", 80], ...valores(Array(12).fill("100,00")), ["1.200,00", 660]]),
    ...linha([["HABILITACAO", 80]]),
    ...linha([["PENSAO", 80]]),
    ...linha([["MILITAR", 80]]),
    ...linha([["ND0002", 40], ...valores(Array(12).fill("250,00")), ["3.000,00", 660]]),
    ...linha([["MILITAR", 80]]),
    ...linha([["CARREIRA", 80]]),
    ...linha([["TOTAIS", 60], ["LÍQUIDOS", 90], ...valores([totalJan, ...Array(11).fill("4.850,00")]), ["58.200,00", 660]]),
  ];
}

describe("leitor da ficha (sintética)", () => {
  it("lê cabeçalho, linhas e descrições em várias linhas", () => {
    const f = lerFicha(fichaSintetica());
    expect(f.ano).toBe(2024);
    expect(f.cabecalho).toMatchObject({ posto: "1º SGT", nome: "FULANO DE TAL", precCp: "123456789", codom: "001420", rm: "10", siglaUa: "B ADM" });
    expect(f.linhas.map((l) => [l.codigo, l.descricao, l.natureza])).toEqual([
      ["NR0001", "SOLDO", "receita"],
      ["NR0003", "ADICIONAL DE HABILITACAO", "receita"],
      ["ND0002", "PENSAO MILITAR MILITAR CARREIRA", "desconto"],
    ]);
    expect(f.linhas[0]!.meses).toHaveLength(12);
    expect(f.conferencias.ok).toBe(true);
    expect(f.avisos).toEqual([]);
  });

  it("acusa quando receitas − descontos não bate com TOTAIS LÍQUIDOS", () => {
    const f = lerFicha(fichaSintetica("4.851,00"));
    expect(f.conferencias.mesesDivergentes).toEqual([1]);
    expect(f.conferencias.ok).toBe(false);
  });

  it("lê valores no formato brasileiro", () => {
    expect(lerValor("11.088,00")).toBe(11088);
    expect(lerValor("-0,32")).toBe(-0.32);
  });
});

describe("códigos do SIPPES", () => {
  it("natureza pela 2ª letra, invertida na devolução (1ª letra D)", async () => {
    const { naturezaDoCodigo, CODIGO_SIPPES } = await import("../src/leitor");
    expect(["NR0001", "AR0084", "FR0077", "DD0013"].map(naturezaDoCodigo)).toEqual(["receita", "receita", "receita", "receita"]);
    expect(["ND0001", "AD0003", "DR0001"].map(naturezaDoCodigo)).toEqual(["desconto", "desconto", "desconto"]);
    expect(["FR0077", "DD0013", "NR0001"].every((c) => CODIGO_SIPPES.test(c))).toBe(true);
    expect(["XX0001", "NR001", "TOTAIS"].some((c) => CODIGO_SIPPES.test(c))).toBe(false);
  });
});

/** Ficha do SIAPPES sintética (dados inventados): dois anos no mesmo PDF, o 2º com a tabela continuando na página 2. */
function fichaSiappesSintetica(): Palavra[] {
  const palavras: Palavra[] = [];
  let yy = 0, pg = 1;
  const l = (pal: [string, number][]) => { yy += 10; palavras.push(...pal.map(([texto, x]) => ({ texto, x, y: yy, largura: texto.length * 4, pagina: pg }))); };
  const cab = (ano: number) => {
    l([["MINISTÉRIO", 9], ["DA", 50], ["DEFESA", 60]]);
    l([["Ano", 390], [String(ano), 405], ["(MOEDA:", 425], ["REAL)", 455]]);
    l([["19", 9], ["(", 20], ["PRIMEIRO-SARGENTO", 25], [")", 100], ["NOME:", 110], ["FULANO", 140], ["DE", 175], ["TAL", 190]]);
    l([["Prec/CP:", 11], ["123456789", 45], ["Identidade:", 100], ["EB0000000001", 140], ["CPF:", 200], ["00000000000", 220]]);
    l([["CODOM:", 11], ["001420", 45], ["RM:", 100], ["10", 115], ["SIGLA", 140], ["UA:", 165], ["B", 180], ["ADM", 190]]);
  };
  const tabela = () => l([["Cód.", 8], ["Descrição", 40], ...MESES.map((m, i) => [m, xMes(i)] as [string, number]), ["T", 660], ["otal", 664]]);
  const row = (cod: string, desc: string[], v: string, total: string) =>
    l([[cod, 9], ...desc.map((d, i) => [d, 40 + i * 25] as [string, number]), ...valores(Array(12).fill(v)), [total, 660]]);
  cab(2022); tabela();
  row("A01", ["SOLDO"], "1.000,00", "12.000,00");
  row("G07", ["DA", "G", "L"], "10,00", "120,00");
  row("Z05", ["P", "MIL"], "15,00", "180,00");
  l([["TOT", 49], ["AL", 62], ...valores(Array(12).fill("975,00")), ["---", 660]]);
  cab(2021); tabela();
  row("A01", ["SOLDO"], "900,00", "10.800,00");
  pg = 2; yy = 0; tabela();
  row("ZM5", ["DESC", "DEP", "FUSEX"], "20,00", "240,00");
  row("603", ["CMDO", "2", "BDA"], "8,00", "96,00");
  l([["TOT", 49], ["AL", 62], ...valores(Array(12).fill("872,00")), ["---", 660]]);
  return palavras;
}

describe("leitor da ficha do SIAPPES (sintética)", () => {
  it("reconhece o formato e devolve uma ficha por ano", async () => {
    const { ehFichaSiappes, lerFichasSiappes } = await import("../src/leitor");
    expect(ehFichaSiappes(fichaSiappesSintetica())).toBe(true);
    expect(ehFichaSiappes(fichaSintetica())).toBe(false);
    const [a, b] = lerFichasSiappes(fichaSiappesSintetica());
    expect([a!.ano, b!.ano]).toEqual([2022, 2021]);
    expect(a!.sistema).toBe("siappes");
    expect(a!.cabecalho).toMatchObject({ posto: "PRIMEIRO SARGENTO", nome: "FULANO DE TAL", precCp: "123456789", identidade: "0000000001", codom: "001420" });
    expect(a!.linhas.map((l) => [l.codigo, l.descricao, l.natureza])).toEqual([
      ["A01", "SOLDO", "receita"], ["G07", "DA G L", "desconto"], ["Z05", "P MIL", "desconto"],
    ]);
    expect(b!.linhas.map((l) => l.codigo)).toEqual(["A01", "ZM5", "603"]);
    expect([a!.conferencias.ok, b!.conferencias.ok]).toEqual([true, true]);
    expect([...a!.avisos, ...b!.avisos]).toEqual([]);
  });
});
