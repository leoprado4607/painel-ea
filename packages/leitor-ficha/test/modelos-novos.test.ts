/**
 * Modelos tirados do SIPPES em out/2026 (layout dos PDFs reais, dados fictícios): a "2ª VIA DE CONTRACHEQUE"
 * e a Ficha Financeira nova (valores sem ponto de milhar, totais em "Total Receitas/Despesas/Líquido").
 */
import { describe, expect, it } from "vitest";
import { lerContracheque, lerFicha, type Palavra } from "../src";

/** Monta palavras a partir de "texto@x" por linha (y), como o pdf.js entrega. */
function pagina(linhas: [number, string][]): Palavra[] {
  return linhas.flatMap(([y, conteudo]) => conteudo.split(" ").map((t) => {
    const [texto, x] = t.split("@") as [string, string];
    return { texto, x: Number(x), y, largura: texto.length * 4, pagina: 1, tamanho: 8, inclinada: false };
  }));
}

describe("contracheque 2ª via do SIPPES", () => {
  const c = lerContracheque(pagina([
    [116, "COMPROVANTE@193 MENSAL@272 DE@318 RENDIMENTOS@338"],
    [129, "IDENTIFICADOR:@64 PREC/CP:@146 NOME:@222"],
    [139.5, "0000000001@64 11.111111-1@146 FULANO@222 DE@260 TAL@274"],
    [152, "CPF:@64 CATEGORIA:@146 FOLHA:@352"],
    [162.7, "529.982.247-25@64 Militar@146 da@178 ativa@190 NORMAL-@352 Outubro/2026@396"],
    [175.2, "P/G@64 -@76 REAL:@82"],
    [181.2, "P/G@285 -@299 PROVENTOS/PENSÃO:@306"],
    [185.9, "22@64 -@79 Cabo@88 Engajado@113"],
    [201.3, "RUBRICA@68 DESCRIÇÃO@219 VALOR@387 %@444 R/D@468 IR@493 PARC@511"],
    [217, "AR0061@73 GRAT@122 REPRESENT@154 EVENTUAL@218 516,42@399 18,00@438 R@473 -@497"],
    [233, "DR0095@72 AUXILIO@122 TRANSPORTE@171 30,12@404 1,05@443 R@473 -@497"],
    [249, "NR0001@72 SOLDO@122 2.869,00@390 100,00@432 R@473 +@495"],
    [265, "ND0001@72 FUSEX@122 3%@160 112,75@399 3,93@443 D@473 -@497"],
    [281, "ND0513@72 ZRA@122 -@145 FHE@156 EMP@179 975,17@399 33,99@438 D@473 -@497 1/1@518"],
    [373, "DATA@64 IMP/PRAÇA:@81 DEP@155 IR:@168 ISENTO@198 IR:@221 RECEITA:@256 DESPESA:@352 LÍQUIDO:@481"],
    [383.5, "10/03/2022@64 0@155 Não@198 3.385,42@256 1.118,04@352 2.267,38@481"],
    [396, "BANCO:@64 AGÊNCIA:@107 C/C:@160 IDT@280 MARGEM:@294 SITUAÇÃO:@352"],
    [406.7, "001@64 2623@107 12345x@160 AbCdEf@280 Normal@352"],
  ]));

  it("lê mês, cabeçalho e dados bancários", () => {
    expect([c.ano, c.mes]).toEqual([2026, 10]);
    expect(c.cabecalho).toMatchObject({ nome: "FULANO DE TAL", precCp: "111111111", pgReal: "Cabo Engajado", cpf: "529.982.247-25",
      banco: "001", agencia: "2623", conta: "12345x" });
  });

  it("valor da coluna VALOR (não o %), natureza pelo código e totais conferidos", () => {
    expect(c.linhas.map((l) => [l.codigo, l.natureza, l.valor, l.descricao])).toEqual([
      ["AR0061", "receita", 516.42, "GRAT REPRESENT EVENTUAL"],
      ["DR0095", "desconto", 30.12, "AUXILIO TRANSPORTE"],
      ["NR0001", "receita", 2869, "SOLDO"],
      ["ND0001", "desconto", 112.75, "FUSEX 3%"],
      ["ND0513", "desconto", 975.17, "ZRA - FHE EMP"],
    ]);
    expect(c.linhas.at(-1)!.info).toBe("1/1");
    expect(c.totais).toEqual({ receitas: 3385.42, despesas: 1118.04, liquido: 2267.38 });
    expect(c.conferencias.ok).toBe(true);
    expect(c.avisos).toEqual([]);
  });
});

describe("ficha financeira nova do SIPPES", () => {
  const meses = (v: string[]) => v.map((t, i) => `${t}@${218 + i * 46}`).join(" ");
  const zeros = Array<string>(12).fill("0,00");
  const f = lerFicha(pagina([
    [153, "Ano:@349 2026(Moeda:@384 Real)@467"],
    [194.5, "Nr@39 de@53 idt/Cadastro:@67 0000000001@140 Nome:@214 FULANO@247 DE@284 TAL@300 CPF:@548 529.982.247-25@572"],
    [210.5, "Categoria:@39 Militar@92 da@124 ativa@136 Posto/Grad@214 real:@267 Soldado-Recruta@301"],
    [226.5, "PREC/CP:@39 11.111111-1@88 OM:@214 003004@235 -@271 7º@281 BE@296 Cmb@311 RM:@548 7ª@569 RM@586"],
    [288.5, `Código@43 Descrição@115 ${meses(["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"])} Total@764`],
    [303.8, `NR0170@37 AD@87 C@100 DISP@108 MIL@130 ${meses(["0,00", "0,00", "56,95", "58,85", ...zeros.slice(4)])} 115,80@781`],
    [316.1, "ADICIONAL@87 NATAL@134"],
    [320.8, `NR0084@37 ${meses(["0,00", "0,00", "0,00", "0,00", "0,00", "411,95", ...zeros.slice(6)])} 411,95@781`],
    [325.4, "1PARC@87"],
    [355.8, `NR0001@37 SOLDO@87 ${meses(["0,00", "0,00", "1139,03", "1177,00", ...zeros.slice(4)])} 2316,03@776`],
    [368.1, "PENSAO@87 MILITAR@119 -@155"],
    [372.8, `ND0039@37 ${meses(["0,00", "0,00", "125,57", "129,76", ...zeros.slice(4)])} 255,33@776`],
    [377.4, "MILITAR@87 TEMPORARIO@126"],
    [389.8, `Total@79 Receitas@108 ${meses(["0,00", "0,00", "1195,98", "1235,85", "0,00", "411,95", ...zeros.slice(6)])}`],
    [406.8, `Total@76 Despesas@107 ${meses(["0,00", "0,00", "125,57", "129,76", ...zeros.slice(4)])}`],
    [423.8, `Total@81 Líquido@110 ${meses(["0,00", "0,00", "1070,41", "1106,09", "0,00", "411,95", ...zeros.slice(6)])}`],
    [567.4, "Data:@35 28/10/2026@59 0000000002@299 Nome:@369 Cb@396 OPERADOR@410"],
  ]));

  it("lê o cabeçalho de campos lado a lado (e não o nome de quem acessou, no rodapé)", () => {
    expect(f.ano).toBe(2026);
    expect(f.cabecalho).toEqual({ posto: "Soldado Recruta", nome: "FULANO DE TAL", precCp: "111111111", identidade: "0000000001",
      cpf: "52998224725", codom: "003004", rm: "7", siglaUa: "7º BE Cmb" });
  });

  it("lê valores sem ponto de milhar, descrições em várias linhas e confere com Total Líquido", () => {
    expect(f.linhas.map((l) => [l.codigo, l.descricao, l.total])).toEqual([
      ["NR0170", "AD C DISP MIL", 115.8],
      ["NR0084", "ADICIONAL NATAL 1PARC", 411.95],
      ["NR0001", "SOLDO", 2316.03],
      ["ND0039", "PENSAO MILITAR - MILITAR TEMPORARIO", 255.33],
    ]);
    expect(f.linhas[2]!.meses.slice(2, 4)).toEqual([1139.03, 1177]);
    expect(f.totaisLiquidos!.slice(2, 4)).toEqual([1070.41, 1106.09]);
    expect(f.conferencias.ok).toBe(true);
    expect(f.avisos).toEqual([]);
  });
});
