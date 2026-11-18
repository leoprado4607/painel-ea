import { describe, expect, it } from "vitest";
import { anoDoNumeroProcesso, mascaraNumeroProcesso, numeroProcessoValido } from "./numero-processo";

describe("máscara do Nº do processo", () => {
  it("formata 00000.000000/0000-00 enquanto digita e corta o excesso", () => {
    expect(mascaraNumeroProcesso("6409300367220252")).toBe("64093.003672/2025-2");
    expect(mascaraNumeroProcesso("64093003672202524")).toBe("64093.003672/2025-24");
    expect(mascaraNumeroProcesso("64093.003672/2025-2499")).toBe("64093.003672/2025-24");
    expect(mascaraNumeroProcesso("64093a")).toBe("64093");
    expect(mascaraNumeroProcesso("640930")).toBe("64093.0");
  });
  it("só aceita o formato completo", () => {
    expect(numeroProcessoValido("64093.003672/2025-24")).toBe(true);
    expect(numeroProcessoValido("64093.003672/2025-2")).toBe(false);
    expect(numeroProcessoValido("64093003672202524")).toBe(false);
  });
  it("ano do processo: os 4 números antes do -00", () => {
    expect(anoDoNumeroProcesso("64093.003672/2025-24")).toBe("2025");
    expect(anoDoNumeroProcesso("64093.003672/2025-2")).toBeNull();
  });
});
