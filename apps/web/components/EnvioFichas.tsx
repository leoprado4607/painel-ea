"use client";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { Aviso } from "@/components/Aviso";
import { aplicarFichas, analisarFichas, type Previa } from "@/lib/acoes/fichas";
import { formatarReais } from "@/lib/dinheiro";

interface Props {
  processoId: string;
  rubricas: { posicao: number; codigo: string }[];
  /** Prévia dos PDFs já guardados (ex.: logo depois de criar o processo pelas fichas). */
  previaInicial?: Previa;
  bloqueado: boolean;
}

/** Envio das fichas financeiras em PDF: lê, mostra o que entrou e o que ficou de fora, e grava os valores recebidos. */
export function EnvioFichas({ processoId, rubricas, previaInicial, bloqueado }: Props) {
  const router = useRouter();
  const [estado, enviar, lendo] = useActionState(analisarFichas.bind(null, processoId), previaInicial);
  const [escolhas, setEscolhas] = useState<Record<string, number>>({});
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [gravando, iniciar] = useTransition();
  const previa = estado;
  const temPrevia = !!previa?.fichas?.length;
  const ativas = rubricas.filter((r) => r.codigo);
  const naoUsadasPorCodigo = Object.values(
    (previa?.naoUsadas ?? []).reduce<Record<string, { codigo: string; descricao: string; natureza: string; anos: number[]; total: number }>>((acc, l) => {
      const a = (acc[l.codigo] ??= { codigo: l.codigo, descricao: l.descricao, natureza: l.natureza, anos: [], total: 0 });
      a.anos.push(l.ano);
      a.total += l.total;
      return acc;
    }, {}),
  );

  const aplicar = () => iniciar(async () => {
    const r = await aplicarFichas(processoId, previa!.fichas!.map((f) => f.documentoId), escolhas);
    if ("erro" in r && r.erro) return setMsg({ tipo: "erro", texto: r.erro });
    if ("gravados" in r) setMsg({ tipo: "ok", texto: `${r.gravados} valores gravados nos anos ${r.anos.join(", ")}. Confira mês a mês abaixo.` });
    router.refresh();
  });

  return (
    <section className="cartao space-y-4">
      <div>
        <h2 className="font-semibold">Fichas financeiras (PDF)</h2>
        <p className="text-sm text-suave">
          Envie as fichas do SIPPES dos anos da dívida. O site lê os valores e confere cada ficha (soma dos meses e totais líquidos).
          Ao gravar, os valores recebidos dos anos enviados são substituídos pelos da ficha.
        </p>
      </div>

      {!bloqueado && (
        <form action={enviar} className="flex flex-wrap items-center gap-3">
          <label htmlFor="fichas" className="sr-only">Arquivos PDF</label>
          <input id="fichas" name="fichas" type="file" accept="application/pdf,.pdf" multiple required
            className="text-sm file:mr-3 file:rounded-md file:border file:border-borda file:bg-white file:px-3 file:py-1.5 file:text-sm" />
          <button className="botao-sec" disabled={lendo}>{lendo ? "Lendo…" : "Ler fichas"}</button>
        </form>
      )}

      {previa?.erro && <Aviso tipo="erro">{previa.erro}</Aviso>}
      {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}

      {temPrevia && (
        <div className="space-y-4">
          <ul className="space-y-1 text-sm">
            {previa!.fichas!.map((f) => (
              <li key={f.documentoId} className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${f.conferenciaOk ? "bg-green-100 text-green-900" : "bg-red-100 text-red-900"}`}>
                  {f.conferenciaOk ? "conferida" : "não conferiu"}
                </span>
                <span className="font-medium">{f.ano ?? "ano ?"}</span>
                <span className="text-suave">{f.arquivo} · {f.linhas} linhas</span>
                {f.avisos.length > 0 && <span className="text-xs text-amber-800">{f.avisos.join("; ")}</span>}
              </li>
            ))}
          </ul>
          {previa!.fichas!.some((f) => !f.conferenciaOk) && (
            <Aviso tipo="atencao">Alguma ficha não fechou nas conferências. Confira os valores desse ano com atenção antes de usar.</Aviso>
          )}
          {!!previa!.divergenciasMilitar?.length && (
            <Aviso tipo="atencao">
              O cabeçalho da ficha não confere com o cadastro do militar em: {previa!.divergenciasMilitar!.join(", ")}. Verifique se a ficha é do militar certo.
            </Aviso>
          )}

          <p className="text-sm">
            <strong>{previa!.lancamentos?.length ?? 0}</strong> valores mensais vão para as rubricas do processo
            {previa!.anos?.length ? ` (${previa!.anos.join(", ")})` : ""}.
          </p>

          {naoUsadasPorCodigo.length > 0 && (
            <div>
              <h3 className="mb-1 text-sm font-semibold">Códigos da ficha que não entram no cálculo</h3>
              <p className="ajuda mb-2">Imposto, empréstimos, acertos etc. ficam de fora. Se algum deve entrar, escolha a rubrica.</p>
              <div className="divide-y divide-borda rounded-md border border-borda">
                {naoUsadasPorCodigo.map((l) => (
                  <div key={l.codigo} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span>
                      <span className="font-mono text-xs text-suave">{l.codigo}</span> {l.descricao}
                      <span className="ml-2 text-xs text-suave">{l.natureza} · {l.anos.join(", ")} · R$ {formatarReais(l.total)}</span>
                    </span>
                    <label className="sr-only" htmlFor={`esc-${l.codigo}`}>Rubrica para {l.codigo}</label>
                    <select id={`esc-${l.codigo}`} className="entrada w-auto py-1" disabled={bloqueado}
                      value={escolhas[l.codigo] ?? ""}
                      onChange={(e) => setEscolhas((x) => {
                        const { [l.codigo]: _, ...resto } = x;
                        return e.target.value ? { ...resto, [l.codigo]: Number(e.target.value) } : resto;
                      })}>
                      <option value="">Não usar</option>
                      {ativas.map((r) => <option key={r.posicao} value={r.posicao}>Somar em {r.codigo}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!bloqueado && (
            <div className="flex justify-end">
              <button className="botao" disabled={gravando} onClick={aplicar}>{gravando ? "Gravando…" : "Gravar valores recebidos"}</button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
