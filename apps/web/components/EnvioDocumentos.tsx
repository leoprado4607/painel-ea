"use client";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { Aviso } from "@/components/Aviso";
import { analisarDocumentos, gravarRecebidos, type Previa } from "@/lib/acoes/fichas";
import { formatarReais } from "@/lib/dinheiro";
import type { DadosLidos } from "@/lib/favorecido";
import { formatarCpf } from "@/lib/login";

interface Props {
  processoId: string;
  rubricas: { posicao: number; codigo: string }[];
  bloqueado: boolean;
  /** Na aba "Dados do favorecido": recebe os dados lidos para preencher o formulário. */
  aoLerDados?: (dados: DadosLidos) => void;
}

const ROTULOS: [keyof DadosLidos, string][] = [
  ["posto_graduacao", "P/G de pagamento"], ["nome", "Nome"], ["prec_cp", "Prec-CP"], ["cpf", "CPF"], ["identidade", "Identidade"],
  ["om_vinculacao", "OM de vinculação"], ["banco", "Banco"], ["agencia", "Agência"], ["conta", "Conta corrente"],
];

/**
 * Envio de contracheques e fichas financeiras em PDF (um ou vários, misturados). O arquivo é lido e descartado:
 * mostra o que foi encontrado, o que fica de fora do cálculo e, ao confirmar, grava os valores recebidos.
 */
export function EnvioDocumentos({ processoId, rubricas, bloqueado, aoLerDados }: Props) {
  const router = useRouter();
  const [previa, enviar, lendo] = useActionState<Previa | undefined, FormData>(analisarDocumentos.bind(null, processoId), undefined);
  const [escolhas, setEscolhas] = useState<Record<string, number>>({});
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [gravando, iniciar] = useTransition();
  const [dadosUsados, setDadosUsados] = useState(false);
  const temPrevia = !!previa?.documentos?.length;
  const ativas = rubricas.filter((r) => r.codigo);
  const naoUsadasPorCodigo = Object.values(
    (previa?.naoUsadas ?? []).reduce<Record<string, { codigo: string; descricao: string; natureza: string; anos: number[]; total: number }>>((acc, l) => {
      const a = (acc[l.codigo] ??= { codigo: l.codigo, descricao: l.descricao, natureza: l.natureza, anos: [], total: 0 });
      if (!a.anos.includes(l.ano)) a.anos.push(l.ano);
      a.total += l.total;
      return acc;
    }, {}),
  );

  const gravar = () => iniciar(async () => {
    const r = await gravarRecebidos(processoId, previa!.documentos!, escolhas);
    if ("erro" in r && r.erro) return setMsg({ tipo: "erro", texto: r.erro });
    if ("gravados" in r) setMsg({ tipo: "ok", texto: `${r.gravados} valores gravados em ${r.cobertura.join(", ")}. Confira na aba Contracheque - F Financeira.` });
    router.refresh();
  });

  return (
    <section className="cartao space-y-4">
      <div>
        <h2 className="font-semibold">Contracheque e fichas financeiras (PDF)</h2>
        <p className="text-sm text-suave">
          Envie um ou mais contracheques e/ou fichas financeiras. O site lê os dados e os valores e descarta os arquivos: nenhum PDF fica guardado.
          Ao gravar, os recebidos são substituídos no ano de cada ficha e no mês de cada contracheque.
        </p>
      </div>

      {!bloqueado && (
        <form action={enviar} className="flex flex-wrap items-center gap-3">
          <label htmlFor={`documentos-${processoId}`} className="sr-only">Arquivos PDF</label>
          <input id={`documentos-${processoId}`} name="documentos" type="file" accept="application/pdf,.pdf" multiple required
            className="text-sm file:mr-3 file:border file:border-borda file:bg-white file:px-3 file:py-1.5 file:text-sm" />
          <button className="botao-sec" disabled={lendo}>{lendo ? "Lendo…" : "Ler documentos"}</button>
        </form>
      )}

      {previa?.erro && <Aviso tipo="erro">{previa.erro}</Aviso>}
      {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}

      {temPrevia && (
        <div className="space-y-4">
          <ul className="space-y-1 text-sm">
            {previa!.resumo!.map((f, i) => (
              <li key={`${f.arquivo}-${i}`} className="flex flex-wrap items-center gap-2">
                <span className={`px-2 py-0.5 text-[11px] font-bold uppercase tracking-[.05em] ${f.conferenciaOk ? "bg-green-100 text-green-900" : "bg-red-100 text-red-900"}`}>
                  {f.conferenciaOk ? "conferido" : "não conferiu"}
                </span>
                <span className="font-medium">{f.tipo === "contracheque" ? "Contracheque" : "Ficha financeira"} {f.referencia}</span>
                <span className="text-suave">{f.arquivo} · {f.linhas} linhas</span>
                {f.avisos.length > 0 && <span className="text-xs text-amber-800">{f.avisos.join("; ")}</span>}
              </li>
            ))}
          </ul>
          {previa!.resumo!.some((f) => !f.conferenciaOk) && (
            <Aviso tipo="atencao">Algum documento não fechou nas conferências (soma das linhas × totais). Confira esses valores com atenção.</Aviso>
          )}
          {!!previa!.divergenciasMilitar?.length && (
            <Aviso tipo="atencao">
              Os documentos não conferem com o cadastro do favorecido em: {previa!.divergenciasMilitar!.join(", ")}. Verifique se são do militar certo.
            </Aviso>
          )}

          {aoLerDados && previa!.dados && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Dados do favorecido encontrados</h3>
              <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                {ROTULOS.filter(([k]) => previa!.dados![k]).map(([k, rotulo]) => (
                  <div key={k} className="flex gap-2"><dt className="text-suave">{rotulo}:</dt><dd className="font-medium">{k === "cpf" ? formatarCpf(previa!.dados![k]) : previa!.dados![k]}</dd></div>
                ))}
              </dl>
              {!bloqueado && (
                <button type="button" className="botao-sec" onClick={() => { aoLerDados(previa!.dados!); setDadosUsados(true); }}>
                  {dadosUsados ? "Dados copiados para o formulário" : "Copiar para o formulário abaixo"}
                </button>
              )}
              {dadosUsados && <p className="ajuda">Confira o formulário e clique em “Salvar e continuar” para gravar.</p>}
            </div>
          )}

          <p className="text-sm">
            <strong>{previa!.lancamentos?.length ?? 0}</strong> valores mensais vão para as rubricas do processo
            {previa!.cobertura?.length ? `, substituindo os recebidos de ${previa!.cobertura.join(", ")}` : ""}.
          </p>

          {naoUsadasPorCodigo.length > 0 && (
            <details>
              <summary className="cursor-pointer text-sm font-semibold">Códigos que não entram no cálculo ({naoUsadasPorCodigo.length})</summary>
              <p className="ajuda my-2">Imposto, empréstimos, pensão alimentícia, acertos etc. ficam de fora. Se algum deve entrar, escolha a rubrica.</p>
              <div className="divide-y divide-borda border border-borda">
                {naoUsadasPorCodigo.map((l) => (
                  <div key={l.codigo} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span>
                      <span className="font-mono text-xs text-suave">{l.codigo}</span> {l.descricao}
                      <span className="ml-2 text-xs text-suave">{l.natureza} · {l.anos.join(", ")} · R$ {formatarReais(l.total)}</span>
                    </span>
                    <label className="sr-only" htmlFor={`esc-${processoId}-${l.codigo}`}>Rubrica para {l.codigo}</label>
                    <select id={`esc-${processoId}-${l.codigo}`} className="entrada w-auto py-1" disabled={bloqueado}
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
            </details>
          )}

          {!bloqueado && (
            <div className="flex justify-end">
              <button className="botao" disabled={gravando} onClick={gravar}>{gravando ? "Gravando…" : "Gravar valores recebidos"}</button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
