"use client";
import { useEffect, useRef, useState } from "react";
import { EditorFormatado } from "@/components/EditorFormatado";
import { LIMITE_DOCUMENTO } from "@/lib/amparo";
import { LIMITE_EXPLICACAO, mesmosTextos, type TextosVerso } from "@/lib/textos-verso";

/**
 * "Textos sugeridos para o verso" dos cálculos automáticos: explicação do não pagamento e documentos que materializam
 * o direito, editáveis (negrito, itálico, sublinhado). Sem edição (editados null), acompanha a sugestão do cálculo;
 * "Restaurar sugeridos" desfaz a edição. Ao editar, a substituição do verso é marcada.
 */
export function QuadroTextosVerso({ sugeridos, editados, aoEditar, usar, aoUsar, bloqueado }: {
  sugeridos: TextosVerso; editados: TextosVerso | null; aoEditar: (t: TextosVerso | null) => void;
  usar: boolean; aoUsar: (sim: boolean) => void; bloqueado: boolean;
}) {
  const atual = editados ?? sugeridos;
  const docs = atual.documentos.length ? atual.documentos : [""];
  const editado = !!editados && !mesmosTextos(editados, sugeridos);
  // os editores guardam o próprio texto: nova versão (remonta) quando a sugestão muda sem edição, ao restaurar e ao tirar um documento
  const [versao, setVersao] = useState(0);
  const chaveSugestao = JSON.stringify(sugeridos);
  const sugestaoAnterior = useRef(chaveSugestao);
  useEffect(() => {
    if (sugestaoAnterior.current === chaveSugestao) return;
    sugestaoAnterior.current = chaveSugestao;
    if (!editados) setVersao((v) => v + 1);
  }, [chaveSugestao, editados]);
  // atualiza a partir do último estado (o editor avisa depois da renderização)
  const ultimo = useRef(atual);
  ultimo.current = atual;
  const mudar = (t: Partial<TextosVerso>) => { aoEditar({ ...ultimo.current, ...t }); aoUsar(true); };
  const mudarDoc = (i: number, m: string) => {
    const lista = ultimo.current.documentos.length ? [...ultimo.current.documentos] : [""];
    lista[i] = m;
    mudar({ documentos: lista });
  };
  const botao = "grid h-[38px] w-[38px] shrink-0 place-items-center border border-borda bg-white text-lg leading-none hover:border-ouro/50 hover:bg-creme disabled:opacity-50";

  return (
    <div className="space-y-3 border border-borda p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="rotulo-secao mb-0">Textos sugeridos para o verso{editado && <span className="ml-2 normal-case tracking-normal text-suave">(editados)</span>}</h3>
        {editado && !bloqueado && (
          <button type="button" className="botao-sec py-1 text-xs" onClick={() => { aoEditar(null); setVersao((v) => v + 1); }}>
            Restaurar sugeridos
          </button>
        )}
      </div>
      <EditorFormatado key={`explicacao-${versao}`} nome="verso.explicacao" idBase="verso-explicacao" rotulo="Explicação do não pagamento"
        valor={atual.explicacao} limite={LIMITE_EXPLICACAO} justificado arrumarColado bloqueado={bloqueado}
        aoMudar={(m) => mudar({ explicacao: m })} />
      <div className="space-y-2">
        <span className="rotulo">Documento que materializou o direito</span>
        {docs.map((texto, i) => (
          <EditorFormatado key={`doc-${versao}-${i}`} nome="verso.amparo" idBase={`verso-amparo-${i}`}
            rotulo={i ? `Nº/data do documento ${i + 1}` : "Nº/data do documento"} rotuloOculto ferramentasAEsquerda umaLinha
            valor={texto} limite={LIMITE_DOCUMENTO} bloqueado={bloqueado} aoMudar={(m) => mudarDoc(i, m)}
            aoLado={!bloqueado && (
              <>
                {i > 0 && <button type="button" className={botao} aria-label={`Remover o documento ${i + 1}`} title="Remover este documento"
                  onClick={() => { mudar({ documentos: docs.filter((_, j) => j !== i) }); setVersao((v) => v + 1); }}>−</button>}
                {i === docs.length - 1 && <button type="button" className={botao} aria-label="Adicionar outro documento que materializa o direito"
                  title="Adicionar outro documento" onClick={() => mudar({ documentos: [...docs, ""] })}>+</button>}
              </>
            )} />
        ))}
      </div>
      <label className="flex items-start gap-2">
        <input type="checkbox" className="mt-1" checked={usar} disabled={bloqueado} onChange={(e) => aoUsar(e.target.checked)} />
        <span>Ao salvar, substituir os textos do verso (Informações) por estes.</span>
      </label>
    </div>
  );
}
