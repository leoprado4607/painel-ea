import { describe, expect, it } from "vitest";
import { lerProcesso, normalizar, type Peca } from "./processo-completo";

// trechos reais dos processos de Auxílio-fardamento (Laurence, em análise; Alan e TC Robson, pagos)
const laurence: Peca[] = [
  { nome: "0. Capa do Processo 64241.005879_2026-73.pdf", tipo: "texto", texto: "MINISTÉRIO DA DEFESA PROCESSO NUP\nEXÉRCITO BRASILEIRO\nBASE ADMINISTRATIVA DA GUARNIÇÃO DE NATAL 64241.005879/2026-73" },
  { nome: "2. Outro-Ficha Financeira - 2021 (Ten Laurence).pdf", tipo: "ficha" },
  { nome: "4. Requerimento-Requerimento - 87 Ten Laurence DEA Aux Fard recebido a menor.pdf", tipo: "texto",
    texto: "Requerimento nº 87-SVPGuN - SAS/SVPGuN/B Adm Gu Natal\nEB: 64241.005876/2026-30\nNatal, RN, 28 de setembro de 2026.\n1. Eu, Cleo Laurence, venho requerer a V. Sa. o pagamento da diferença do Auxílio-Fardamento referente a JAN/22, tendo em vista a promoção de Aspirante à 2º Tenente , ao qual fui promovida em 24 DEZ 21, conforme BI Nr 239, de 24 DEZ 21, do HGuJP." },
  { nome: "5. Declaração-DECLARACAO NR 36 1 TEN LAURENCE.pdf", tipo: "texto", texto: "DECLARAÇÃO" },
  { nome: "8. Documento de Formalização de Demanda-Parecer da CONJUR-00645.pdf", tipo: "grande" },
  { nome: "9. Documento de Formalização de Demanda-ADT 37 AO BI 195 - DEA RECONHECIMENTO DE DIVIDA - TEN LAURENCE.pdf", tipo: "imagem" },
  { nome: "10. Informação de Requerimento-188-Seç Pes_B Adm Gu Natal.pdf", tipo: "texto",
    texto: "Inf. de Requerimento nº 188-Seç Pes/B Adm Gu Natal\n1. Requerimento em que a 1º Tenente OTT CLEO LAURENCE DANTAS COSTA PEREIRA DE ARAÚJO pleiteia o pagamento de Despesas de Exercícios Anteriores relativos ao Auxílio Fardamento recebidos a menor em 1º de fevereiro de 2022, pela sua promoção, de Aspirante a Oficial a 2º Tenente em 25 DEZ 21." },
];

describe("processo completo do Auxílio-fardamento", () => {
  it("Laurence: NUP, requerimento, promoção, ato, declaração e reconhecimento", () => {
    const l = lerProcesso(laurence);
    expect(l.nup).toBe("64241.005879/2026-73");
    expect(l.ano).toBe(2026);
    expect(l.dataRequerimento).toBe("2026-09-28");
    // a Informação (analisada pela OM) prevalece sobre o requerimento (24 DEZ)
    expect(l.auxFard.fato2).toEqual({ tipo: "promocao", data: "2021-12-25", categoria: "2-ten" });
    expect(l.periodo).toEqual({ inicio: "2021-12-01", fim: "2021-12-31" });
    expect(l.auxFard.ato2).toBe("BI Nr 239, de 24 DEZ 21, do HGuJP");
    expect(l.auxFard.declaracaoSemAcao).toBe(true);
    expect(l.auxFard.reconhecimento).toBe(true);
    expect(l.averbacao).toBeNull();
    expect(l.avisos.join(" ")).toMatch(/grandes demais.*Parecer da CONJUR/);
    expect(l.avisos.join(" ")).toMatch(/Sem contracheque/);
    expect(l.avisos.join(" ")).toMatch(/BI de averbação/);
  });

  it("Alan (pago): triênio e promoção na mesma data, averbação pela Informação", () => {
    const l = lerProcesso([
      { nome: "8. Informação de Requerimento-11-S4 da Cia_CiaC.pdf", tipo: "texto",
        texto: "Inf. de Requerimento nº 11\nRequerimento datado de 11 de junho de 2026, publicado para averbação no BI nº 67, de 12 de junho de 2026, em que ALAN LEITE RAMOS requer o pagamento do Auxílio-fardamento, haja vista este militar ter sido promovido a graduação atual, em 1º de junho de 2024, e recebeu apenas o valor referente à promoção a 1° Sgt à época, sendo que o militar completou na mesma data de 1° de junho de 2024, 3 (três) anos na mesma graduação de 2° Sgt." },
      { nome: "14. Outros-Protocolo CPEx.pdf", tipo: "texto", texto: "FORMULÁRIO DE EXERCÍCIOS ANTERIORES" },
    ]);
    expect(l.dataRequerimento).toBe("2026-06-11");
    expect(l.averbacao).toEqual({ documento: "BI", numero: "67", data: "2026-06-12" });
    expect(l.auxFard.caso).toBe("mesma_data");
    expect(l.auxFard.fato1).toEqual({ tipo: "trienio", categoria: "2-sgt" });
    expect(l.auxFard.fato2).toEqual({ tipo: "promocao", data: "2024-06-01", categoria: "1-sgt" });
    expect(l.avisos.join(" ")).toMatch(/já pago \(duplicidade\)/);
  });

  it("TC Robson (pago): posto antes da palavra promoção; reconhecimento com acento corrompido no nome", () => {
    const l = lerProcesso([
      { nome: "2. Informação de Requerimento-30-CGDR.pdf", tipo: "texto",
        texto: "Inf. de Requerimento nº 30\nrequer ao Sr. o pagamento do valor restante para atingir cota integral do auxílio-fardamento do posto de Tenente Coronel em razão de sua promoção ocorrida em 31 de agosto de 2022." },
      { nome: "3. Outro-BI 57 Reconhecimento de div+¡da.pdf", tipo: "imagem" },
      { nome: "7. Outro-Ficha financeira.pdf", tipo: "imagem" },
    ]);
    expect(l.auxFard.fato2).toEqual({ tipo: "promocao", data: "2022-08-31", categoria: "ten-cel" });
    expect(l.auxFard.reconhecimento).toBe(true);
    expect(l.avisos.join(" ")).toMatch(/Ficha financeira digitalizada/);
    expect(l.avisos.join(" ")).toMatch(/Nenhuma ficha financeira com texto/);
  });

  it("normaliza acentos e ordinais", () => {
    expect(normalizar("Promoção  a 1º Sgt")).toBe("PROMOCAO A 1O SGT");
  });

  it("Grat Rep (Sgt Estevam, 64241.005793/2026-41): autorização, item 12, evento, transcrição e datas do militar", () => {
    const l = lerProcesso([
      { nome: "1. Requerimento-84-Seç Pes_B Adm Gu Natal.pdf", tipo: "texto",
        texto: `Requerimento nº 84-Seç Pes/B Adm Gu Natal
Natal, RN, 24 de setembro de 2026.
2. ... autorização para pagamento de Grat Rep, publicada no Item 12, do n° 2 da 3ª parte do Aditamento n° 51/2025 ao BI CMNE n° 232, de 18 DEZ 25.
3. Anexos: c. BI n° 174/B Adm Gu Natal, transcrição da autorização para pagamento.` },
      { nome: "5. Documento de Formalização de Demanda-Adt 51.pdf", tipo: "texto",
        texto: `Quartel em RECIFE-PE, 18 de dezembro dc 2025
ADITAMENTO N° 51/2025 ao BI CMNE n° 232
GRATIFICACAO DE REPRESENTACAO - Autorizagao
11. DOCUMENTO(S) DE REFERENCIA: DIEx n° 1; NATUREZA DA ATIVIDADE: Outra; LOCAL DE REALIZACAO: Recife-PE; PERIODO TOTAL: 010800 JAN 26 a 021700 JAN 26.
12. DOCUMENTO(S) DE REFERENCIA: DIEx n° 5788-El0/7a DE, de 5 DEZ 25; NATUREZA DA ATIVIDADE: Estagio Basico do Combatente de Caatinga (EBCC-2025); AMPARO DA ATIVIDADE: Ordem de Instrugao n° 14; AMPARO LEGAL: Inciso II do Art 5°, do Decreto n° 11.002, de 17 de margo de 2022 (Viagem de Instrugao); OM: B Adm Gu N (Natal-RN); LOCAL DE REALIZACAO: Campina
Grande-PB; MONTANTE A SER PAGO: R$ 1.416,94; EFETIVO TOTAL: 5 e PERIODO TOTAL:
271200 SET 25 a 041400 OUT 25.` },
      { nome: "6. Documento de Formalização de Demanda-BI 174 20260916 qua.pdf", tipo: "imagem" },
      { nome: "9. Informação de Requerimento-194-Seç Pes_B Adm Gu Natal.pdf", tipo: "texto",
        texto: `Inf. de Requerimento nº 194
-Dt Deslocamento para o EBCC/25: 27 SET 25
-Dt Término do EBCC/25: 03 OUT 25` },
    ], "grat-rep");
    expect(l.dataRequerimento).toBe("2026-09-24");
    expect(l.periodo).toEqual({ inicio: "2025-09-27", fim: "2025-10-03" });
    expect(l.gratRep).toEqual({
      autorizacao: { documento: "Adt nº 51/2025 ao BI CMNE nº 232, de 18/12/2025", publicacao: "2025-12-18", transcricao: "BI n° 174/B Adm Gu Natal, de 16/09/2026" },
      evento: { natureza: "Estagio Basico do Combatente de Caatinga (EBCC-2025)", local: "Campina Grande-PB", amparo: "Inciso II do Art 5°, do Decreto n° 11.002, de 17 de margo de 2022 (Viagem de Instrugao)" },
      horaSaida: "12:00",
    });
    expect(l.avisos.join(" ")).toMatch(/diferem do período total da autorização/);
  });
});
