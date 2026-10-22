"use client";
import { cpfValido, identidadeValida, precCpValido } from "@painel-ea/engine";
import { useActionState, useRef, useState } from "react";
import { documentosDoAmparo, LIMITE_DOCUMENTO } from "@/lib/amparo";
import { PopupPendencias, pendenciasDoFormulario, type Pendencia } from "@/components/PopupPendencias";
import { Aviso } from "@/components/Aviso";
import { EditorFormatado } from "@/components/EditorFormatado";
import { POSTOS, postoAbreviado } from "@/lib/postos";
import { salvarProcesso, type EstadoForm } from "@/lib/acoes/processo";
import { BOLETINS_ADT, DOCUMENTOS_AVERBACAO, numeroBoletimValido, OMS_AVERBACAO } from "@/lib/averbacao";
import { BANCOS, bancoDaLista, ESPECIES_DIVIDA, omDeVinculacao, OMS_VINCULACAO, quantidadeMeses, SITUACOES, type Militar, type Processo } from "@/lib/tipos";

/** "situacao" do formulário é a do militar (Ativa, Reformado…); a do processo (rascunho/emitido) fica de fora. */
export type Valores = Partial<Omit<Processo, "situacao"> & Militar>;

function Campo({ nome, rotulo, valor, tipo = "text", ajuda, erro, obrigatorio, validar, classeEntrada = "", ...resto }: {
  nome: string; rotulo: string; valor?: string | number | null; tipo?: string; ajuda?: string; erro?: string;
  obrigatorio?: boolean; validar?: (v: string) => string | null;
  /** classes extras do campo (ex.: largura de 3 caracteres) */
  classeEntrada?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const [aviso, setAviso] = useState<string | null>(null);
  const msg = erro ?? aviso;
  return (
    <div>
      <label htmlFor={nome} className="rotulo">{rotulo}{obrigatorio && <span className="text-red-700"> *</span>}</label>
      <input id={nome} name={nome} type={tipo} defaultValue={valor ?? ""} required={obrigatorio}
        aria-invalid={!!msg} aria-describedby={msg ? `${nome}-erro` : undefined}
        className={`entrada ${classeEntrada} ${msg ? "entrada-erro" : ""}`}
        onBlur={validar ? (e) => setAviso(e.target.value.trim() ? validar(e.target.value) : null) : undefined} {...resto} />
      {msg ? <p id={`${nome}-erro`} className="erro">{msg}</p> : ajuda && <p className="ajuda">{ajuda}</p>}
    </div>
  );
}

function Lista({ nome, rotulo, valor, opcoes, aceitaOutro, obrigatorio, erro }: {
  nome: string; rotulo: string; valor?: string | null; opcoes: string[]; aceitaOutro?: boolean; obrigatorio?: boolean; erro?: string;
}) {
  const atual = valor && (aceitaOutro || opcoes.includes(valor)) ? valor : "";
  return (
    <div>
      <label htmlFor={nome} className="rotulo">{rotulo}{obrigatorio && <span className="text-red-700"> *</span>}</label>
      <select id={nome} name={nome} defaultValue={atual} required={obrigatorio} aria-invalid={!!erro}
        className={`entrada ${erro ? "entrada-erro" : ""}`}>
        <option value="">Selecione…</option>
        {/* valor lido de um documento e fora da lista (ex.: banco "077") continua aparecendo */}
        {atual && !opcoes.includes(atual) && <option>{atual}</option>}
        {opcoes.map((o) => <option key={o}>{o}</option>)}
      </select>
      {erro && <p className="erro">{erro}</p>}
    </div>
  );
}

/** Averbação do direito: documento (BI, Adt, BAR), Nr Adt e o BI/BAR de que o Adt faz parte (só quando Adt), Nr BI/BAR, OM e data. */
function CamposAverbacao({ valores, erros }: { valores: Valores; erros: Record<string, string> }) {
  const [documento, setDocumento] = useState(valores.documento_averbacao ?? "");
  return (
    <fieldset className="mt-4">
      <legend className="mb-2 text-sm font-semibold text-tinta">Averbação</legend>
      {/* os números (3 dígitos) ocupam só a própria largura; listas e data dividem o resto */}
      <div className={`grid gap-4 ${documento === "Adt"
        ? "sm:grid-cols-[minmax(9rem,1fr)_auto_minmax(7rem,.7fr)_auto_minmax(11rem,1.4fr)_minmax(9rem,1fr)]"
        : "sm:grid-cols-[minmax(9rem,1fr)_auto_minmax(11rem,1.4fr)_minmax(9rem,1fr)]"}`}>
        <div>
          <label htmlFor="documento_averbacao" className="rotulo">Documento de averbação<span className="text-red-700"> *</span></label>
          <select id="documento_averbacao" name="documento_averbacao" value={documento} onChange={(e) => setDocumento(e.target.value)} required
            aria-invalid={!!erros.documento_averbacao} className={`entrada ${erros.documento_averbacao ? "entrada-erro" : ""}`}>
            <option value="">Selecione…</option>
            {DOCUMENTOS_AVERBACAO.map((d) => <option key={d}>{d}</option>)}
          </select>
          {erros.documento_averbacao && <p className="erro">{erros.documento_averbacao}</p>}
        </div>
        {documento === "Adt" && (
          <Campo nome="adt_numero" rotulo="Nr Adt" valor={valores.adt_numero} obrigatorio inputMode="numeric" maxLength={3} classeEntrada="w-[4.5rem] text-center tabular-nums"
            erro={erros.adt_numero} validar={(v) => (/^\d{1,3}$/.test(v.trim()) ? null : "Até 3 dígitos.")} />
        )}
        {/* todo Adt é parte de um BI ou de um BAR */}
        {documento === "Adt" && (
          <Lista nome="adt_boletim" rotulo="Boletim do Adt" valor={valores.adt_boletim} opcoes={[...BOLETINS_ADT]} obrigatorio erro={erros.adt_boletim} />
        )}
        <Campo nome="bi_numero" rotulo="Nr BI/BAR" valor={valores.bi_numero} obrigatorio inputMode="numeric" maxLength={3} pattern="\d{1,3}"
          title="Até 3 dígitos" classeEntrada="w-[4.5rem] text-center tabular-nums" erro={erros.bi_numero}
          validar={(v) => (numeroBoletimValido(v.trim()) ? null : "Use até 3 dígitos (ex.: 45).")} />
        <Lista nome="om_averbacao" rotulo="OM averbação" valor={valores.om_averbacao} opcoes={[...OMS_AVERBACAO]} obrigatorio erro={erros.om_averbacao} />
        <Campo nome="bi_data" rotulo="Data averbação" tipo="date" valor={valores.bi_data} obrigatorio erro={erros.bi_data} />
      </div>
    </fieldset>
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

/** Documentos que materializam o direito: uma linha cada; "+" acrescenta outro, "−" tira (o primeiro é obrigatório). */
function DocumentosDireito({ valor, erros, bloqueado }: { valor?: string | null; erros: Record<string, string>; bloqueado?: boolean }) {
  const proximo = useRef(0);
  const [docs, setDocs] = useState(() => documentosDoAmparo(valor).map((texto) => ({ id: proximo.current++, texto })));
  const botao = "grid h-[38px] w-[38px] shrink-0 place-items-center border border-borda bg-white text-lg leading-none hover:border-ouro/50 hover:bg-creme disabled:opacity-50";
  return (
    <div className="space-y-3">
      {docs.map((d, i) => (
        <EditorFormatado key={d.id} nome="c.amparo" idBase={`c.amparo-${d.id}`} rotulo={i ? `Nº/data do documento ${i + 1}` : "Nº/data do documento"}
          rotuloOculto ferramentasAEsquerda umaLinha valor={d.texto} limite={LIMITE_DOCUMENTO} obrigatorio={i === 0}
          erro={erros[i ? `c.amparo.${i}` : "c.amparo"]} bloqueado={bloqueado}
          placeholder="Ex: BI Nr 245-16º BI Mtz, de 10 de outubro de 2026."
          aoLado={!bloqueado && (
            <>
              {i > 0 && <button type="button" className={botao} aria-label={`Remover o documento ${i + 1}`} title="Remover este documento"
                onClick={() => setDocs((l) => l.filter((x) => x.id !== d.id))}>−</button>}
              {i === docs.length - 1 && <button type="button" className={botao} aria-label="Adicionar outro documento que materializa o direito"
                title="Adicionar outro documento" onClick={() => setDocs((l) => [...l, { id: proximo.current++, texto: "" }])}>+</button>}
            </>
          )} />
      ))}
    </div>
  );
}

export function FormularioProcesso({ processoId, valores = {}, bloqueado, oms = [], aoLimpar }: {
  processoId: string | null; valores?: Valores; bloqueado?: boolean; oms?: { id: string; nome: string }[];
  /** "Informações": esvazia os campos preenchidos pelos PDFs (só no formulário, até salvar). */
  aoLimpar?: () => void;
}) {
  const [estado, acao, enviando] = useActionState<EstadoForm | undefined, FormData>(salvarProcesso.bind(null, processoId), undefined);
  const c = estado?.campos ?? {};
  const [inicio, setInicio] = useState(valores.periodo_inicio ?? "");
  const [fim, setFim] = useState(valores.periodo_fim ?? "");
  const qtdeMeses = quantidadeMeses(inicio, fim);
  // ao salvar com campo obrigatório vazio: pop-up com as pendências (no lugar do balão do navegador)
  const [pendentes, setPendentes] = useState<{ pendencias: Pendencia[]; primeiro: HTMLElement | null } | null>(null);
  return (
    <form action={acao} className="space-y-6" noValidate
      onSubmit={(e) => {
        const form = e.currentTarget;
        const r = pendenciasDoFormulario(form);
        if (r.pendencias.length) { e.preventDefault(); setPendentes(r); return; }
        // demais regras do navegador (formato, mínimo/máximo) continuam com o aviso dele
        if (!form.checkValidity()) { e.preventDefault(); form.reportValidity(); }
      }}>
      {pendentes && <PopupPendencias pendencias={pendentes.pendencias}
        aoFechar={() => { const el = pendentes.primeiro; setPendentes(null); setTimeout(() => el?.focus(), 0); }} />}
      {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      <fieldset disabled={bloqueado} className="space-y-6">
        {oms.length > 0 && <section className="cartao sm:max-w-md"><EscolhaOm oms={oms} erro={c.om_id} /></section>}
        <section className="cartao">
          <h2 className="mb-4 font-semibold">Militar</h2>
          <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
            {/* abreviações padrão; posto lido por extenso ("PRIMEIRO SARGENTO") aparece já abreviado */}
            <Lista nome="posto_graduacao" rotulo="Posto/Graduação" valor={postoAbreviado(valores.posto_graduacao)} opcoes={[...POSTOS]} aceitaOutro
              obrigatorio erro={c.posto_graduacao} />
            <Campo nome="nome" rotulo="Nome completo" valor={valores.nome} obrigatorio erro={c.nome} />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Campo nome="prec_cp" rotulo="Prec-CP" valor={valores.prec_cp} inputMode="numeric" obrigatorio erro={c.prec_cp}
              validar={(v) => (precCpValido(v) ? null : "Dígito verificador não confere.")} />
            <Campo nome="identidade" rotulo="Identidade militar" valor={valores.identidade} placeholder="000.000.000-0" obrigatorio erro={c.identidade}
              validar={(v) => (identidadeValida(v) ? null : "Confira o número (regra do dígito ainda em validação).")} />
            <Campo nome="cpf" rotulo="CPF" valor={valores.cpf} placeholder="000.000.000-00" obrigatorio erro={c.cpf}
              validar={(v) => (cpfValido(v) ? null : "CPF inválido.")} />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-[14rem_1fr]">
            <Lista nome="situacao" rotulo="Situação" valor={valores.situacao} opcoes={SITUACOES} obrigatorio erro={c.situacao} />
            {/* nome e CODOM da OM nos documentos vêm daqui; valor lido do PDF fora da lista aparece para o operador trocar */}
            <Lista nome="om_vinculacao" rotulo="OM de vinculação (órgão pagador)" valor={omDeVinculacao(valores.om_vinculacao)?.nome ?? valores.om_vinculacao}
              opcoes={OMS_VINCULACAO.map((o) => o.nome)} aceitaOutro obrigatorio erro={c.om_vinculacao} />
          </div>
        </section>

        {/* dados bancários num quadro próprio (pedido do usuário) */}
        <section className="cartao">
          <h2 className="mb-4 font-semibold">Dados bancários</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {/* banco gravado com o nome antigo ("001 - Brasil") aparece pelo código na lista atual; fora da lista (lido do PDF) continua aparecendo */}
            <Lista nome="banco" rotulo="Banco" valor={bancoDaLista(valores.banco) ?? null} opcoes={BANCOS} aceitaOutro obrigatorio erro={c.banco} />
            <Campo nome="agencia" rotulo="Agência" valor={valores.agencia} obrigatorio erro={c.agencia} />
            <Campo nome="conta" rotulo="Conta corrente" valor={valores.conta} obrigatorio erro={c.conta} />
          </div>
        </section>

        <section className="cartao">
          <h2 className="mb-4 font-semibold">Dívida e processo</h2>
          <div className="grid gap-4 sm:grid-cols-[1fr_1fr_6.5rem_1.4fr]">
            <Campo nome="periodo_inicio" rotulo="Início da dívida" tipo="date" valor={valores.periodo_inicio} obrigatorio erro={c.periodo_inicio}
              onChange={(e) => setInicio(e.target.value)} />
            <Campo nome="periodo_fim" rotulo="Fim da dívida" tipo="date" valor={valores.periodo_fim} obrigatorio erro={c.periodo ?? c.periodo_fim}
              onChange={(e) => setFim(e.target.value)} />
            {/* calculado: mês com pelo menos 1 dia no período conta inteiro; não é gravado */}
            <div>
              <label htmlFor="qtde_meses" className="rotulo">Qtde meses</label>
              <output id="qtde_meses" htmlFor="periodo_inicio periodo_fim" aria-live="polite"
                className="entrada block bg-gray-50 text-center tabular-nums">{qtdeMeses ?? "–"}</output>
            </div>
            <Lista nome="especie_divida" rotulo="Espécie da dívida" valor={valores.especie_divida} opcoes={ESPECIES_DIVIDA} obrigatorio erro={c.especie_divida} />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Campo nome="numero" rotulo="Nº do processo" valor={valores.numero} obrigatorio erro={c.numero} />
            <Campo nome="ano" rotulo="Ano do processo" tipo="number" valor={valores.ano} min={2000} max={2100} obrigatorio erro={c.ano} />
            <Campo nome="data_requerimento" rotulo="Data do requerimento" tipo="date" valor={valores.data_requerimento} obrigatorio erro={c.data_requerimento} />
          </div>
          <CamposAverbacao valores={valores} erros={c} />
          <div className="mt-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="possui_pensao_judicial" defaultChecked={valores.possui_pensao_judicial} className="h-4 w-4 accent-marca-700" />
              Possui pensão judicial no período da dívida
            </label>
          </div>
        </section>

        {/* textos do verso da Solicitação de Pagamento (colunas "Nº/Data Doc/Materializou Direito" e "Explicação…") */}
        <section className="cartao">
          <h2 className="mb-3 font-semibold">Documento que materializa o direito</h2>
          <DocumentosDireito valor={valores.complementos?.amparo} erros={c} bloqueado={bloqueado} />
        </section>
        <section className="cartao">
          <h2 className="mb-3 font-semibold">Explicação do não pagamento à época</h2>
          <EditorFormatado nome="c.explicacao" rotulo="Explicação" rotuloOculto ferramentasAEsquerda valor={valores.complementos?.explicacao} limite={800}
            arrumarColado justificado obrigatorio erro={c["c.explicacao"]} bloqueado={bloqueado}
            placeholder="Ex.: O militar fazia jus a … no período de … e não recebeu à época porque …" />
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
