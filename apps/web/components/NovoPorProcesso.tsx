"use client";
import { unzipSync } from "fflate";
import { useState, useTransition } from "react";
import { Aviso } from "@/components/Aviso";
import { EscolhaOm } from "@/components/FormularioProcesso";
import { criarProcessoDeDocumentos } from "@/lib/acoes/fichas";
import { lerPecaDoProcesso } from "@/lib/acoes/processo-completo";
import type { Peca } from "@/lib/processo-completo";

/** Peças maiores não são enviadas (a Vercel recusa envios acima de ~4,5 MB): ficam listadas como "grandes". */
const LIMITE_ENVIO = 3.8 * 1024 * 1024;
const IGNORAR = /TERMO DE (DES)?ARQUIVAMENTO/i;
const ordem = (nome: string) => Number(/^(\d+)\./.exec(nome)?.[1] ?? 9999);
const nomeBase = (caminho: string) => caminho.split("/").pop() ?? caminho;

/** Peças do ZIP do SPED (ou os PDFs soltos), na ordem do processo. */
async function pecasDosArquivos(arquivos: File[]) {
  const pecas: { nome: string; dados: Uint8Array }[] = [];
  for (const a of arquivos) {
    const dados = new Uint8Array(await a.arrayBuffer());
    if (a.name.toLowerCase().endsWith(".zip")) {
      const conteudo = unzipSync(dados);
      for (const [caminho, bytes] of Object.entries(conteudo)) if (!caminho.endsWith("/") && bytes.length) pecas.push({ nome: nomeBase(caminho), dados: bytes });
    } else pecas.push({ nome: a.name, dados });
  }
  return pecas.sort((x, y) => ordem(x.nome) - ordem(y.nome) || x.nome.localeCompare(y.nome, "pt-BR"));
}

/**
 * Novo cálculo de Auxílio-fardamento pelo processo completo (decisão de 25/11/2026): o ZIP baixado do SPED, sem os
 * cálculos e o protocolo do CPEx. Cada peça é lida no servidor e descartada; nada fica guardado.
 */
export function NovoPorProcesso({ oms = [], especie }: { oms?: { id: string; nome: string }[]; especie: string }) {
  const [erro, setErro] = useState<string | null>(null);
  const [progresso, setProgresso] = useState<string | null>(null);
  const [criando, iniciar] = useTransition();
  const ocupado = !!progresso || criando;

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const form = e.currentTarget;
    const arquivos = [...((form.elements.namedItem("processo-arquivos") as HTMLInputElement).files ?? [])];
    // contracheque (e fichas do SIPPES/SIAPPES), enviados junto com o processo
    const avulsos = [...((form.elements.namedItem("processo-avulsos") as HTMLInputElement).files ?? [])];
    const omId = (form.elements.namedItem("om_id") as HTMLSelectElement | null)?.value ?? "";
    if (!arquivos.length) return setErro("Selecione o ZIP do processo (ou as peças em PDF).");
    try {
      setProgresso("Abrindo o processo…");
      const pecas = await pecasDosArquivos(arquivos);
      if (!pecas.length) throw new Error("O arquivo não tem peças.");
      for (const a of avulsos) pecas.push({ nome: a.name, dados: new Uint8Array(await a.arrayBuffer()) });
      const lidas: Peca[] = [];
      const documentos: File[] = [];
      for (const [i, p] of pecas.entries()) {
        setProgresso(`Lendo a peça ${i + 1} de ${pecas.length}: ${p.nome}`);
        if (IGNORAR.test(p.nome)) { lidas.push({ nome: p.nome, tipo: "ignorada" }); continue; }
        if (p.dados.length > LIMITE_ENVIO) { lidas.push({ nome: p.nome, tipo: "grande" }); continue; }
        const nomePdf = /\.pdf$/i.test(p.nome) ? p.nome : `${p.nome}.pdf`;
        const arquivo = new File([new Uint8Array(p.dados)], nomePdf, { type: "application/pdf" });
        const fd = new FormData();
        fd.append("peca", arquivo);
        const r = await lerPecaDoProcesso(fd);
        lidas.push({ nome: p.nome, tipo: r.tipo, texto: r.texto });
        if (r.tipo === "ficha" || r.tipo === "contracheque") documentos.push(arquivo);
      }
      setProgresso(null);
      const fd = new FormData();
      fd.append("especie", especie);
      if (omId) fd.append("om_id", omId);
      for (const d of documentos) fd.append("documentos", d);
      fd.append("processo", JSON.stringify(lidas));
      iniciar(async () => {
        const r = await criarProcessoDeDocumentos(undefined, fd);
        if (r?.erro) setErro(r.erro);
      });
    } catch (x) {
      setProgresso(null);
      setErro((x as Error).message || "Não foi possível ler o processo.");
    }
  }

  return (
    <section className="cartao space-y-3 border-marca-600">
      <h2 className="font-semibold">Envie o processo completo</h2>
      <p className="text-sm text-suave">
        Selecione o ZIP do processo baixado do SPED (ou as peças em PDF), sem os cálculos e o protocolo do CPEx. O sistema lê as fichas financeiras e, das demais
        peças, o NUP, a data do requerimento, o BI de averbação, a data e o posto da promoção, a declaração e o reconhecimento da dívida. Peças digitalizadas
        (só imagem) não são lidas. O contracheque não é obrigatório no Auxílio-fardamento: se tiver, selecione-o no campo “Contracheque” (dá os dados
        bancários); sem ele, preencha banco, agência e conta em Informações. Se as fichas do processo forem digitalizadas, acrescente no mesmo campo as fichas baixadas do SIPPES ou do SIAPPES.
        Os arquivos são lidos e descartados.
      </p>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {progresso && <p className="text-sm" role="status">{progresso}</p>}
      <form onSubmit={enviar} className="flex flex-wrap items-end gap-3">
        {oms.length > 0 && <div className="w-full sm:w-72"><EscolhaOm oms={oms} id="om_id-processo" /></div>}
        <div>
          <label htmlFor="processo-arquivos" className="rotulo">Processo (ZIP do SPED ou peças em PDF)<span className="text-red-700"> *</span></label>
          <input id="processo-arquivos" name="processo-arquivos" type="file" accept=".zip,application/zip,application/pdf,.pdf" multiple required disabled={ocupado}
            className="text-sm file:mr-3 file:border file:border-borda file:bg-white file:px-3 file:py-1.5 file:text-sm" />
        </div>
        <div>
          <label htmlFor="processo-avulsos" className="rotulo">Contracheque (opcional) e fichas do SIPPES/SIAPPES</label>
          <input id="processo-avulsos" name="processo-avulsos" type="file" accept="application/pdf,.pdf" multiple disabled={ocupado}
            className="text-sm file:mr-3 file:border file:border-borda file:bg-white file:px-3 file:py-1.5 file:text-sm" />
        </div>
        <button className="botao" disabled={ocupado}>{criando ? "Criando…" : progresso ? "Lendo…" : "Ler o processo e iniciar"}</button>
      </form>
    </section>
  );
}
