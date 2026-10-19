/**
 * Leitor do contracheque. O primeiro bloco usa palavras sintéticas (layout do PDF real, dados fictícios),
 * com marca d'água sobreposta; o segundo usa os PDFs reais de exemplos/contracheques (fora do Git), se houver.
 */
import { cpfValido, precCpValido } from "@painel-ea/engine";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { aplicarCorrespondencia, contrachequeComoFicha, CORRESPONDENCIA_PADRAO, lerContracheque, lerDocumentoPdf, type Palavra } from "../src";

/** Monta palavras a partir de "texto@x" por linha (y), como o pdf.js entrega. */
function pagina(linhas: [number, string][], extras: Palavra[] = []): Palavra[] {
  const r: Palavra[] = [];
  for (const [y, conteudo] of linhas) {
    for (const t of conteudo.split(" ")) {
      const [texto, x] = t.split("@") as [string, string];
      r.push({ texto, x: Number(x), y, largura: texto.length * 3.6, pagina: 1, tamanho: 7.4, inclinada: false });
    }
  }
  return [...r, ...extras];
}

const FICTICIO = pagina([
  [74, "MÊS@500"], [83, "MARÇO@481 /@510 2024@518"],
  [113, "COMPROVANTE@222 MENSAL@277 DE@309 RENDIMENTOS@323"],
  [128, "PREC-CP@44 NOME@110 OM@397 DE@410 VINCULAÇÃO@423 (Órgão@469 pagador)@493"],
  [141, "11@46 1111111@57 FULANO@112 DE@153 TAL@170 1º@399 BTL@412 TESTE@430 -@456 Cod:@464 012345@483"],
  [156, "P/G@44 REAL@60 P/G@213 DE@231 PAGAMENTO@244 Nr@397 Dep@408 IR:@422 CAT@479 IND@519"],
  [169, "13@46 -@54 1º@62 SARGENTO@75 13@215 -@223 1º@231 SARGENTO@244 1@481 1@521"],
  [184, "CPF@44 BANCO@110 AGÊNCIA@213 CONTA@321 CORRENTE@349"],
  [198, "529.982.247-25@46 104@112 1234@215 000098765@323"],
  [213, "Info@319"],
  [217, "Código@62 Descrição@180 Receitas@379 Despesas@438 Líquido@507"],
  [237, "NR0001@62 SOLDO@110 5.500,00@387"],
  [250, "NR0003@62 ADICIONAL@110 DE@153 HABILITACAO@166 1.100,00@391"],
  [331, "ND0001@62 FUSEX@110 3%@320 198,00@459"],
  [426, "ND0515@62 ZS3@110 -@127 FHE-EMP@135 SIMPLES@167 10@315 /@324 96@331 53,24@463"],
  [439, "ND0515@62 ZS3@110 -@127 FHE-EMP@135 SIMPLES@167 10@315 /@324 96@331 100,00@452"],
  [495, "R$@376 6.600,00@387 R$@438 351,24@448 R$@500 6.248,76@511"],
], [
  // marca d'água: fonte grande e inclinada, atravessando as linhas
  { texto: "Maj", x: 97, y: 250, largura: 30, pagina: 1, tamanho: 16.2, inclinada: true },
  { texto: "FULANO", x: 164, y: 250, largura: 60, pagina: 1, tamanho: 16.2, inclinada: true },
  { texto: "Em:", x: 190, y: 291, largura: 30, pagina: 1, tamanho: 16.2, inclinada: true },
]);

describe("contracheque (layout do CPEx, dados fictícios)", () => {
  const c = lerContracheque(FICTICIO);

  it("lê mês, cabeçalho e dados bancários", () => {
    expect([c.ano, c.mes]).toEqual([2024, 3]);
    expect(c.cabecalho).toEqual({
      nome: "FULANO DE TAL", precCp: "111111111", omVinculacao: "1º BTL TESTE", codom: "012345",
      pgReal: "1º SARGENTO", pgPagamento: "1º SARGENTO", cpf: "529.982.247-25", banco: "104", agencia: "1234", conta: "000098765",
    });
  });

  it("lê as linhas sem a marca d'água, separando descrição e info complementar", () => {
    expect(c.linhas.map((l) => [l.codigo, l.natureza, l.descricao, l.info, l.valor])).toEqual([
      ["NR0001", "receita", "SOLDO", "", 5500],
      ["NR0003", "receita", "ADICIONAL DE HABILITACAO", "", 1100],
      ["ND0001", "desconto", "FUSEX", "3%", 198],
      ["ND0515", "desconto", "ZS3 - FHE-EMP SIMPLES", "10 / 96", 53.24],
      ["ND0515", "desconto", "ZS3 - FHE-EMP SIMPLES", "10 / 96", 100],
    ]);
    expect(c.totais).toEqual({ receitas: 6600, despesas: 351.24, liquido: 6248.76 });
    expect(c.conferencias.ok).toBe(true);
    expect(c.avisos).toEqual([]);
  });

  it("vira uma ficha de um mês e preenche as rubricas pela mesma correspondência das fichas", () => {
    const ficha = contrachequeComoFicha(c);
    expect(ficha.cabecalho.posto).toBe("1º SARGENTO");
    const r = aplicarCorrespondencia([ficha], [
      { posicao: 1, codigo: "A01 - SOLDO" }, { posicao: 2, codigo: "A03 - ADIC HAB" }, { posicao: 13, codigo: "Z01 - FUSEX" },
    ], CORRESPONDENCIA_PADRAO);
    expect(r.lancamentos.map(({ ano, mes, posicao, valor }) => ({ ano, mes, posicao, valor }))).toEqual([
      { ano: 2024, mes: 3, posicao: 1, valor: 5500 }, { ano: 2024, mes: 3, posicao: 2, valor: 1100 }, { ano: 2024, mes: 3, posicao: 13, valor: 198 },
    ]);
    expect(r.naoUsadas.map((l) => l.codigo)).toEqual(["ND0515", "ND0515"]);
  });

  it("avisa quando a soma não confere com os totais", () => {
    const errado = lerContracheque(FICTICIO.map((p) => (p.texto === "5.500,00" ? { ...p, texto: "5.400,00" } : p)));
    expect(errado.conferencias.receitasOk).toBe(false);
    expect(errado.avisos).toContain("A soma das linhas não confere com os totais do contracheque.");
  });
});

const PASTA = join(__dirname, "..", "..", "..", "exemplos", "contracheques");
const arquivos = existsSync(PASTA) ? readdirSync(PASTA).filter((f) => f.toLowerCase().endsWith(".pdf")) : [];

describe.skipIf(arquivos.length === 0).each(arquivos)("contracheque real %s", (arq) => {
  it("é reconhecido, lê cabeçalho e linhas, e os totais conferem", async () => {
    const lido = await lerDocumentoPdf(new Uint8Array(readFileSync(join(PASTA, arq))));
    expect(lido.tipo).toBe("contracheque");
    if (lido.tipo !== "contracheque") return;
    const c = lido.contracheque;
    // sem dados pessoais na saída: só estrutura
    console.log(arq, JSON.stringify({ ano: c.ano, mes: c.mes, pg: c.cabecalho.pgPagamento, banco: c.cabecalho.banco, codom: c.cabecalho.codom,
      linhas: c.linhas.map((l) => `${l.codigo} ${l.descricao}${l.info ? ` [${l.info}]` : ""}`), conferencias: c.conferencias, avisos: c.avisos }, null, 1));
    expect(c.ano).toBeGreaterThan(2000);
    expect(c.mes).toBeGreaterThanOrEqual(1);
    expect(c.cabecalho.nome).toBeTruthy();
    expect(cpfValido(c.cabecalho.cpf ?? "")).toBe(true);
    expect(precCpValido(c.cabecalho.precCp ?? "")).toBe(true);
    expect(c.cabecalho.agencia).toMatch(/^\d+/);
    expect(c.cabecalho.conta).toMatch(/^\d+/);
    expect(c.linhas.length).toBeGreaterThan(3);
    expect(c.linhas.every((l) => !/Acessado|Em:/.test(l.descricao))).toBe(true);
    expect(c.conferencias.ok).toBe(true);
    expect(c.avisos).toEqual([]);
  });
});
