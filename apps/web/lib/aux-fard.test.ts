import { describe, expect, it } from "vitest";
import { auxFardAutomatico, DOCUMENTO_DIREITO, planoAuxFard, rubricasAuxFard, RUBRICA_AUX_FARD_1, tetoArt19 } from "./aux-fard";
import type { FichaLida } from "./receitas";

const linha = (codigo: string, meses: Record<number, number>) =>
  ({ codigo, descricao: codigo, meses: Array.from({ length: 12 }, (_, i) => meses[i + 1] ?? 0) });
const ficha = (ano: number, ...linhas: ReturnType<typeof linha>[]): FichaLida => ({ ano, sistema: "sippes", linhas });
const hoje = "2026-11-24";
const codigos = (p: { alertas: { codigo: string }[] }) => p.alertas.map((a) => a.codigo);

describe("Auxílio-fardamento automático", () => {
  it("só com a espécie e nos processos criados depois da mudança", () => {
    const especie_divida = "Auxílio fardamento";
    expect(auxFardAutomatico({ especie_divida, complementos: { calculoAutomaticoAuxFard: true } })).toBe(true);
    expect(auxFardAutomatico({ especie_divida, complementos: { calculoAutomatico: true } })).toBe(false);
  });

  it("caso de teste 1 (NUP 64241.005879/2026-73): Aspirante → 2º Ten em menos de 1 ano, art. 61", () => {
    const fichas = [
      // jul/2021: soldo proporcional (praça em 12 JUL); o cheio aparece em ago
      ficha(2021, linha("NR0001", { 7: 4954.84, 8: 7315, 12: 7315 }), linha("NR0056", { 7: 7315 })),
      ficha(2022, linha("NR0001", { 1: 7490 }), linha("NR0056", { 1: 175 })),
    ];
    const p = planoAuxFard({
      fichas, hoje, dataRequerimento: "2026-09-28", periodoInicio: "2021-12-01",
      dados: { fato1: { tipo: "aspirante", data: "2021-07-12", categoria: "asp" }, fato2: { tipo: "promocao", data: "2021-12-25", categoria: "2-ten" } },
    });
    expect(p.multiplicador1).toBe(1); // pelo valor pago (7.315,00 ÷ 7.315,00), não pela alínea
    expect(p.devido).toBe(7490);
    expect(p.recebido).toBe(175);
    expect(p.diferenca).toBe(7315);
    // competência: mês do 2º fato (dez/2021), não o do pagamento (jan/2022), como nos processos pagos
    expect(p.competencia).toEqual({ ano: 2021, mes: 12 });
    expect(p.prescricao).toEqual({ limite: "2026-12-25", referencia: "2026-09-28" });
    expect(p.devidos).toEqual([{ ano: 2021, mes: 12, valor: 7490 }]);
    expect(p.recebidos).toEqual([{ ano: 2021, mes: 12, valor: 175 }]);
    expect(p.rubrica).toBe(RUBRICA_AUX_FARD_1);
    expect(codigos(p)).toEqual(expect.arrayContaining(["ATO_FATO_GERADOR_AUSENTE", "FICHA_AUSENTE"]));
    expect(codigos(p)).not.toContain("DIVERGENCIA_COMPETENCIA");
    expect(codigos(p)).not.toContain("FORA_DA_TESE");
    expect(codigos(p)).not.toContain("PRESCRITO");
    expect(codigos(p)).not.toContain("CONFERENCIA_DIFERENCA");
    expect(p.textos.documentos).toEqual([DOCUMENTO_DIREITO]);
    expect(p.textos.explicacao).toContain("foi promovido em 25 DEZ 21 ao posto de Segundo-Tenente");
    expect(p.diferenca!).toBeLessThan(tetoArt19(hoje)!);
  });

  it("triênio e promoção na mesma data: bases distintas (DIEx 2750-APG 8/SEF)", () => {
    const fichas = [ficha(2024, linha("NR0001", { 12: 3825 }), linha("NR0056", { 12: 4770 }))];
    const p = planoAuxFard({
      fichas, hoje, dados: { caso: "mesma_data", fato1: { tipo: "trienio", categoria: "3-sgt" }, fato2: { tipo: "promocao", data: "2024-12-25", categoria: "2-sgt" }, vinculos: { "2024-12-NR0056": 2 } },
    });
    // triênio: 1 × 3.825,00 (3º Sgt) + promoção: 1 × 4.770,00 (2º Sgt) = 8.595,00; recebido 4.770,00
    expect(p.devido).toBe(8595);
    expect(p.diferenca).toBe(3825);
    expect(codigos(p)).not.toContain("NAO_E_DEA");
  });

  it("CFO: matrícula e nomeação, 1,5 soldo cada (DIEx 1677-S1/10º CGCFEx)", () => {
    const fichas = [
      ficha(2023, linha("NR0001", { 2: 8245, 12: 8245 }), linha("NR0057", { 2: 12367.5 })),
      ficha(2024, linha("NR0057", { 1: 0.01 })),
    ];
    const p = planoAuxFard({
      fichas, hoje, dados: {
        fato1: { tipo: "matricula_cfo", data: "2023-02-01", categoria: "1-ten" }, fato2: { tipo: "nomeacao", data: "2023-12-15", categoria: "1-ten" },
        vinculos: { "2023-2-NR0057": 1, "2024-1-NR0057": 2 },
      },
    });
    expect(p.multiplicador1).toBe(1.5);
    expect(p.devido).toBe(12367.5);
    expect(p.rubrica).toBe("A57 - AUX FARD 1.5 SLD");
  });

  it("fora da tese, prescrição, interrupção, reintegrado e duplicidade", () => {
    const fichas = [
      ficha(2020, linha("NR0001", { 1: 7490 }), linha("NR0056", { 1: 7490 })),
      ficha(2021, linha("NR0001", { 6: 8245 }), linha("NR0056", { 6: 755 })),
      ficha(2026, linha("AR0056", { 3: 7490 })),
    ];
    const dados = { fato1: { tipo: "promocao" as const, data: "2020-01-10", categoria: "2-ten" }, fato2: { tipo: "promocao" as const, data: "2021-05-30", categoria: "1-ten" }, ato2: "BI 100", reintegradoSemExpediente: true,
      vinculos: { "2020-1-NR0056": 1 as const, "2021-6-NR0056": 2 as const } };
    const p = planoAuxFard({ fichas, hoje, dataRequerimento: "2026-08-01", dados });
    expect(codigos(p)).toEqual(expect.arrayContaining(["FORA_DA_TESE", "PRESCRITO", "INELEGIVEL", "POSSIVEL_DUPLICIDADE"]));
    const q = planoAuxFard({ fichas, hoje, dataRequerimento: "2026-08-01", dados: { ...dados, prescricaoInterrompida: true, ordemJudicial: true } });
    expect(codigos(q)).not.toContain("PRESCRITO");
    expect(codigos(q)).not.toContain("INELEGIVEL");
  });

  it("processos pagos (conferidos em 25/11/2026): devido, recebido, diferença e competência", () => {
    // 64552.000474/2026-35 (TC Robson): triênio de Maj pago em mai/2022; promoção a TC em 31 AGO 22, diferença paga 1 ano depois
    const robson = planoAuxFard({
      fichas: [ficha(2022, linha("A01", { 5: 11088, 8: 11250 }), linha("A56", { 5: 11088 })), ficha(2023, linha("A56", { 8: 172 }))], hoje,
      dados: { fato1: { tipo: "trienio", data: "2022-05-01", categoria: "maj" }, fato2: { tipo: "promocao", data: "2022-08-31", categoria: "ten-cel" },
        vinculos: { "2022-5-A56": 1, "2023-8-A56": 2 } },
    });
    expect([robson.devido, robson.recebido, robson.diferenca]).toEqual([11250, 172, 11078]);
    expect(robson.competencia).toEqual({ ano: 2022, mes: 8 });
    // 64552.001265/2026-17 (Cap Theophilo): triênio de 1º Ten em jan/2021, promoção a Cap em 25 DEZ 21
    const theophilo = planoAuxFard({
      fichas: [ficha(2021, linha("A01", { 1: 8245, 12: 9135 }), linha("A56", { 1: 8245, 12: 890 }))], hoje,
      dados: { fato1: { tipo: "trienio", data: "2021-01-01", categoria: "1-ten" }, fato2: { tipo: "promocao", data: "2021-12-25", categoria: "cap" } },
    });
    expect([theophilo.devido, theophilo.recebido, theophilo.diferenca]).toEqual([9135, 890, 8245]);
    expect(theophilo.competencia).toEqual({ ano: 2021, mes: 12 });
    // 64360.000907/2026-18 (1º Sgt Alan): 3 anos de 2º Sgt e promoção a 1º Sgt na mesma data, 1º JUN 24
    const alan = planoAuxFard({
      fichas: [ficha(2024, linha("NR0001", { 6: 5483 }), linha("NR0056", { 6: 5483 }))], hoje,
      dados: { caso: "mesma_data", fato1: { tipo: "trienio", categoria: "2-sgt" }, fato2: { tipo: "promocao", data: "2024-06-01", categoria: "1-sgt" }, vinculos: { "2024-6-NR0056": 2 } },
    });
    expect([alan.devido, alan.recebido, alan.diferenca]).toEqual([10253, 5483, 4770]);
    expect(alan.competencia).toEqual({ ano: 2024, mes: 6 });
    expect(alan.textos.explicacao).toContain("na graduação de Segundo-Sargento");
  });

  it("A56/A57 na posição 1 vazia ou na 1ª receita vazia", () => {
    const vazias = Array.from({ length: 17 }, (_, i) => ({ posicao: i + 1, codigo: i === 0 ? "A01 - SOLDO" : "", tipo: i >= 12 ? "Despesa" : "Receita" }));
    expect(rubricasAuxFard(vazias, RUBRICA_AUX_FARD_1)).toEqual({ mudadas: [{ posicao: 2, codigo: RUBRICA_AUX_FARD_1, tipo: "Receita" }], posicao: 2 });
  });
});
