/**
 * Testa o leitor com as fichas reais de exemplos/fichas (pasta fora do Git).
 * Sem os arquivos, o teste é pulado. Não imprime dados pessoais: só estrutura e conferências.
 */
import { cpfValido, identidadeValida, precCpValido } from "@painel-ea/engine";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { lerFichaPdf } from "../src";

const PASTA = join(__dirname, "..", "..", "..", "exemplos", "fichas");
const arquivos = existsSync(PASTA) ? readdirSync(PASTA).filter((f) => f.toLowerCase().endsWith(".pdf")) : [];

describe.skipIf(arquivos.length === 0).each(arquivos)("ficha real %s", (arq) => {
  it("lê cabeçalho e linhas, e as conferências batem", async () => {
    const f = await lerFichaPdf(new Uint8Array(readFileSync(join(PASTA, arq))));
    console.log(arq, JSON.stringify({
      ano: f.ano, posto: f.cabecalho.posto, codom: f.cabecalho.codom, rm: f.cabecalho.rm, siglaUa: f.cabecalho.siglaUa,
      temNome: !!f.cabecalho.nome, precCpValido: f.cabecalho.precCp ? precCpValido(f.cabecalho.precCp) : null,
      cpfValido: f.cabecalho.cpf ? cpfValido(f.cabecalho.cpf) : null,
      identidade: f.cabecalho.identidade ? { digitos: f.cabecalho.identidade.length, regraInferida: identidadeValida(f.cabecalho.identidade) } : null,
      linhas: f.linhas.map((l) => `${l.codigo} ${l.descricao}`), conferencias: f.conferencias, avisos: f.avisos,
    }, null, 1));
    expect(f.ano).toBeGreaterThan(2000);
    expect(f.cabecalho.nome).toBeTruthy();
    expect(f.linhas.length).toBeGreaterThan(5);
    expect(f.conferencias.linhasDivergentes).toEqual([]);
    expect(f.conferencias.mesesDivergentes).toEqual([]);
    expect(f.avisos).toEqual([]);
  });
});
