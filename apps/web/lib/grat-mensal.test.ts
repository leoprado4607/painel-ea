import { describe, expect, it } from "vitest";
import { ESPECIE_GLE, ESPECIE_GR_CMDO, gratMensalAutomatico, planoGratMensal, rubricasGratMensal } from "./grat-mensal";
import { sugerirLocalidade } from "./localidades-especiais";
import type { FichaLida } from "./receitas";

const linha = (codigo: string, meses: Record<number, number>) =>
  ({ codigo, descricao: codigo, meses: Array.from({ length: 12 }, (_, i) => meses[i + 1] ?? 0) });
const ficha = (ano: number, ...linhas: ReturnType<typeof linha>[]): FichaLida => ({ ano, sistema: "sippes", linhas });
const hoje = "2026-11-25";
const corrigir = (v: number, fator: number) => Math.round(v * (1 + fator / 100) * 100) / 100;

describe("gratificações mensais (localidade especial e comando)", () => {
  it("só nos processos novos e com uma das duas espécies", () => {
    expect(gratMensalAutomatico({ especie_divida: ESPECIE_GLE, complementos: { calculoAutomaticoGratMensal: true } })).toBe(true);
    expect(gratMensalAutomatico({ especie_divida: ESPECIE_GR_CMDO, complementos: { calculoAutomaticoGratMensal: true } })).toBe(true);
    expect(gratMensalAutomatico({ especie_divida: ESPECIE_GLE, complementos: {} })).toBe(false);
  });

  it("pago (NUP 64360.000191/2026-41): ST Laryerferson, Op CATRIMANI II em Boa Vista-RR, 20 a 31 DEZ 25, categoria A", () => {
    const p = planoGratMensal({
      fichas: [ficha(2025, linha("NR0001", { 12: 6447 }))], especie: ESPECIE_GLE, inicio: "2025-12-20", fim: "2025-12-31", hoje,
      dados: { local: "Boa Vista-RR", documento: "Adt nº 198 do EM Cj da Op CATRIMANI II, de 01/01/2026" },
    });
    expect(p.localidade).toBe("A"); // sugerida: RR fica a oeste da linha Alfa
    expect(p.rubrica).toBe("A07 - G LOC ESP TP A");
    expect(p.categoria).toBe("s-ten");
    expect(p.devidos).toEqual([{ ano: 2025, mes: 12, valor: 499.12 }]); // 20% × 6.447,00 × 12/31
    expect(corrigir(499.12, 3.7045)).toBeCloseTo(517.61, 1);
    expect(p.pendencias.join(" ")).toMatch(/Confirme a categoria A/);
  });

  it("comando: 10% do soldo por mês, meses cheios inteiros e os incompletos proporcionais", () => {
    const p = planoGratMensal({
      fichas: [], especie: ESPECIE_GR_CMDO, inicio: "2024-03-16", fim: "2024-05-10", hoje, dados: { categoria: "cap" },
    });
    expect(p.rubrica).toBe("A16 - GRAT REP 10%");
    // 913,50/mês (Cap 2024: 9.135,00): mar 16/31, abr cheio, mai 10/31
    expect(p.devidos).toEqual([{ ano: 2024, mes: 3, valor: 471.48 }, { ano: 2024, mes: 4, valor: 913.5 }, { ano: 2024, mes: 5, valor: 294.68 }]);
  });

  it("sugestão da categoria pela Portaria GM-MD 379/2022", () => {
    expect(sugerirLocalidade("Boa Vista-RR")?.categoria).toBe("A");
    expect(sugerirLocalidade("Cuiabá - MT")?.categoria).toBe("B"); // Tabela II
    expect(sugerirLocalidade("Natal/RN")?.categoria).toBeNull(); // Tabela III
    expect(sugerirLocalidade("Caicó-RN")?.categoria).toBe("B");
    expect(sugerirLocalidade("Uruguaiana-RS")?.categoria).toBe("B");
    expect(sugerirLocalidade("Porto Alegre-RS")?.categoria).toBeNull();
    expect(sugerirLocalidade("sem UF")).toBeNull();
  });

  it("escolha diferente da sugestão vira alerta; lançamento da ficha só entra marcado", () => {
    const fichas = [ficha(2023, linha("NR0001", { 6: 9135, 7: 9135 }), linha("NR0008", { 7: 913.5 }))];
    const p = planoGratMensal({ fichas, especie: ESPECIE_GLE, inicio: "2023-06-01", fim: "2023-07-31", hoje, dados: { local: "Manaus-AM", localidade: "B" } });
    expect(p.alertas.map((a) => a.codigo)).toEqual(expect.arrayContaining(["CATEGORIA_LOCALIDADE", "POSSIVEL_DUPLICIDADE"]));
    const q = planoGratMensal({ fichas, especie: ESPECIE_GLE, inicio: "2023-06-01", fim: "2023-07-31", hoje, dados: { local: "Manaus-AM", localidade: "B", considerados: ["2023-7-NR0008"] } });
    expect(q.recebidos).toEqual([{ ano: 2023, mes: 7, valor: 913.5 }]);
    expect(q.devidos).toEqual([{ ano: 2023, mes: 6, valor: 913.5 }, { ano: 2023, mes: 7, valor: 913.5 }]);
  });

  it("rubrica na posição 1 vazia", () => {
    const vazias = Array.from({ length: 17 }, (_, i) => ({ posicao: i + 1, codigo: "", tipo: i >= 12 ? "Despesa" : "Receita" }));
    expect(rubricasGratMensal(vazias, "A07 - G LOC ESP TP A").posicao).toBe(1);
  });
});
