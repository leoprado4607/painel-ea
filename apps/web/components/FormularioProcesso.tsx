"use client";
import { cpfValido, identidadeValida, precCpValido } from "@painel-ea/engine";
import { useActionState, useState } from "react";
import { Aviso } from "@/components/Aviso";
import { salvarProcesso, type EstadoForm } from "@/lib/acoes/processo";
import { BANCOS, SITUACOES, type Militar, type Processo } from "@/lib/tipos";

/** "situacao" do formulário é a do militar (Ativa, Reformado…); a do processo (rascunho/emitido) fica de fora. */
export type Valores = Partial<Omit<Processo, "situacao"> & Militar>;

function Campo({ nome, rotulo, valor, tipo = "text", ajuda, erro, obrigatorio, validar, ...resto }: {
  nome: string; rotulo: string; valor?: string | number | null; tipo?: string; ajuda?: string; erro?: string;
  obrigatorio?: boolean; validar?: (v: string) => string | null;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const [aviso, setAviso] = useState<string | null>(null);
  const msg = erro ?? aviso;
  return (
    <div>
      <label htmlFor={nome} className="rotulo">{rotulo}{obrigatorio && <span className="text-red-700"> *</span>}</label>
      <input id={nome} name={nome} type={tipo} defaultValue={valor ?? ""} required={obrigatorio}
        aria-invalid={!!msg} aria-describedby={msg ? `${nome}-erro` : undefined}
        className={`entrada ${msg ? "entrada-erro" : ""}`}
        onBlur={validar ? (e) => setAviso(e.target.value.trim() ? validar(e.target.value) : null) : undefined} {...resto} />
      {msg ? <p id={`${nome}-erro`} className="erro">{msg}</p> : ajuda && <p className="ajuda">{ajuda}</p>}
    </div>
  );
}

function Lista({ nome, rotulo, valor, opcoes, aceitaOutro }: { nome: string; rotulo: string; valor?: string | null; opcoes: string[]; aceitaOutro?: boolean }) {
  const atual = valor && (aceitaOutro || opcoes.includes(valor)) ? valor : "";
  return (
    <div>
      <label htmlFor={nome} className="rotulo">{rotulo}</label>
      <select id={nome} name={nome} defaultValue={atual} className="entrada">
        <option value="">Selecione…</option>
        {/* valor lido de um documento e fora da lista (ex.: banco "077") continua aparecendo */}
        {atual && !opcoes.includes(atual) && <option>{atual}</option>}
        {opcoes.map((o) => <option key={o}>{o}</option>)}
      </select>
    </div>
  );
}

/** Escolha da OM de um processo novo: só aparece para o Admin quando há mais de uma OM. */
export function EscolhaOm({ oms, id = "om_id", erro }: { oms: { id: string; nome: string }[]; id?: string; erro?: string }) {
  if (!oms.length) return null;
  return (
    <div>
      <label htmlFor={id} className="rotulo">OM do processo<span className="text-red-700"> *</span></label>
      <select id={id} name="om_id" required defaultValue="" className={`entrada ${erro ? "entrada-erro" : ""}`}>
        <option value="">Selecione…</option>
        {oms.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
      </select>
      {erro && <p className="erro">{erro}</p>}
    </div>
  );
}

export function FormularioProcesso({ processoId, valores = {}, bloqueado, oms = [], aoLimpar }: {
  processoId: string | null; valores?: Valores; bloqueado?: boolean; oms?: { id: string; nome: string }[];
  /** "Dados do favorecido": esvazia os campos preenchidos pelos PDFs (só no formulário, até salvar). */
  aoLimpar?: () => void;
}) {
  const [estado, acao, enviando] = useActionState<EstadoForm | undefined, FormData>(salvarProcesso.bind(null, processoId), undefined);
  const c = estado?.campos ?? {};
  const mes = (d?: string | null) => (d ? d.slice(0, 7) : "");
  return (
    <form action={acao} className="space-y-6">
      {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      <fieldset disabled={bloqueado} className="space-y-6">
        {oms.length > 0 && <section className="cartao sm:max-w-md"><EscolhaOm oms={oms} erro={c.om_id} /></section>}
        <section className="cartao">
          <h2 className="mb-4 font-semibold">Militar</h2>
          <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
            <Campo nome="posto_graduacao" rotulo="Posto/Graduação" valor={valores.posto_graduacao} placeholder="1º Sgt" />
            <Campo nome="nome" rotulo="Nome completo" valor={valores.nome} obrigatorio erro={c.nome} />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Campo nome="prec_cp" rotulo="Prec-CP" valor={valores.prec_cp} inputMode="numeric" erro={c.prec_cp}
              validar={(v) => (precCpValido(v) ? null : "Dígito verificador não confere.")} />
            <Campo nome="identidade" rotulo="Identidade militar" valor={valores.identidade} placeholder="000.000.000-0"
              validar={(v) => (identidadeValida(v) ? null : "Confira o número (regra do dígito ainda em validação).")} />
            <Campo nome="cpf" rotulo="CPF" valor={valores.cpf} placeholder="000.000.000-00" erro={c.cpf}
              validar={(v) => (cpfValido(v) ? null : "CPF inválido.")} />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-4">
            <Lista nome="banco" rotulo="Banco" valor={valores.banco} opcoes={BANCOS} aceitaOutro />
            <Campo nome="agencia" rotulo="Agência" valor={valores.agencia} />
            <Campo nome="conta" rotulo="Conta" valor={valores.conta} />
            <Lista nome="situacao" rotulo="Situação" valor={valores.situacao} opcoes={SITUACOES} />
          </div>
          <div className="mt-4">
            <Campo nome="om_vinculacao" rotulo="OM de vinculação (órgão pagador)" valor={valores.om_vinculacao} placeholder="Ex.: B ADM GU NATAL" />
          </div>
        </section>

        <section className="cartao">
          <h2 className="mb-4 font-semibold">Dívida e processo</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Campo nome="periodo_inicio" rotulo="Início da dívida" tipo="month" valor={mes(valores.periodo_inicio)} obrigatorio />
            <Campo nome="periodo_fim" rotulo="Fim da dívida" tipo="month" valor={mes(valores.periodo_fim)} obrigatorio erro={c.periodo} />
            <Campo nome="especie_divida" rotulo="Espécie da dívida" valor={valores.especie_divida} placeholder="Ex.: diferença de adicional" />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-4">
            <Campo nome="numero" rotulo="Nº do processo" valor={valores.numero} />
            <Campo nome="ano" rotulo="Ano do processo" tipo="number" valor={valores.ano} min={2000} max={2100} />
            <Campo nome="data_requerimento" rotulo="Data do requerimento" tipo="date" valor={valores.data_requerimento} />
            <Campo nome="data_solicitacao_extenso" rotulo="Data por extenso" valor={valores.data_solicitacao_extenso} placeholder="17 de outubro de 2026" />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-4">
            <Campo nome="bi_numero" rotulo="Nº BI/Adt averbação" valor={valores.bi_numero} />
            <Campo nome="bi_data" rotulo="Data do BI" tipo="date" valor={valores.bi_data} />
            <label className="flex items-center gap-2 self-end pb-2 text-sm sm:col-span-2">
              <input type="checkbox" name="possui_pensao_judicial" defaultChecked={valores.possui_pensao_judicial} className="h-4 w-4 accent-marca-700" />
              Possui pensão judicial no período da dívida
            </label>
          </div>
        </section>
      </fieldset>
      {!bloqueado && (
        <div className="flex justify-end">
          {aoLimpar && (
            <button type="button" className="botao-sec" disabled={enviando}
              onClick={() => { if (confirm("Limpar os dados carregados pelos PDFs? Nome, P/G, Prec-CP, CPF, identidade, OM de vinculação, banco, agência e conta ficam em branco no formulário. Nada é apagado até você salvar.")) aoLimpar(); }}>
              Limpar
            </button>
          )}
          <button className="botao" disabled={enviando}>{enviando ? "Salvando…" : "Salvar e continuar"}</button>
        </div>
      )}
    </form>
  );
}
