"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Aviso } from "@/components/Aviso";
import { analisarDocumentos, gravarRecebidos, reanalisarDocumentos, type Previa } from "@/lib/acoes/fichas";
import { formatarReais } from "@/lib/dinheiro";
import type { DadosLidos } from "@/lib/favorecido";
import { formatarCpf } from "@/lib/login";

interface Props {
  processoId: string;
  rubricas: { posicao: number; codigo: string }[];
  bloqueado: boolean;
  /** Na aba "Informações": recebe os dados lidos para preencher o formulário. */
  aoLerDados?: (dados: DadosLidos) => void;
  /** dados dos PDFs já carregados neste processo: sem o texto de instruções */
  jaCarregados?: boolean;
}

const ROTULOS: [keyof DadosLidos, string][] = [
  ["posto_graduacao", "P/G de pagamento"], ["nome", "Nome"], ["prec_cp", "Prec-CP"], ["cpf", "CPF"], ["identidade", "Identidade"],
  ["om_vinculacao", "OM de vinculação"], ["banco", "Banco"], ["agencia", "Agência"], ["conta", "Conta corrente"],
];

/**
 * Envio de contracheques e fichas financeiras em PDF (um ou vários, misturados). O arquivo é lido e descartado:
 * mostra o que foi encontrado, o que fica de fora do cálculo e, ao confirmar, grava os valores recebidos.
 */
const tamanho = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

export function EnvioDocumentos({ processoId, rubricas, bloqueado, aoLerDados, jaCarregados }: Props) {
  const router = useRouter();
  // arquivos escolhidos (ainda não lidos): o usuário pode remover os que escolheu por engano antes de ler
  const [selecionados, setSelecionados] = useState<File[]>([]);
  const [previa, setPrevia] = useState<Previa | undefined>();
  const [lendo, iniciarLeitura] = useTransition();
  const escolher = (lista: FileList | null) => {
    const novos = [...(lista ?? [])].filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    setSelecionados((atuais) => [...atuais, ...novos.filter((n) => !atuais.some((a) => a.name === n.name && a.size === n.size))]);
  };
  const ler = () => iniciarLeitura(async () => {
    const form = new FormData();
    selecionados.forEach((f) => form.append("documentos", f));
    const r = await analisarDocumentos(processoId, undefined, form);
    setPrevia(r);
    setDadosUsados(false);
    if (!r.erro) setSelecionados([]);
  });
  // remover um documento já lido: recalcula a prévia com os que sobraram (os PDFs já foram descartados)
  const removerLido = (indice: number) => iniciarLeitura(async () => {
    const restantes = (previa?.documentos ?? []).filter((_, i) => i !== indice);
    setPrevia(restantes.length ? await reanalisarDocumentos(processoId, restantes) : undefined);
    setDadosUsados(false);
  });
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [gravando, iniciar] = useTransition();
  const [dadosUsados, setDadosUsados] = useState(false);
  const temPrevia = !!previa?.documentos?.length;
  const naoUsadasPorCodigo = Object.values(
    (previa?.naoUsadas ?? []).reduce<Record<string, { codigo: string; descricao: string; natureza: string; anos: number[]; total: number }>>((acc, l) => {
      const a = (acc[l.codigo] ??= { codigo: l.codigo, descricao: l.descricao, natureza: l.natureza, anos: [], total: 0 });
      if (!a.anos.includes(l.ano)) a.anos.push(l.ano);
      a.total += l.total;
      return acc;
    }, {}),
  );

  const gravar = () => iniciar(async () => {
    const r = await gravarRecebidos(processoId, previa!.documentos!);
    if ("erro" in r && r.erro) return setMsg({ tipo: "erro", texto: r.erro });
    if ("gravados" in r) setMsg({ tipo: "ok", texto: `Fichas de ${r.cobertura.join(", ") || "—"} guardadas; ${r.gravados} valores de receita preenchidos. Confira na aba Contracheque - F Financeira.` });
    router.refresh();
  });

  return (
    <section className="cartao space-y-4">
      <div>
        <h2 className="font-semibold">Contracheque e fichas financeiras (PDF)</h2>
        {/* instruções só até os dados dos PDFs serem copiados ou carregados */}
        {!(jaCarregados || dadosUsados || msg?.tipo === "ok") && <p className="text-sm text-suave">
          Envie as fichas financeiras (SIPPES ou SIAPPES) e o contracheque (do CPEx ou a 2ª via do SIPPES). Das fichas, só as receitas das rubricas escolhidas em Códigos
          lançamento, nos meses do período da dívida, preenchem os valores recebidos; despesas são digitadas pelo operador. O contracheque serve só
          para os dados bancários. Os PDFs são descartados: ficam guardados só os números das fichas, e valores digitados nunca são substituídos.
        </p>}
      </div>

      {!bloqueado && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* o campo nativo fica escondido: a lista abaixo mostra o que foi escolhido */}
            <label className="botao-sec cursor-pointer focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ouro">
              Escolher arquivos
              <input type="file" accept="application/pdf,.pdf" multiple className="sr-only"
                onChange={(e) => { escolher(e.target.files); e.target.value = ""; }} />
            </label>
            <button type="button" className="botao" disabled={lendo || !selecionados.length} onClick={ler}>
              {lendo ? "Lendo…" : selecionados.length ? `Ler ${selecionados.length} documento(s)` : "Ler documentos"}
            </button>
          </div>
          {selecionados.length > 0 && (
            <ul aria-label="Arquivos escolhidos" className="divide-y divide-borda border border-borda">
              {selecionados.map((f, i) => (
                <li key={`${f.name}-${f.size}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0 truncate"><span className="font-medium">{f.name}</span> <span className="text-suave">· {tamanho(f.size)}</span></span>
                  <button type="button" className="shrink-0 px-2 py-1 text-red-800 hover:bg-red-50" aria-label={`Remover ${f.name}`}
                    onClick={() => setSelecionados((l) => l.filter((_, j) => j !== i))}>Remover</button>
                </li>
              ))}
            </ul>
          )}
        </div>
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
                <span className="font-medium">{f.tipo === "contracheque" ? "Contracheque" : `Ficha financeira ${f.sistema === "siappes" ? "SIAPPES" : "SIPPES"}`} {f.referencia}</span>
                <span className="text-suave">{f.arquivo} · {f.linhas} linhas</span>
                {f.avisos.length > 0 && <span className="text-xs text-amber-800">{f.avisos.join("; ")}</span>}
                {!bloqueado && (
                  <button type="button" disabled={lendo} className="ml-auto px-2 py-0.5 text-xs text-red-800 hover:bg-red-50" aria-label={`Remover ${f.arquivo} da leitura`}
                    onClick={() => removerLido(i)}>Remover</button>
                )}
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
              <h3 className="text-sm font-semibold">Dados lidos dos documentos</h3>
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
            <strong>{previa!.lancamentos?.length ?? 0}</strong> valores de receita vão para as rubricas do processo, no período da dívida
            {previa!.cobertura?.length ? ` (fichas de ${previa!.cobertura.join(", ")})` : ""}. Valores já digitados não são substituídos.
          </p>
          {previa!.pendencia && <Aviso tipo="info">{previa!.pendencia}</Aviso>}

          {naoUsadasPorCodigo.length > 0 && (
            <details>
              <summary className="cursor-pointer text-sm font-semibold">Códigos que não entram no cálculo ({naoUsadasPorCodigo.length})</summary>
              <p className="ajuda my-2">
                Despesas e receitas sem rubrica escolhida em Códigos lançamento não preenchem nada. Para usar uma receita, inclua o código dela
                em Códigos lançamento; as despesas são digitadas na aba Contracheque - F Financeira.
              </p>
              <div className="divide-y divide-borda border border-borda">
                {naoUsadasPorCodigo.map((l) => (
                  <div key={l.codigo} className="px-3 py-2 text-sm">
                    <span className="font-mono text-xs text-suave">{l.codigo}</span> {l.descricao}
                    <span className="ml-2 text-xs text-suave">{l.natureza} · {l.anos.join(", ")} · R$ {formatarReais(l.total)}</span>
                  </div>
                ))}
              </div>
            </details>
          )}

          {!bloqueado && (
            <div className="flex justify-end">
              <button className="botao" disabled={gravando} onClick={gravar}>{gravando ? "Gravando…" : "Guardar fichas e preencher receitas"}</button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
