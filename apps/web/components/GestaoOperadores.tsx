"use client";
import { cpfValido } from "@painel-ea/engine";
import { useActionState, useState, useTransition } from "react";
import { Aviso } from "@/components/Aviso";
import { alterarSituacao, criarOperador, excluirOperador, redefinirAcesso, type Resultado } from "@/lib/acoes/usuarios";
import { formatarCpf } from "@/lib/login";
import { POSTOS } from "@/lib/postos";

export interface Operador {
  usuario_id: string; nome: string; posto: string | null; cpf: string | null; om: string | null;
  papel: "operador" | "admin"; ativo: boolean; trocar_senha: boolean;
}

/** Senha provisória mostrada uma única vez, com botão de copiar. */
function SenhaProvisoria({ senha, texto }: { senha: string; texto: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <Aviso tipo="ok">
      <p>{texto} Senha provisória (aparece só agora): repasse ao operador por um meio seguro.</p>
      <p className="mt-2 flex items-center gap-2">
        <code className="rounded bg-white px-2 py-1 font-mono text-base">{senha}</code>
        <button type="button" className="botao-sec py-1" onClick={() => { navigator.clipboard.writeText(senha); setCopiado(true); }}>
          {copiado ? "Copiada" : "Copiar"}
        </button>
      </p>
      <p className="mt-2 text-xs">No próximo acesso, o operador entra com o CPF e essa senha e cria a senha pessoal.</p>
    </Aviso>
  );
}

export function GestaoOperadores({ usuarios, oms, euId }: { usuarios: Operador[]; oms: { id: string; nome: string }[]; euId: string }) {
  const [estado, criar, criando] = useActionState(criarOperador, undefined);
  const [res, setRes] = useState<(Resultado & { texto?: string }) | null>(null);
  const [ocupado, iniciar] = useTransition();
  const [avisoCpf, setAvisoCpf] = useState<string | null>(null);
  const acao = (f: () => Promise<Resultado>, texto?: string) => iniciar(async () => setRes({ ...(await f()), texto }));

  return (
    <div className="space-y-5">
      <section className="cartao space-y-3">
        <h2 className="font-semibold">Novo operador</h2>
        <form action={criar} className="grid gap-3 sm:grid-cols-[8rem_1fr_10rem_1fr_auto] sm:items-start">
          <div><label htmlFor="posto" className="rotulo">Posto/Grad</label>
            {/* abreviações padrão das assinaturas ("NOME - Cb") */}
            <select id="posto" name="posto" className="entrada" defaultValue="">
              <option value="">Selecione…</option>
              {POSTOS.map((p) => <option key={p}>{p}</option>)}
            </select></div>
          <div><label htmlFor="nome" className="rotulo">Nome completo</label><input id="nome" name="nome" required className="entrada" /></div>
          <div>
            <label htmlFor="cpf" className="rotulo">CPF</label>
            <input id="cpf" name="cpf" required inputMode="numeric" maxLength={14} placeholder="000.000.000-00"
              aria-invalid={!!avisoCpf} aria-describedby={avisoCpf ? "cpf-erro" : undefined}
              className={`entrada ${avisoCpf ? "entrada-erro" : ""}`}
              onBlur={(e) => setAvisoCpf(e.target.value.trim() && !cpfValido(e.target.value) ? "CPF inválido." : null)} />
            {avisoCpf && <p id="cpf-erro" className="erro">{avisoCpf}</p>}
          </div>
          <div>
            <label htmlFor="om_id" className="rotulo">OM</label>
            <select id="om_id" name="om_id" required className="entrada" defaultValue={oms.length === 1 ? oms[0]!.id : ""}>
              {oms.length !== 1 && <option value="">Selecione…</option>}
              {oms.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
          </div>
          <button className="botao sm:mt-6" disabled={criando}>{criando ? "Cadastrando…" : "Cadastrar"}</button>
        </form>
        {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
        {estado?.senhaProvisoria && <SenhaProvisoria senha={estado.senhaProvisoria} texto="Operador cadastrado." />}
      </section>

      {res?.erro && <Aviso tipo="erro">{res.erro}</Aviso>}
      {res?.senhaProvisoria && <SenhaProvisoria senha={res.senhaProvisoria} texto={res.texto ?? "Acesso redefinido."} />}
      {res && !res.erro && res.apagado !== undefined && (
        <Aviso tipo="ok">
          {res.apagado ? "Operador excluído." : "Operador excluído. Como ele já tinha registros no sistema, o nome continua na auditoria, mas o login foi bloqueado de vez e o CPF pode ser cadastrado de novo."}
        </Aviso>
      )}

      <section className="cartao overflow-x-auto p-0">
        <table className="w-full min-w-[60rem] text-sm">
          <thead className="text-left text-suave">
            <tr><th className="px-4 py-2">Nome</th><th className="px-3">CPF</th><th className="px-3">OM</th><th className="px-3">Situação</th><th></th></tr>
          </thead>
          <tbody>
            {usuarios.map((u) => {
              const eu = u.usuario_id === euId;
              const operador = u.papel === "operador";
              return (
                <tr key={u.usuario_id} className="border-t border-borda">
                  <td className="min-w-64 px-4 py-2">
                    {[u.posto, u.nome].filter(Boolean).join(" ")}
                    {u.papel === "admin" && <span className="ml-2 bg-marca-100 px-2 py-0.5 text-[11px] uppercase tracking-[.05em] font-semibold text-marca-800">Admin</span>}
                    {eu && <span className="ml-1 text-xs text-suave">(você)</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 font-mono text-suave">{u.cpf ? formatarCpf(u.cpf) : <span className="font-sans text-amber-800">sem CPF</span>}</td>
                  <td className="max-w-56 truncate px-3 text-suave" title={u.om ?? undefined}>{u.om ?? "—"}</td>
                  <td className="whitespace-nowrap px-3">
                    {u.ativo
                      ? <span className="text-green-800">{u.trocar_senha ? "Aguardando 1º acesso" : "Ativo"}</span>
                      : <span className="text-red-800">Desativado</span>}
                  </td>
                  <td className="whitespace-nowrap pr-4 text-right">
                    {operador && !eu && (
                      <span className="inline-flex gap-2">
                        <button className="botao-sec py-1" disabled={ocupado}
                          onClick={() => {
                            if (!confirm(`Redefinir o acesso de ${u.nome}? Será gerada uma nova senha provisória.`)) return;
                            acao(() => redefinirAcesso(u.usuario_id), `Acesso de ${u.nome} redefinido.`);
                          }}>Redefinir acesso</button>
                        <button className="botao-sec py-1" disabled={ocupado}
                          onClick={() => {
                            if (u.ativo && !confirm(`Desativar ${u.nome}? O acesso ao site será bloqueado até ser reativado.`)) return;
                            acao(() => alterarSituacao(u.usuario_id, !u.ativo));
                          }}>{u.ativo ? "Desativar" : "Reativar"}</button>
                        <button className="botao-sec py-1 text-red-800" disabled={ocupado}
                          onClick={() => {
                            if (!confirm(`Excluir ${u.nome}? O login será apagado e não poderá ser recuperado.`)) return;
                            acao(() => excluirOperador(u.usuario_id));
                          }}>Excluir</button>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
