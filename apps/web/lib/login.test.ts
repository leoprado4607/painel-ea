import { describe, expect, it } from "vitest";
import { emailDoCpf, formatarCpf } from "./login";

describe("login por CPF", () => {
  it("converte o CPF, com ou sem máscara, no e-mail técnico", () => {
    expect(emailDoCpf("529.982.247-25")).toBe("52998224725@cpf.painel-ea.local");
    expect(emailDoCpf(" 52998224725 ")).toBe("52998224725@cpf.painel-ea.local");
  });
  it("recusa CPF inválido ou incompleto", () => {
    expect(emailDoCpf("529.982.247-24")).toBeNull();
    expect(emailDoCpf("5299822472")).toBeNull();
    expect(emailDoCpf("")).toBeNull();
  });
  it("formata o CPF para exibição", () => {
    expect(formatarCpf("52998224725")).toBe("529.982.247-25");
    expect(formatarCpf(null)).toBe("");
  });
});
