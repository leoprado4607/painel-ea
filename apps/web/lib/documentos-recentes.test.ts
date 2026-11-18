import { describe, expect, it } from "vitest";
import { ultimosDocumentos } from "./documentos-recentes";

describe("últimos documentos do operador", () => {
  it("do mais recente para o mais antigo, sem repetir e no máximo 6", () => {
    expect(ultimosDocumentos(["BI 10\nBI 11", null, "<b>bi  10</b>\nBI 12", "", "BI 13\nBI 14", "BI 15\nBI 16"]))
      .toEqual(["BI 10", "BI 11", "BI 12", "BI 13", "BI 14", "BI 15"]);
  });
  it("sem documentos anteriores, nenhuma opção", () => {
    expect(ultimosDocumentos([null, ""])).toEqual([]);
  });
});
