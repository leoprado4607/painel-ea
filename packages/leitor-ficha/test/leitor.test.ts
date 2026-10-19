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
