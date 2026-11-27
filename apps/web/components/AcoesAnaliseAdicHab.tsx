"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Aviso } from "@/components/Aviso";
import { IGNORAR, LIMITE_ENVIO, pecasDosArquivos } from "@/components/NovoPorProcesso";
import { complementarAnaliseAdicHab, prosseguirAnaliseAdicHab } from "@/lib/acoes/analise-adic-hab";
import { lerPecaDoProcesso } from "@/lib/acoes/processo-completo";
import type { Peca } from "@/lib/processo-completo";

const br = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

/** Extensão do período: marca/desmarca e refaz a análise com o período escolhido. */
export function EscolhaPeriodoAnalise({ fimPedido, fimPossivel, estender, pendente }: { fimPedido: string; fimPossivel: string; estender: boolean; pendente: boolean }) {
  const router = useRouter();
  const [mudando, iniciar] = useTransition();
  return (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" className="mt-1" checked={estender} disabled={!pendente || mudando}
        onChange={(e) => iniciar(() => router.replace(e.target.checked ? "?" : "?periodo=pedido", { scroll: false }))} />
      <span>
        Estender o período até <strong>{br(fimPossivel)}</strong> (as fichas mostram o percentual antigo até lá; o pedido vai até {br(fimPedido)}).
        {mudando && " Refazendo a análise…"}
      </span>
    </label>
  );
}

/** Botões da análise: carregar documentos, refazer a análise e prosseguir para as Informações. */
export function AcoesAnaliseAdicHab({ processoId, pendente, estender, faltam }: { processoId: string; pendente: boolean; estender: boolean; faltam: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro" | "info"; texto: string } | null>(null);
  const [progresso, setProgresso] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  const parado = ocupado || !!progresso;

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const input = e.currentTarget.elements.namedItem("analise-arquivos") as HTMLInputElement;
    const arquivos = [...(input.files ?? [])];
    if (!arquivos.length) return setMsg({ tipo: "erro", texto: "Selecione os arquivos (PDF ou o ZIP do SPED)." });
    try {
      setProgresso("Abrindo os arquivos…");
      const pecas = await pecasDosArquivos(arquivos);
      const lidas: Peca[] = [];
      const fd = new FormData();
      for (const [i, p] of pecas.entries()) {
        setProgresso(`Lendo ${i + 1} de ${pecas.length}: ${p.nome}`);
        if (IGNORAR.test(p.nome)) { lidas.push({ nome: p.nome, tipo: "ignorada" }); continue; }
        if (p.dados.length > LIMITE_ENVIO) { lidas.push({ nome: p.nome, tipo: "grande" }); continue; }
        const arquivo = new File([new Uint8Array(p.dados)], /\.pdf$/i.test(p.nome) ? p.nome : `${p.nome}.pdf`, { type: "application/pdf" });
        const uma = new FormData();
        uma.append("peca", arquivo);
        const r = await lerPecaDoProcesso(uma);
        lidas.push({ nome: p.nome, tipo: r.tipo, texto: r.texto });
        if (r.tipo === "ficha" || r.tipo === "contracheque") fd.append("documentos", arquivo);
      }
      setProgresso(null);
      fd.append("processo", JSON.stringify(lidas));
      iniciar(async () => {
        const r = await complementarAnaliseAdicHab(processoId, fd);
        if (r.erro) return setMsg({ tipo: "erro", texto: r.erro });
        input.value = "";
        setMsg({ tipo: "ok", texto: `${r.resumo} A análise foi refeita.` });
        router.refresh();
      });
    } catch (x) {
      setProgresso(null);
      setMsg({ tipo: "erro", texto: (x as Error).message || "Não foi possível ler os arquivos." });
    }
  }

  if (!pendente) {
    return (
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className="botao" onClick={() => router.push(`/processos/${processoId}/dados`)}>Ir para Informações</button>
      </div>
    );
  }
  return (
    <section className="cartao space-y-3 border-marca-600" aria-labelledby="analise-acoes">
      <h2 id="analise-acoes" className="font-semibold">Documentos e próximo passo</h2>
      {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
      {progresso && <p className="text-sm" role="status">{progresso}</p>}
      <form onSubmit={enviar} className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="analise-arquivos" className="rotulo">Carregar documentos (fichas, contracheque, requerimento, BI ou o ZIP do SPED)</label>
          <input id="analise-arquivos" name="analise-arquivos" type="file" multiple accept=".zip,application/zip,application/pdf,.pdf" disabled={parado}
            className="text-sm file:mr-3 file:border file:border-borda file:bg-white file:px-3 file:py-1.5 file:text-sm" />
        </div>
        <button className="botao-sec" disabled={parado}>{progresso ? "Lendo…" : ocupado ? "Enviando…" : "Carregar arquivos"}</button>
        <button type="button" className="botao-sec" disabled={parado}
          onClick={() => { setMsg({ tipo: "info", texto: "Análise refeita com os dados atuais do processo." }); router.refresh(); }}>Reanalisar</button>
      </form>
      <p className="ajuda">
        As fichas enviadas substituem as do mesmo ano; das demais peças, o sistema só completa o que ainda falta (nada já preenchido é trocado).
        Ao prosseguir, o período, o quadro do adicional, os lançamentos e os textos do verso são gravados como mostrados acima, e você pode alterar tudo nas telas seguintes.
      </p>
      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-borda pt-3">
        {faltam && <span className="text-sm text-suave">Ainda faltam documentos: você pode prosseguir e completar depois nas telas.</span>}
        <button type="button" className="botao" disabled={parado}
          onClick={() => iniciar(async () => {
            const r = await prosseguirAnaliseAdicHab(processoId, estender);
            if (r?.erro) setMsg({ tipo: "erro", texto: r.erro });
          })}>{ocupado ? "Gravando…" : "Prosseguir"}</button>
      </div>
    </section>
  );
}
