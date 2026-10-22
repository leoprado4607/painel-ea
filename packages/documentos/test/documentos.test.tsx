/** Gera o pacote do caso de teste nº 1 e confere, lendo o PDF gerado, os valores impressos. */
import { calcular, type EntradaCalculo, type IndiceMensal } from "@painel-ea/engine";
import { palavrasDoPdf } from "@painel-ea/leitor-ficha";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { gerarPdf, type DadosDocumentos } from "../src";

const GOLDEN = join(__dirname, "..", "..", "engine", "test", "golden");
const ler = <T,>(a: string) => JSON.parse(readFileSync(join(GOLDEN, a), "utf-8")) as T;

export function dadosC01(): DadosDocumentos {
  const caso = ler<EntradaCalculo>("c01_simples.entrada.json");
  const resultado = calcular({ ...caso, indices: ler<IndiceMensal[]>("indices-planilha.json") });
  return {
    om: { nome: "1º Batalhão Fictício de Testes", regiaoMilitar: "11ª", cidadeUf: "Brasília-DF", unidadeGestora: "160001", codom: "012345",
      ordenadorNome: "ORDENADOR TESTE - Ten Cel", ordenadorFuncao: "Ordenador de Despesas de Pagamento de Pessoal" },
    responsavel: { nome: "FULANO DE TAL - Cb", funcao: "Auxiliar Div Pg Pes" },
    militar: { postoGraduacao: "1º Sgt", nome: "João Teste da Silva", precCp: null, identidade: null, cpf: null, banco: "001 - Brasil", agencia: "1234-5", conta: "98765-4" },
    processo: { numero: "TESTE", especieDivida: "Diferença de adicional (teste)", periodoInicio: "2020-01-01", periodoFim: "2020-12-01",
      dataExtenso: "17 de outubro de 2026", possuiPensaoJudicial: false, ano: 2026, dataRequerimento: "2026-09-02", biNumero: "180", biData: "2026-09-20" },
    complementos: { anexos: { fichas: 3 }, amparo: "DIEx nº 103-ASSE1 (teste)", explicacao: "Explicação de teste do não pagamento." },
    rubricas: caso.rubricas.map((r, i) => ({ posicao: i + 1, ...r })),
    resultado, descricaoIndice: "IPCA até ago/2025 e IPCA-E a partir de set/2025", indiceAte: "Setembro/2026",
    rodape: "Processo TESTE · documento de teste",
  };
}

it("gera só a parte pedida (prévias das abas)", async () => {
  const d = dadosC01();
  const contar = async (pdf: Buffer) => Math.max(...(await palavrasDoPdf(new Uint8Array(pdf))).map((p) => p.pagina));
  expect(await contar(await gerarPdf(d, "solicitacao"))).toBe(2);
  expect(await contar(await gerarPdf(d, "exercicio", 2020))).toBe(4);
  const cpex = await palavrasDoPdf(new Uint8Array(await gerarPdf({ ...d,
    processo: { ...d.processo, possuiPensaoJudicial: true },
    complementos: { pensao: { nome: "Maria Pensionista" }, operadorCpex: { nome: "Cb Operador CPEX" } } }, "cpex")));
  const t = cpex.map((p) => p.texto).join(" ");
  expect(t).toContain("Maria Pensionista");
  expect(t).not.toContain("NOME/OP"); // linhas do operador CPEx saíram do documento
  expect(t).not.toContain("Cb Operador CPEX");
}, 60_000);

it("gera o pacote completo com os valores da planilha", async () => {
  const pdf = await gerarPdf(dadosC01());
  mkdirSync(join(__dirname, "saida"), { recursive: true });
  writeFileSync(join(__dirname, "saida", "c01_pacote.pdf"), pdf);
  const palavras = await palavrasDoPdf(new Uint8Array(pdf));
  const paginas = Math.max(...palavras.map((p) => p.pagina));
  // Solicitação de Pagamento e Verso; 2020: solicitação, verso, recebido, devido; recapitulação, CPEX, resumo
  expect(paginas).toBe(9);
  const texto = (pg: number) => palavras.filter((p) => p.pagina === pg).map((p) => p.texto).join(" ");
  expect(texto(1)).toContain("TESTE/2026");          // nº da solicitação de pagamento
  expect(texto(1)).toContain("160001");              // UG
  expect(texto(1)).toContain("( 3 ) Ficha(s)");      // anexo editado
  expect(texto(1)).toContain("( 1 ) Folha(s) de Cálculo(s)"); // anexo padrão: 1 ano no período
  expect(texto(1)).toContain("ORDENADOR TESTE - Ten Cel"); // assinatura: "NOME - Posto"
  expect(texto(2)).toContain("02/09/2026");          // data do requerimento
  expect(texto(2)).toContain("BI/Adt 180 de 20/09/2026");
  expect(texto(2)).toContain("Explicação de teste");
  expect(texto(2)).toContain("Sou de parecer");      // parecer padrão
  expect(texto(3)).toContain("8.347,04");           // importância básica (Solicitação 2020)
  expect(texto(3)).toContain("8.605,18");           // soldo corrigido
  expect(texto(4)).toContain("64.020,00");          // verso: devido total
  expect(texto(4)).toContain("58.200,00");          // verso: recebido total
  expect(texto(5)).toContain("7.225,34");           // recebido corrigido jan/2020 (igual à aba 20-Recebido)
  expect(texto(5)).toContain("44,5068%");           // índice acumulado de jan/2020
  expect(texto(7)).toContain("8.347,04");           // recapitulação
  expect(texto(8)).toContain("5.820,00");           // CPEX sem correção
  expect(texto(8)).toContain("258,14");             // CPEX FUSEX corrigido
  // Assinatura: o Auxiliar Div Pg Pes que gerou o PDF, sem Fiscal Adm nem Chefe da Div Pessoal
  for (const pg of [1, 3, 4, 5, 6, 7, 8]) expect(texto(pg)).toContain("FULANO DE TAL");
  const tudo = palavras.map((p) => p.texto).join(" ");
  expect(tudo).toContain("Auxiliar Div Pg Pes");
  expect(tudo).not.toMatch(/Fiscal|Chefe da Divis/);
}, 60_000); // gerar e reler um PDF inteiro leva alguns segundos

it("comprovação mostra o valor da UFIR, como a planilha (Informações!B17)", async () => {
  const d = { ...dadosC01(), valorUfir: 1.0641 };
  const t = (await palavrasDoPdf(new Uint8Array(await gerarPdf(d, "exercicio", 2020)))).map((p) => p.texto).join(" ");
  expect(t).toContain("UFIR: 1,0641");
}, 60_000);

it("Solicitação de Pagamento: cabeçalho e OD da OM do Ordenador; CODOM da OM de vinculação; número abaixo do título", async () => {
  const d = dadosC01();
  const pdf = await gerarPdf({ ...d, om: { ...d.om, nome: "16º BI Mtz", codom: "007807", omOrdenador: "B Adm Gu Natal" } }, "pacote_completo");
  const t = (await palavrasDoPdf(new Uint8Array(pdf))).map((p) => p.texto).join(" ");
  expect(t).toContain("Do OD do(a): B Adm Gu Natal");
  expect(t).toContain("CODOM: 007807");
  expect(t).toContain("BI MTZ"); // demais documentos: cabeçalho com a OM de vinculação ("16 º BI MTZ" na leitura do PDF)
  const sol = await gerarPdf({ ...d, om: { ...d.om, nome: "16º BI Mtz", omOrdenador: "B Adm Gu Natal" } }, "solicitacao");
  writeFileSync(join(__dirname, "saida", "solicitacao.pdf"), sol);
  const p = await palavrasDoPdf(new Uint8Array(sol));
  const ts = p.map((x) => x.texto).join(" ");
  expect(ts).toContain("B ADM GU NATAL");
  expect(ts).not.toContain("BI MTZ");
  const y = (txt: string) => p.find((x) => x.texto === txt)!.y;
  expect(ts).toContain("Processo Nº");
  expect(y("Processo")).not.toBe(y("PAGAMENTO")); // número na linha de baixo
}, 60_000);

it("verso: amparo e explicação com negrito/itálico/sublinhado saem sem as marcações", async () => {
  const d = dadosC01();
  const pdf = await gerarPdf({ ...d, complementos: { ...d.complementos,
    amparo: "DIEx nº <b>103</b>-ASSE1 de <i>20 Set 26</i>", explicacao: "O militar <u>não recebeu</u> &lt;à época&gt;." } }, "solicitacao");
  const t = (await palavrasDoPdf(new Uint8Array(pdf))).map((p) => p.texto).join(" ");
  expect(t).toContain("103");
  expect(t).toContain("20 Set 26");
  expect(t).toContain("não recebeu");
  expect(t).toContain("<à época>");
  expect(t).not.toContain("<b>");
}, 60_000);

it("verso: vários documentos que materializam o direito, um por linha", async () => {
  const d = dadosC01();
  const pdf = await gerarPdf({ ...d, complementos: { ...d.complementos, amparo: "BI Nr 245-16º BI Mtz\nBI Nr 300-17º GAC" } }, "solicitacao");
  const p = (await palavrasDoPdf(new Uint8Array(pdf))).filter((x) => x.pagina === 2);
  const y = (txt: string) => p.find((x) => x.texto.includes(txt))!.y;
  expect(p.map((x) => x.texto).join(" ")).toContain("300-17");
  expect(y("245-16")).not.toBe(y("300-17"));
}, 60_000);

it("Solicitação de Pagamento: período total da dívida com dia, mês e ano", async () => {
  const d = dadosC01();
  const pdf = await gerarPdf({ ...d, processo: { ...d.processo, periodoInicio: "2022-03-01", periodoFim: "2023-02-28" } }, "solicitacao");
  const t = (await palavrasDoPdf(new Uint8Array(pdf))).filter((x) => x.pagina === 1).map((x) => x.texto).join(" ");
  expect(t).toContain("01/03/2022");
  expect(t).toContain("28/02/2023");
}, 60_000);

it("Nº de Ordem não repete o ano quando o número já o traz", async () => {
  const { numeroOrdem } = await import("../src/comum");
  const d = dadosC01();
  expect(numeroOrdem({ ...d, processo: { ...d.processo, numero: "640093.005344/2026-43", ano: 2026 } })).toBe("640093.005344/2026-43");
  expect(numeroOrdem({ ...d, processo: { ...d.processo, numero: "001", ano: 2026 } })).toBe("001/2026");
});

it("partes separadas: um PDF por documento, na ordem do compilado", async () => {
  const { gerarPartes } = await import("../src");
  const partes = await gerarPartes(dadosC01());
  expect(partes.map((p) => p.nome)).toEqual([
    "01 - Solicitação de Pagamento.pdf", "02 - Solicitação de Pagamento (verso).pdf",
    "03 - 2020 - Solicitação.pdf", "04 - 2020 - Solicitação (verso).pdf",
    "05 - 2020 - Comprovação dos valores recebidos.pdf", "06 - 2020 - Comprovação dos valores devidos.pdf",
    "07 - Recapitulação.pdf", "08 - CPEX.pdf", "09 - Resumo.pdf",
  ]);
  expect(partes.every((p) => p.pdf.subarray(0, 5).toString() === "%PDF-")).toBe(true);
}, 60_000);
