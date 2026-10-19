import { describe, expect, it } from "vitest";
import { buscarSerie, FONTES, lerSgs, lerSidra, planejar, validar } from "./ipca";

// Trechos reais das respostas (17/10/2026)
const SIDRA = [
  { NC: "Nível Territorial (Código)", V: "Valor", D3C: "Mês (Código)" },
  { NC: "1", MN: "%", V: "0.07", D2C: "63", D3C: "202607", D3N: "julho 2026" },
  { NC: "1", MN: "%", V: "-0.32", D2C: "63", D3C: "202608", D3N: "agosto 2026" },
  { NC: "1", MN: "%", V: "...", D2C: "63", D3C: "202610", D3N: "outubro 2026" },
];
const SGS = [{ data: "01/07/2026", valor: "0.07" }, { data: "01/08/2026", valor: "-0.32" }, { data: "01/09/2026", valor: "0.82" }];

describe("leitura das fontes", () => {
  it("SIDRA: ignora cabeçalho e meses sem valor", () => {
    expect(lerSidra(SIDRA, "IPCA", "sidra")).toEqual([
      { serie: "IPCA", ano: 2026, mes: 7, percentual: 0.07, fonte: "sidra" },
      { serie: "IPCA", ano: 2026, mes: 8, percentual: -0.32, fonte: "sidra" },
    ]);
  });
  it("SGS", () => {
    expect(lerSgs(SGS, "IPCA", "sgs").map((x) => [x.ano, x.mes, x.percentual])).toEqual([[2026, 7, 0.07], [2026, 8, -0.32], [2026, 9, 0.82]]);
  });
  it("URLs das fontes", () => {
    expect(FONTES.IPCA[0]!.url({ ano: 2026, mes: 1 })).toBe("https://apisidra.ibge.gov.br/values/t/1737/n1/all/v/63/p/202601-209912");
    expect(FONTES["IPCA-E"][0]!.url({ ano: 2025, mes: 10 })).toBe("https://api.bcb.gov.br/dados/serie/bcdata.sgs.10764/dados?formato=json&dataInicial=01/10/2025");
  });
});

describe("validação", () => {
  it("recusa valor implausível ou com mais de 2 casas", () => {
    expect(() => validar([{ serie: "IPCA", ano: 2026, mes: 9, percentual: 82, fonte: "x" }])).toThrow(/implausível/);
    expect(() => validar([{ serie: "IPCA", ano: 2026, mes: 9, percentual: 0.825, fonte: "x" }])).toThrow(/casas/);
  });
});

describe("planejamento da gravação", () => {
  it("separa meses novos e revisões", () => {
    const lidos = lerSgs(SGS, "IPCA", "sgs");
    const p = planejar(lidos, [{ ano: 2026, mes: 7, percentual: 0.07 }, { ano: 2026, mes: 8, percentual: -0.4 }]);
    expect(p.novos.map((x) => x.mes)).toEqual([9]);
    expect(p.revisados).toEqual([expect.objectContaining({ mes: 8, percentual: -0.32, anterior: -0.4 })]);
  });
});

describe("busca com reserva", () => {
  it("usa a 2ª fonte quando a 1ª falha", async () => {
    const r = await buscarSerie("IPCA", { ano: 2026, mes: 7 }, async (url) => {
      if (url.includes("sidra")) throw new Error("timeout");
      return SGS;
    });
    expect(r.fonte).toBe("BCB/SGS 433");
    expect(r.erros[0]).toMatch(/SIDRA.*timeout/);
    expect(r.indices).toHaveLength(3);
  });
  it("falha com a lista de erros quando nenhuma fonte responde", async () => {
    await expect(buscarSerie("IPCA-E", { ano: 2026, mes: 1 }, async () => { throw new Error("offline"); })).rejects.toThrow(/nenhuma fonte.*offline.*offline/);
  });
});
