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

type Letra = { c: string; estilo: Omit<TrechoFormatado, "texto"> };
const mesmoEstilo = (a: Letra["estilo"], b: Letra["estilo"]) => a.negrito === b.negrito && a.italico === b.italico && a.sublinhado === b.sublinhado;

/**
 * Arruma texto colado (de PDF, e-mail, Word), mantendo negrito/itálico/sublinhado:
 * - quebra de linha simples (linha cortada pela cópia) vira espaço; linha em branco separa parágrafos;
 * - palavra hifenizada no fim da linha é juntada ("paga-\nmento" → "pagamento"; "IPCA-\nE" → "IPCA-E");
 * - tabulações e espaços repetidos viram um espaço; sem espaço antes de , . ; : ! ? ) nem depois de (;
 * - parágrafos sem espaços nas pontas e sem linhas vazias sobrando.
 */
export function formatarTextoColado(marcacao: string | null | undefined): string {
  let l: Letra[] = trechosFormatados((marcacao ?? "").replace(/\r\n?/g, "\n"))
    .flatMap((t) => [...t.texto].map((c) => ({ c: /[\t \f\v]/.test(c) ? " " : c, estilo: t })));
  const ehLetra = (c?: string) => !!c && /\p{Ll}/u.test(c);

  // quebras de linha: grupos de espaço em branco com "\n"
  const r: Letra[] = [];
  for (let i = 0; i < l.length; i++) {
    if (l[i]!.c !== " " && l[i]!.c !== "\n") { r.push(l[i]!); continue; }
    let j = i, quebras = 0;
    while (j < l.length && (l[j]!.c === " " || l[j]!.c === "\n")) { if (l[j]!.c === "\n") quebras++; j++; }
    if (quebras === 0) r.push({ c: " ", estilo: l[i]!.estilo });
    else if (quebras >= 2) r.push({ c: "\n", estilo: l[i]!.estilo });
    else if (r[r.length - 1]?.c === "-" && ehLetra(r[r.length - 2]?.c) && ehLetra(l[j]?.c)) r.pop(); // "paga-\nmento" → "pagamento"
    else if (r[r.length - 1]?.c !== "-") r.push({ c: " ", estilo: l[i]!.estilo }); // "IPCA-\nE" → "IPCA-E"
    i = j - 1;
  }
  l = r;
  // espaço antes de pontuação / depois de "(" e espaço nas pontas dos parágrafos
  l = l.filter((x, i) => !(x.c === " " && (
    /[,.;:!?)]/.test(l[i + 1]?.c ?? "") || l[i - 1]?.c === "(" || i === 0 || i === l.length - 1
    || l[i - 1]?.c === "\n" || l[i + 1]?.c === "\n")));

  const trechos: TrechoFormatado[] = [];
  for (const x of l) {
    const u = trechos[trechos.length - 1];
    if (u && mesmoEstilo(u, x.estilo)) u.texto += x.c;
    else trechos.push({ texto: x.c, negrito: x.estilo.negrito, italico: x.estilo.italico, sublinhado: x.estilo.sublinhado });
  }
  return normalizarFormatado(marcacaoDosTrechos(trechos));
}
