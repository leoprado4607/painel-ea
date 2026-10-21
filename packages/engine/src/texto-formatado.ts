/**
 * Texto com negrito, itálico e sublinhado (quadros de Informações que vão para o verso da Solicitação de Pagamento).
 * Guardado como marcação mínima: só <b>, <i>, <u>, quebras de linha e as entidades &lt; &gt; &amp;.
 * Qualquer outra coisa (inclusive texto antigo com "<") é lida como texto comum, então a marcação é sempre segura.
 */

export interface TrechoFormatado { texto: string; negrito: boolean; italico: boolean; sublinhado: boolean }

const TOKEN = /<(\/?)([biu])>|&(lt|gt|amp);/g;
const ENTIDADE: Record<string, string> = { lt: "<", gt: ">", amp: "&" };
const ESTILO = { b: "negrito", i: "italico", u: "sublinhado" } as const;

/** Lê a marcação em trechos com estilo. Tags sem par são ignoradas. */
export function trechosFormatados(marcacao: string | null | undefined): TrechoFormatado[] {
  const s = marcacao ?? "";
  const nivel = { negrito: 0, italico: 0, sublinhado: 0 };
  const trechos: TrechoFormatado[] = [];
  const empurrar = (texto: string) => {
    if (!texto) return;
    const estilo = { negrito: nivel.negrito > 0, italico: nivel.italico > 0, sublinhado: nivel.sublinhado > 0 };
    const ultimo = trechos[trechos.length - 1];
    if (ultimo && ultimo.negrito === estilo.negrito && ultimo.italico === estilo.italico && ultimo.sublinhado === estilo.sublinhado) ultimo.texto += texto;
    else trechos.push({ texto, ...estilo });
  };
  let i = 0;
  for (const m of s.matchAll(TOKEN)) {
    empurrar(s.slice(i, m.index));
    i = m.index! + m[0].length;
    if (m[3]) { empurrar(ENTIDADE[m[3]]!); continue; }
    const k = ESTILO[m[2] as keyof typeof ESTILO];
    nivel[k] = Math.max(0, nivel[k] + (m[1] ? -1 : 1));
  }
  empurrar(s.slice(i));
  return trechos;
}

const escapar = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Grava os trechos como marcação (o inverso de trechosFormatados). */
export function marcacaoDosTrechos(trechos: TrechoFormatado[]): string {
  return trechos.filter((t) => t.texto).map((t) => {
    let x = escapar(t.texto);
    if (t.sublinhado) x = `<u>${x}</u>`;
    if (t.italico) x = `<i>${x}</i>`;
    if (t.negrito) x = `<b>${x}</b>`;
    return x;
  }).join("");
}

/** Marcação limpa: tira o que não for b/i/u, junta trechos iguais e apara espaços e quebras das pontas. */
export function normalizarFormatado(marcacao: string | null | undefined): string {
  const trechos = trechosFormatados((marcacao ?? "").replace(/\r\n?/g, "\n"));
  if (trechos.length) {
    trechos[0]!.texto = trechos[0]!.texto.replace(/^\s+/, "");
    const u = trechos[trechos.length - 1]!;
    u.texto = u.texto.replace(/\s+$/, "");
  }
  return marcacaoDosTrechos(trechos);
}

/** Só o texto, sem formatação (para contar caracteres). */
export const textoSemFormatacao = (marcacao: string | null | undefined) => trechosFormatados(marcacao).map((t) => t.texto).join("");
