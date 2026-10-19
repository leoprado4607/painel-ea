import { describe, expect, it } from "vitest";
import { ABAS, abaAtiva, enderecoAba, processoDoCaminho } from "./abas";

const ID = "3f0a8d7e-1c2b-4d5e-8f90-a1b2c3d4e5f6";

describe("abas do rodapé", () => {
  it("seguem a ordem pedida: passo a passo, IPCA-E, OM, operadores, favorecido e as abas da planilha", () => {
    expect(ABAS.slice(0, 5).map((a) => a.rotulo)).toEqual(["Passo a passo", "Atualização do IPCA-E", "Dados da OM", "Operadores", "Dados do favorecido"]);
    expect(ABAS.find((a) => a.rotulo === "Operadores")?.soAdmin).toBe(true);
  });
  it("identifica a aba ativa e o processo pelo endereço", () => {
    expect(abaAtiva(`/processos/${ID}/cpex`)?.rotulo).toBe("CPEX");
    expect(abaAtiva("/om")?.rotulo).toBe("Dados da OM");
    expect(abaAtiva("/processos")).toBeUndefined();
    expect(processoDoCaminho(`/processos/${ID}/dados`)).toBe(ID);
    expect(processoDoCaminho("/processos/novo")).toBeNull();
  });
  it("aba do processo sem processo aberto não tem endereço", () => {
    const cpex = ABAS.find((a) => a.caminho === "cpex")!;
    expect(enderecoAba(cpex, ID)).toBe(`/processos/${ID}/cpex`);
    expect(enderecoAba(cpex, null)).toBeNull();
    expect(enderecoAba(ABAS[0]!, null)).toBe("/passo-a-passo");
  });
});
