"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Aviso } from "@/components/Aviso";
import { supabaseNavegador } from "@/lib/supabase/client";

/** Segundo fator (TOTP): cadastra o aplicativo autenticador no 1º acesso e pede o código nos seguintes. */
export default function Mfa() {
  const supabase = supabaseNavegador();
  const router = useRouter();
  const [fator, setFator] = useState<{ id: string; qr?: string; segredo?: string } | null>(null);
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) return setErro(error.message);
      const ativo = data.totp.find((f) => f.status === "verified");
      if (ativo) return setFator({ id: ativo.id });
      // limpa cadastros iniciados e não concluídos antes de criar um novo
      for (const f of data.all.filter((f) => f.status === "unverified")) await supabase.auth.mfa.unenroll({ factorId: f.id });
      const novo = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Autenticador" });
      if (novo.error) return setErro(novo.error.message);
      setFator({ id: novo.data.id, qr: novo.data.totp.qr_code, segredo: novo.data.totp.secret });
    })();
  }, [supabase]);

  async function verificar(e: React.FormEvent) {
    e.preventDefault();
    if (!fator) return;
    setOcupado(true);
    setErro(null);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: fator.id, code: codigo.trim() });
    setOcupado(false);
    if (error) return setErro("Código inválido ou vencido. Confira o relógio do celular e tente de novo.");
    router.replace("/passo-a-passo");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={verificar} className="cartao w-full max-w-sm space-y-4">
        <h1 className="text-lg font-bold">Verificação em duas etapas</h1>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        {fator?.qr && (
          <div className="space-y-2 text-sm">
            <p>Primeiro acesso: leia o QR code com um aplicativo autenticador (Google Authenticator, Microsoft Authenticator…).</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fator.qr} alt="QR code para o aplicativo autenticador" className="mx-auto h-44 w-44" />
            <p className="ajuda break-all">Ou digite a chave: {fator.segredo}</p>
          </div>
        )}
        {fator && !fator.qr && <p className="text-sm">Digite o código de 6 dígitos do seu aplicativo autenticador.</p>}
        <div>
          <label htmlFor="codigo" className="rotulo">Código</label>
          <input id="codigo" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required
            value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))} className="entrada tracking-[0.4em]" />
        </div>
        <button className="botao w-full" disabled={!fator || ocupado}>{ocupado ? "Verificando…" : "Confirmar"}</button>
      </form>
    </main>
  );
}
