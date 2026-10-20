"use client";
import { useActionState, useEffect, useState } from "react";
import { Aviso } from "@/components/Aviso";
import { salvarDocumento, type EstadoDocumento } from "@/lib/acoes/documentos";

export interface CampoDocumento {
  nome: string;
  rotulo: string;
  tipo?: "text" | "number" | "date" | "textarea" | "checkbox";
  valor?: string | number | boolean | null;
  placeholder?: string;
  ajuda?: string;
  /** ocupa a linha inteira (padrão para textarea) */
  largo?: boolean;
}

export interface GrupoCampos { titulo: string; campos: CampoDocumento[] }

function Campo({ c }: { c: CampoDocumento }) {
  const id = `campo-${c.nome}`;
  if (c.tipo === "checkbox") {
    return (
      <label className="col-span-2 flex items-center gap-2 text-sm">
        <input type="hidden" name={`${c.nome}_enviado`} value="1" />
        <input id={id} type="checkbox" name={c.nome} defaultChecked={!!c.valor} className="h-4 w-4 accent-marca-700" />
        {c.rotulo}
      </label>
    );
  }
  const comum = { id, name: c.nome, placeholder: c.placeholder, className: "entrada", "aria-describedby": c.ajuda ? `${id}-ajuda` : undefined };
  return (
    <div className={c.largo || c.tipo === "textarea" ? "col-span-2" : ""}>
      <label htmlFor={id} className="rotulo">{c.rotulo}</label>
      {c.tipo === "textarea"
        ? <textarea {...comum} rows={5} defaultValue={String(c.valor ?? "")} />
        : <input {...comum} type={c.tipo ?? "text"} min={c.tipo === "number" ? 0 : undefined} defaultValue={c.valor === null || c.valor === undefined ? "" : String(c.valor)} />}
      {c.ajuda && <p id={`${id}-ajuda`} className="ajuda">{c.ajuda}</p>}
    </div>
  );
}

/**
 * Aba de documento: campos editáveis (textos e campos de preenchimento) e, ao lado, a prévia em PDF daquele documento.
 * Os valores e totais vêm sempre do cálculo; para mudá-los, edite os lançamentos.
 */
export function AbaDocumento({ processoId, doc, ano, grupos = [], bloqueado, observacao }: {
  processoId: string; doc: string; ano?: number; grupos?: GrupoCampos[]; bloqueado: boolean; observacao?: React.ReactNode;
}) {
  const [estado, acao, salvando] = useActionState<EstadoDocumento | undefined, FormData>(salvarDocumento.bind(null, processoId), undefined);
  const [versao, setVersao] = useState(0);
  useEffect(() => { if (estado?.ok) setVersao((v) => v + 1); }, [estado]);
  const src = `/processos/${processoId}/previa?doc=${doc}${ano ? `&ano=${ano}` : ""}&v=${versao}`;
  // a prévia leva alguns segundos para ser gerada: mostra um aviso até o PDF chegar
  const [carregando, setCarregando] = useState(true);
  useEffect(() => setCarregando(true), [src]);
  const temCampos = grupos.some((g) => g.campos.length);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(19rem,24rem)_1fr]">
      <div className="space-y-4">
        {observacao}
        {temCampos && (
          <form action={acao} className="space-y-4">
            <fieldset disabled={bloqueado} className="space-y-4">
              {grupos.map((g) => (
                <section key={g.titulo} className="cartao space-y-3">
                  <h2 className="font-semibold">{g.titulo}</h2>
                  <div className="grid grid-cols-2 gap-3">{g.campos.map((c) => <Campo key={c.nome} c={c} />)}</div>
                </section>
              ))}
            </fieldset>
            {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
            {estado?.ok && !salvando && <Aviso tipo="ok">Gravado. A prévia ao lado já mostra a alteração.</Aviso>}
            {!bloqueado && <div className="flex justify-end"><button className="botao" disabled={salvando}>{salvando ? "Gravando…" : "Gravar e atualizar a prévia"}</button></div>}
          </form>
        )}
      </div>
      <section className="cartao flex min-h-[70vh] flex-col gap-2 p-2">
        <div className="flex items-center justify-between px-2 pt-1 text-sm">
          <span className="text-suave">Prévia (rascunho, não vale como documento)</span>
          <a href={src} target="_blank" rel="noopener" className="text-marca-700 underline">Abrir em nova aba</a>
        </div>
        <div className="relative flex flex-1">
          <iframe key={versao} src={src} title="Prévia do documento em PDF" onLoad={() => setCarregando(false)}
            className="w-full flex-1 border border-borda bg-fundo" />
          {carregando && (
            <div role="status" className="absolute inset-0 grid place-items-center border border-borda bg-creme/90">
              <div className="space-y-2 text-center">
                <p className="font-titulo text-xl font-semibold text-carvao motion-safe:animate-pulse">Gerando a prévia…</p>
                <p className="text-xs text-suave">O PDF é montado com os valores atuais e leva alguns segundos.</p>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
