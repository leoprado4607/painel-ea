import { describe, expect, it } from "vitest";
import { chaveDoNome, nomesRepetidos } from "./nomes-repetidos";

const cards = (...nomes: string[]) => nomes.map((nomeCompleto) => ({ nomeCompleto }));

describe("nomes repetidos em Meus cálculos", () => {
  it("compara o nome completo sem acento, maiúsculas ou espaços extras", () => {
    const r = nomesRepetidos(cards("JOÃO DA SILVA", "Joao  da Silva", "MARIA DA SILVA"));
    expect([...r]).toEqual([chaveDoNome("JOÃO DA SILVA")]);
  });
  it("nome parecido, mas não igual, não é repetido", () => {
    expect(nomesRepetidos(cards("JOAO DA SILVA", "JOAO DA SILVA JUNIOR")).size).toBe(0);
  });
  it("nome em branco ou não lido não conta como repetido", () => {
    expect(nomesRepetidos(cards("", "", "(nome não lido)", "(nome não lido)")).size).toBe(0);
  });
});
