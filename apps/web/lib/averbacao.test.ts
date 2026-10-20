import { describe, expect, it } from "vitest";
import { numeroBoletimValido, textoBoletim } from "./averbacao";

const base = { documento_averbacao: null, adt_numero: null, bi_numero: null, om_averbacao: null, bi_data: null };

describe("averbação", () => {
  it("Nr BI/BAR tem exatamente 3 dígitos", () => {
    expect(numeroBoletimValido("045")).toBe(true);
    expect(["45", "0451", "04a", ""].some(numeroBoletimValido)).toBe(false);
  });
  it("monta o texto do boletim para o Verso", () => {
    expect(textoBoletim({ ...base, documento_averbacao: "Adt", adt_numero: "12", bi_numero: "045", om_averbacao: "17º GAC", bi_data: "2026-09-20" }))
      .toBe("Adt 12 ao BI 045 - 17º GAC, de 20/09/2026");
    expect(textoBoletim({ ...base, documento_averbacao: "BAR", bi_numero: "045", om_averbacao: "B Adm Gu Natal", bi_data: "2026-09-20" }))
      .toBe("BAR 045 - B Adm Gu Natal, de 20/09/2026");
    expect(textoBoletim({ ...base, documento_averbacao: "BI", bi_numero: "180" })).toBe("BI 180");
    expect(textoBoletim({ ...base, bi_numero: "180", bi_data: "2026-09-20" })).toBe("BI/Adt 180, de 20/09/2026"); // processo antigo
    expect(textoBoletim(base)).toBe("");
  });
});
