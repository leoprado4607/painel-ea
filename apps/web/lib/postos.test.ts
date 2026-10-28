import { describe, expect, it } from "vitest";
import { abreviarPosto, nomeNaAssinatura, separarPosto } from "./postos";

describe("posto/graduação nas assinaturas", () => {
  it("abrevia no padrão, escrito de qualquer forma", () => {
    expect(["MAJOR", "maj", "Maj."].map(abreviarPosto)).toEqual(["Maj", "Maj", "Maj"]);
    expect(["PRIMEIRO SARGENTO", "1º SGT", "Primeiro-Sargento", "1o Sgt"].map(abreviarPosto)).toEqual(["1º Sgt", "1º Sgt", "1º Sgt", "1º Sgt"]);
    expect(["TC", "Tenente-Coronel", "SUBTENENTE", "cabo", "Cabo Engajado", "Sd EP", "sd ev"].map(abreviarPosto)).toEqual(["Ten Cel", "Ten Cel", "S Ten", "Cb", "Cb", "Sd EP", "Sd EV"]);
    expect(abreviarPosto("General")).toBeNull();
  });

  it("separa nome e posto do texto do Ordenador (posto no fim, depois do traço, ou no começo)", () => {
    expect(separarPosto("LEONARDO PRADO DO MONTE BORGES - MAJ")).toEqual({ nome: "LEONARDO PRADO DO MONTE BORGES", posto: "Maj" });
    expect(separarPosto("Ten Cel Fulano de Tal")).toEqual({ nome: "Fulano de Tal", posto: "Ten Cel" });
    expect(separarPosto("Fulano de Tal Tenente Coronel")).toEqual({ nome: "Fulano de Tal", posto: "Ten Cel" });
    expect(separarPosto("Fulano de Tal")).toEqual({ nome: "Fulano de Tal", posto: null });
  });

  it("monta 'NOME - Posto'", () => {
    expect(nomeNaAssinatura("LEONARDO PRADO DO MONTE BORGES - MAJ")).toBe("LEONARDO PRADO DO MONTE BORGES - Maj");
    expect(nomeNaAssinatura("Bruno Guilherme de Souza Bezerra", "CB")).toBe("BRUNO GUILHERME DE SOUZA BEZERRA - Cb");
    expect(nomeNaAssinatura("Fulano", null)).toBe("FULANO");
    expect(nomeNaAssinatura("", "Cb")).toBeNull();
  });
});

it("posto por extenso vira abreviado em documentos e telas; desconhecido fica como veio", async () => {
  const { postoAbreviado } = await import("./postos");
  expect(["PRIMEIRO SARGENTO", "MAJOR", "1º SGT", "Coronel PM", null].map(postoAbreviado)).toEqual(["1º Sgt", "Maj", "1º Sgt", "Coronel PM", null]);
});
