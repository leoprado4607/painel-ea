import { strFromU8, unzipSync, zipSync } from "fflate";
import { expect, it } from "vitest";
import { caminhoDoZip, nomeDoPacote } from "./pacote";

it("nome da pasta/ZIP sem caracteres proibidos e ZIP ao lado do PDF", () => {
  expect(nomeDoPacote("640093.005344/2026-43", "SANDRO LUIS DE LIMA GONCALVES")).toBe("Processo 640093.005344-2026-43 - SANDRO LUIS DE LIMA GONCALVES");
  expect(nomeDoPacote(null, "FULANO")).toBe("Processo sem número - FULANO");
  expect(caminhoDoZip("om/proc/emissao-v2.pdf")).toBe("om/proc/emissao-v2.zip");
  // estrutura do ZIP: uma pasta com os PDFs
  const zip = zipSync({ "Processo 1 - X": { "01 - Solicitação de Pagamento.pdf": new TextEncoder().encode("%PDF-teste") } });
  const arquivos = unzipSync(zip);
  expect(Object.keys(arquivos)).toEqual(["Processo 1 - X/", "Processo 1 - X/01 - Solicitação de Pagamento.pdf"]);
  expect(strFromU8(arquivos["Processo 1 - X/01 - Solicitação de Pagamento.pdf"]!)).toBe("%PDF-teste");
});
