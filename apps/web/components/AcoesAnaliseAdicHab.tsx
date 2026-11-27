"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Aviso } from "@/components/Aviso";
import { IGNORAR, LIMITE_ENVIO, pecasDosArquivos } from "@/components/NovoPorProcesso";
import { complementarAnaliseAdicHab, prosseguirAnaliseAdicHab } from "@/lib/acoes/analise-adic-hab";
import { lerPecaDoProcesso } from "@/lib/acoes/processo-completo";
import { criarLeitorNavegador } from "@/lib/ocr-navegador";
import type { Peca } from "@/lib/processo-completo";
import type { Palavra } from "@painel-ea/leitor-ficha";

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
    const leitor = criarLeitorNavegador((texto) => setProgresso(texto));
    try {
      setProgresso("Abrindo os arquivos…");
      const pecas = await pecasDosArquivos(arquivos);
      const lidas: Peca[] = [];
      // escaneadas (OCR) e grandes demais para enviar: lidas aqui no navegador; o servidor interpreta as palavras
      const noNavegador: { nome: string; ocr: boolean; palavras: Palavra[] }[] = [];
      const avisos: string[] = [];
      const fd = new FormData();
      for (const [i, p] of pecas.entries()) {
        setProgresso(`Lendo ${i + 1} de ${pecas.length}: ${p.nome}`);
        if (IGNORAR.test(p.nome)) { lidas.push({ nome: p.nome, tipo: "ignorada" }); continue; }
        const ehPdf = String.fromCharCode(...p.dados.slice(0, 5)) === "%PDF-";
        let tipo: Peca["tipo"] = "grande";
        if (p.dados.length <= LIMITE_ENVIO) {
          const arquivo = new File([new Uint8Array(p.dados)], /\.pdf$/i.test(p.nome) ? p.nome : `${p.nome}.pdf`, { type: "application/pdf" });
          const uma = new FormData();
          uma.append("peca", arquivo);
          const r = await lerPecaDoProcesso(uma);
          tipo = r.tipo;
          if (tipo !== "imagem") {
            lidas.push({ nome: p.nome, tipo, texto: r.texto });
            if (tipo === "ficha" || tipo === "contracheque") fd.append("documentos", arquivo);
            continue;
          }
        }
        if (!ehPdf) { lidas.push({ nome: p.nome, tipo: "ignorada" }); continue; }
        try {
          const r = await leitor.ler(p.nome, p.dados);
          noNavegador.push({ nome: p.nome, ocr: r.ocr, palavras: r.palavras });
          if (r.ocr && r.paginasLidas < r.paginas) avisos.push(`${p.nome}: OCR só das ${r.paginasLidas} primeiras de ${r.paginas} páginas.`);
          if (r.ocr && !r.palavras.length) avisos.push(`${p.nome}: nenhum texto reconhecido (digitalização ilegível).`);
        } catch {
          lidas.push({ nome: p.nome, tipo });
          avisos.push(`${p.nome}: não foi possível ler no navegador.`);
        }
      }
      await leitor.encerrar();
      setProgresso(null);
      fd.append("processo", JSON.stringify(lidas));
      fd.append("navegador", JSON.stringify(noNavegador));
      iniciar(async () => {
        const r = await complementarAnaliseAdicHab(processoId, fd);
        if (r.erro) return setMsg({ tipo: "erro", texto: r.erro });
        input.value = "";
        setMsg({ tipo: avisos.length ? "info" : "ok", texto: `${r.resumo} A análise foi refeita.${avisos.length ? ` Atenção: ${avisos.join(" ")}` : ""}` });
        router.refresh();
      });
    } catch (x) {
      await leitor.encerrar();
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
        PDF escaneado (só imagem) é lido por OCR aqui no navegador: leva de 10 a 40 segundos por página e, na primeira vez, baixa o leitor de português (~10 MB).
        Confira os valores lidos por OCR; se a digitalização estiver ilegível, digite os dados no quadro acima.
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
