import { describe, expect, it } from "vitest";
import { diasDoEvento, gratRepAutomatico, planoGratRep, rubricasGratRep, RUBRICA_GRAT_REP } from "./grat-rep";
import type { FichaLida } from "./receitas";
import { soldoNaData } from "./soldos";
import { quantidadeMeses } from "./tipos";

const linha = (codigo: string, meses: Record<number, number>) =>
  ({ codigo, descricao: codigo, meses: Array.from({ length: 12 }, (_, i) => meses[i + 1] ?? 0) });
const ficha = (ano: number, ...linhas: ReturnType<typeof linha>[]): FichaLida => ({ ano, sistema: "sippes", linhas });
/** Correção como no motor: arredonda só no fim. */
const corrigir = (v: number, fator: number) => Math.round(v * (1 + fator / 100) * 100) / 100;
const hoje = "2026-11-23";

describe("Gratificação de Representação automática", () => {
  it("só com a espécie e nos processos criados depois da mudança", () => {
    const especie_divida = "Gratificação de Representação";
    expect(gratRepAutomatico({ especie_divida, complementos: { calculoAutomaticoGratRep: true } })).toBe(true);
    expect(gratRepAutomatico({ especie_divida, complementos: { calculoAutomatico: true } })).toBe(false);
    expect(gratRepAutomatico({ especie_divida: "Auxílio Transporte", complementos: { calculoAutomaticoGratRep: true } })).toBe(false);
  });

  it("caso 1 (NUP 64552.003413/2025-49): Cb Ef Profl, 9 dias, divergência e possível duplicidade", () => {
    const fichas = [
      ficha(2023, linha("NR0001", { 8: 2627, 9: 2627 }), linha("AR0061", { 12: 420.32 })),
      ficha(2025, linha("AR0061", { 1: 472.86 })),
    ];
    const p = planoGratRep({
      fichas, inicio: "2023-08-26", fim: "2023-09-03", hoje, dataRequerimento: "2025-06-10",
      dados: { horaSaida: "12:00", horaRetorno: "09:00", autorizacao: { dias: 8, valor: 420.32, publicacao: "2024-03-05" }, despachoOd: true, bisConferidos: true },
    });
    expect(p.categoria).toBe("cb-eng");
    expect(p.soldo).toBe(2627);
    expect(p.valorDiario).toBe(52.54);
    expect(p.dias).toBe(9);
    expect(p.devido).toBe(472.86);
    expect(p.devidos).toEqual([{ ano: 2023, mes: 8, valor: 472.86 }]);
    expect(p.recebidos).toEqual([]);
    expect(quantidadeMeses("2023-08-26", "2023-09-03")).toBe(2);
    expect(corrigir(p.devido!, 14.8895)).toBe(543.27);
    expect(p.alertas.map((a) => a.codigo)).toEqual(["DIVERGENCIA_AUTORIZACAO", "POSSIVEL_DUPLICIDADE", "POSSIVEL_DUPLICIDADE"]);
    expect(p.lancamentosGr.map((l) => l.chave)).toEqual(["2023-12-AR0061", "2025-1-AR0061"]);
    expect(p.textos.explicacao).toContain("no exercício seguinte ao fato gerador (26/08/2023 a 03/09/2023)");
    expect(p.notas["2023-8"]).toContain("R$ 2.627,00 × 2% = R$ 52,54 por dia × 9 dia(s)");
  });

  it("caso 2 (NUP 64552.004696/2025-46): Sd Ef Vrv (hoje Cb EP), 10 dias, divergência com a autorização", () => {
    const fichas = [ficha(2022, linha("NR0001", { 8: 1078 }))];
    const p = planoGratRep({
      fichas, inicio: "2022-08-14", fim: "2022-08-23", hoje,
      dados: { horaSaida: "12:00", horaRetorno: "13:30", autorizacao: { dias: 9, valor: 194.04 } },
    });
    expect(p.categoria).toBe("sd-ev");
    expect(p.categoriaSugerida).toBe(true);
    expect(p.valorDiario).toBe(21.56);
    expect(p.dias).toBe(10);
    expect(p.devido).toBe(215.6);
    expect(quantidadeMeses("2022-08-14", "2022-08-23")).toBe(1);
    expect(corrigir(p.devido!, 17.2122)).toBe(252.71);
    expect(p.alertas.map((a) => a.codigo)).toEqual(["DIVERGENCIA_AUTORIZACAO"]);
    expect(p.pendencias.join(" ")).toContain("Confirme o posto/graduação");
  });

  it("recebidos só os marcados: no período, no mês; depois do fim, após o período", () => {
    const fichas = [ficha(2023, linha("NR0001", { 8: 2627 }), linha("AR0061", { 9: 100, 12: 420.32 }))];
    const p = planoGratRep({
      fichas, inicio: "2023-08-26", fim: "2023-09-03", hoje,
      dados: { categoria: "cb-eng", considerados: ["2023-9-AR0061", "2023-12-AR0061"] },
    });
    expect(p.recebidos).toEqual([{ ano: 2023, mes: 9, valor: 100 }]);
    expect(p.posPeriodo).toEqual([{ ano: 2023, mes: 12, valor: 420.32 }]);
    expect(p.alertas.map((a) => a.codigo)).toContain("SEM_DIVIDA");
  });

  it("regra das 8 horas: saída depois das 16h e retorno antes das 08h não contam", () => {
    expect(diasDoEvento("2023-08-26", "2023-09-03", "16:00", "08:00").dias).toBe(9);
    expect(diasDoEvento("2023-08-26", "2023-09-03", "16:30", "07:59").dias).toBe(7);
  });

  it("não é DEA, prescrição e soldo da ficha diferente da tabela", () => {
    const p = planoGratRep({
      fichas: [ficha(2020, linha("NR0001", { 3: 1000 }))], inicio: "2020-03-10", fim: "2020-03-12", hoje,
      dados: { categoria: "3-sgt", autorizacao: { publicacao: "2020-11-01" } },
    });
    expect(p.soldo).toBe(3825);
    expect(p.alertas.map((a) => a.codigo)).toEqual(["SOLDO_FICHA", "NAO_E_DEA", "PRESCRICAO"]);
  });

  it("soldos por vigência (2025 muda em abril)", () => {
    expect(soldoNaData("cb-eng", "2025-03-31")).toBe(2627);
    expect(soldoNaData("cb-eng", "2025-04-01")).toBe(2745);
    expect(soldoNaData("cb-eng", "2017-12-31")).toBeNull();
  });

  it("A62 na posição 1 vazia ou na 1ª receita vazia; a que já existe fica", () => {
    const vazias = Array.from({ length: 17 }, (_, i) => ({ posicao: i + 1, codigo: i === 0 ? "A01 - SOLDO" : "", tipo: i >= 12 ? "Despesa" : "Receita" }));
    expect(rubricasGratRep(vazias)).toEqual({ mudadas: [{ posicao: 2, codigo: RUBRICA_GRAT_REP, tipo: "Receita" }], posicao: 2 });
    const pronta = vazias.map((r) => (r.posicao === 5 ? { ...r, codigo: RUBRICA_GRAT_REP } : r));
    expect(rubricasGratRep(pronta)).toEqual({ mudadas: [], posicao: 5 });
  });
});
