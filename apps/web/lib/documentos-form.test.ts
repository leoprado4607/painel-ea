import { describe, expect, it } from "vitest";
import { lerFormularioDocumento } from "./documentos-form";

const form = (campos: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.append(k, v);
  return f;
};

describe("textos editáveis dos documentos", () => {
  it("lê só os campos enviados pela aba e mescla com os já gravados", () => {
    const r = lerFormularioDocumento(form({ numero: " 12 ", ano: "2026", "c.anexos.fichas": "3", "c.anexos.bi": "" }),
      { amparo: "já gravado", anexos: { recapitulacao: 2 } });
    expect(r.processo).toEqual({ numero: "12", ano: 2026 });
    expect(r.complementos).toEqual({ amparo: "já gravado", anexos: { recapitulacao: 2, fichas: 3, bi: null } });
  });
  it("pensão: caixa desmarcada só conta quando a aba envia o campo de controle", () => {
    expect(lerFormularioDocumento(form({ possui_pensao_judicial_enviado: "1" }), {}).processo).toEqual({ possui_pensao_judicial: false });
    expect(lerFormularioDocumento(form({ "c.pensao.nome": "Maria" }), {}).processo).toEqual({});
    expect(lerFormularioDocumento(form({ "c.pensao.nome": "Maria" }), { pensao: { cpf: "1" } }).complementos)
      .toEqual({ pensao: { cpf: "1", nome: "Maria" } });
  });
  it("ignora campos desconhecidos e quantidade negativa vira zero", () => {
    const r = lerFormularioDocumento(form({ situacao: "emitido", "c.outro": "x", "c.anexos.fichas": "-4" }), {});
    expect(r.processo).toEqual({});
    expect(r.complementos).toEqual({ anexos: { fichas: 0 } });
  });
});
