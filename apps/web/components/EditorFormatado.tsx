"use client";
import { formatarTextoColado, marcacaoDosTrechos, normalizarFormatado, textoSemFormatacao, type TrechoFormatado } from "@painel-ea/engine";
import { useEffect, useRef, useState, type ReactNode } from "react";

/** DOM do editor → trechos com estilo (b/strong, i/em, u; quebras de linha por <br> e blocos). */
function trechosDoDom(raiz: HTMLElement): TrechoFormatado[] {
  const trechos: TrechoFormatado[] = [];
  const andar = (n: Node, estilo: Omit<TrechoFormatado, "texto">) => {
    if (n.nodeType === Node.TEXT_NODE) { trechos.push({ texto: n.textContent ?? "", ...estilo }); return; }
    if (!(n instanceof HTMLElement)) return;
    const tag = n.tagName;
    if (tag === "BR") { trechos.push({ texto: "\n", ...estilo }); return; }
    const bloco = tag === "DIV" || tag === "P";
    if (bloco && trechos.length && !trechos[trechos.length - 1]!.texto.endsWith("\n")) trechos.push({ texto: "\n", ...estilo });
    const novo = {
      negrito: estilo.negrito || tag === "B" || tag === "STRONG" || /bold|[6-9]00/.test(n.style.fontWeight),
      italico: estilo.italico || tag === "I" || tag === "EM" || n.style.fontStyle === "italic",
      sublinhado: estilo.sublinhado || tag === "U" || n.style.textDecoration.includes("underline"),
    };
    n.childNodes.forEach((f) => andar(f, novo));
  };
  raiz.childNodes.forEach((f) => andar(f, { negrito: false, italico: false, sublinhado: false }));
  return trechos;
}

const paraHtml = (marcacao: string) => marcacao.replace(/\n/g, "<br>");

/**
 * Caixa de texto com negrito, itálico e sublinhado, na Helvetica dos documentos. O valor vai num campo oculto
 * (nome do formulário) como marcação <b>/<i>/<u>; o limite conta só os caracteres do texto.
 */
export function EditorFormatado({ nome, idBase = nome, rotulo, rotuloOculto, ferramentasAEsquerda, valor, limite, obrigatorio, erro, placeholder, bloqueado, arrumarColado, justificado, umaLinha, aoLado }: {
  nome: string;
  /** prefixo dos ids (rótulo, contador) quando há vários editores com o mesmo nome */
  idBase?: string;
  rotulo: string;
  /** rótulo só para leitores de tela (o título do quadro já diz o que é) */
  rotuloOculto?: boolean;
  /** com o rótulo oculto: ferramentas no lugar dele, à esquerda (padrão: à direita) */
  ferramentasAEsquerda?: boolean; valor?: string | null; limite: number; obrigatorio?: boolean; erro?: string;
  placeholder?: string; bloqueado?: boolean;
  /** botão "Formatar texto colado": junta linhas cortadas, arruma espaços e parágrafos (formatarTextoColado) */
  arrumarColado?: boolean;
  /** texto justificado, como sai no PDF */
  justificado?: boolean;
  /** caixa de uma linha só: sem Enter, quebras coladas viram espaço */
  umaLinha?: boolean;
  /** botões à direita da caixa (ex.: "+" e "−" dos documentos que materializam o direito) */
  aoLado?: ReactNode;
}) {
  const editor = useRef<HTMLDivElement>(null);
  const valido = useRef("");
  const [marcacao, setMarcacao] = useState(() => normalizarFormatado(valor));
  const total = textoSemFormatacao(marcacao).length;

  useEffect(() => {
    if (!editor.current) return;
    editor.current.innerHTML = paraHtml(marcacao); // a marcação normalizada só tem b/i/u e texto escapado
    valido.current = editor.current.innerHTML;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const atualizar = () => {
    const el = editor.current!;
    let m = marcacaoDosTrechos(trechosDoDom(el));
    // uma linha só: quebra (bloco criado pelo navegador) vira espaço
    if (umaLinha && m.includes("\n")) { m = m.replace(/\n/g, " "); el.innerHTML = paraHtml(normalizarFormatado(m)); }
    // passou do limite: volta ao último conteúdo válido
    if (textoSemFormatacao(m).length > limite) { el.innerHTML = valido.current; return; }
    valido.current = el.innerHTML;
    setMarcacao(normalizarFormatado(m));
  };
  const arrumar = () => {
    const el = editor.current!;
    const m = formatarTextoColado(marcacaoDosTrechos(trechosDoDom(el)));
    el.innerHTML = paraHtml(m); // só b/i/u e texto escapado
    valido.current = el.innerHTML;
    setMarcacao(m);
  };
  const formatar = (cmd: "bold" | "italic" | "underline") => {
    editor.current?.focus();
    document.execCommand("styleWithCSS", false, "false");
    document.execCommand(cmd);
    atualizar();
  };
  const botao = "h-7 w-8 border border-borda bg-white text-sm hover:bg-gray-50 disabled:opacity-50";

  return (
    <div>
      <div className={`mb-1 flex items-end gap-2 ${!rotuloOculto ? "justify-between" : ferramentasAEsquerda ? "justify-start" : "justify-end"}`}>
        <span id={`${idBase}-rotulo`} className={rotuloOculto ? "sr-only" : "rotulo mb-0"}>{rotulo}{obrigatorio && <span className="text-red-700"> *</span>}</span>
        <div role="toolbar" aria-label={`Formatação de ${rotulo}`} className="flex gap-1">
          {/* onMouseDown: não tira o foco (nem a seleção) do texto */}
          <button type="button" className={`${botao} font-bold`} title="Negrito (Ctrl+B)" aria-label="Negrito" disabled={bloqueado}
            onMouseDown={(e) => { e.preventDefault(); formatar("bold"); }}>N</button>
          <button type="button" className={`${botao} italic`} title="Itálico (Ctrl+I)" aria-label="Itálico" disabled={bloqueado}
            onMouseDown={(e) => { e.preventDefault(); formatar("italic"); }}>I</button>
          <button type="button" className={`${botao} underline`} title="Sublinhado (Ctrl+U)" aria-label="Sublinhado" disabled={bloqueado}
            onMouseDown={(e) => { e.preventDefault(); formatar("underline"); }}>S</button>
          {arrumarColado && (
            <button type="button" className="h-7 border border-borda bg-white px-2 text-xs hover:bg-gray-50 disabled:opacity-50" disabled={bloqueado || !total}
              title="Junta as linhas cortadas na cópia, tira espaços repetidos e arruma os parágrafos (mantém negrito, itálico e sublinhado)"
              onClick={arrumar}>Formatar texto colado</button>
          )}
        </div>
      </div>
      <div className="flex items-start gap-2">
      <div className="relative min-w-0 flex-1">
        <div ref={editor} contentEditable={!bloqueado} suppressContentEditableWarning role="textbox" aria-multiline={!umaLinha}
          aria-labelledby={`${idBase}-rotulo`} aria-invalid={!!erro} aria-describedby={`${idBase}-contador`} data-placeholder={placeholder}
          className={`entrada ${umaLinha ? "overflow-x-auto whitespace-nowrap [scrollbar-width:none]" : "min-h-24 whitespace-pre-wrap"} leading-snug ${justificado ? "text-justify" : ""} [font-family:Helvetica,Arial,sans-serif] empty:before:text-suave empty:before:content-[attr(data-placeholder)] ${erro ? "entrada-erro" : ""}`}
          onInput={atualizar}
          onKeyDown={umaLinha ? (e) => { if (e.key === "Enter") e.preventDefault(); } : undefined}
          // colar só o texto, sem a formatação de outro programa, e só o que couber no limite (descontado o que está selecionado)
          onPaste={(e) => {
            e.preventDefault();
            const selecionado = getSelection()?.toString().length ?? 0;
            const cabe = Math.max(0, limite - textoSemFormatacao(marcacaoDosTrechos(trechosDoDom(editor.current!))).length + selecionado);
            const colado = e.clipboardData.getData("text/plain");
            document.execCommand("insertText", false, (umaLinha ? colado.replace(/\s*\r?\n\s*/g, " ") : colado).slice(0, cabe));
          }} />
        {/* o navegador exige o preenchimento por este campo; o valor gravado é a marcação */}
        {/* textarea (não input): o input apaga as quebras de linha do valor */}
        <textarea name={nome} value={total ? marcacao : ""} required={obrigatorio} onChange={() => {}} tabIndex={-1} aria-hidden
          className="pointer-events-none absolute bottom-0 left-4 h-px w-px resize-none overflow-hidden opacity-0"
          onFocus={() => editor.current?.focus()} />
      </div>
      {aoLado}
      </div>
      <div className="mt-1 flex justify-between gap-2">
        {erro ? <p className="erro">{erro}</p> : <span />}
        <p id={`${idBase}-contador`} className={`ajuda tabular-nums ${total >= limite ? "text-red-700" : ""}`}>{total}/{limite} caracteres</p>
      </div>
    </div>
  );
}
