import { textoSemFormatacao } from "@painel-ea/engine";
import { postoAbreviado } from "@/lib/postos";
import { supabaseServidor } from "@/lib/supabase/server";

interface Linha {
  processo_id: string; militar_posto: string | null; militar_nome: string; operador: string | null; emitido: boolean;
  periodo_inicio: string | null; periodo_fim: string | null; explicacao: string | null;
}

const data = (d: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : "—");

/**
 * "Repositório" (Informações → Explicação do não pagamento à época): baixa um .txt (abre no Bloco de Notas) com as
 * explicações já registradas em processos da mesma espécie da dívida: P/G e nome do militar, operador que emitiu
 * (em rascunho, quem criou), período da dívida e o texto. O processo aberto (`exceto`) fica de fora.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const especie = url.searchParams.get("especie")?.trim() ?? "";
  const exceto = url.searchParams.get("exceto");
  const texto = (s: string, status = 200) => new Response(s, { status, headers: { "content-type": "text/plain; charset=utf-8" } });
  if (!especie) return texto("Escolha a espécie da dívida.", 400);
  const supabase = await supabaseServidor();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return texto("Sessão expirada. Entre de novo.", 401);
  const { data: linhas, error } = await supabase.rpc("repositorio_explicacoes", { p_especie: especie });
  if (error) return texto(`Não foi possível montar o repositório: ${error.message}`, 500);
  const itens = ((linhas ?? []) as Linha[]).filter((l) => l.processo_id !== exceto);

  const agora = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
  const traco = "=".repeat(80);
  const partes = [
    `REPOSITÓRIO DE EXPLICAÇÕES DO NÃO PAGAMENTO À ÉPOCA`,
    `Espécie da dívida: ${especie}`,
    `Gerado em ${agora} · ${itens.length === 1 ? "1 explicação" : `${itens.length} explicações`}`,
    traco,
  ];
  if (!itens.length) partes.push("", "Nenhuma explicação registrada para esta espécie da dívida.");
  itens.forEach((l, i) => {
    partes.push(
      "",
      `${i + 1}. ${[postoAbreviado(l.militar_posto), l.militar_nome].filter(Boolean).join(" ")}`,
      `Operador: ${l.operador ?? "—"}${l.emitido ? "" : " (rascunho, ainda não emitido)"}`,
      `Período da dívida: ${data(l.periodo_inicio)} a ${data(l.periodo_fim)}`,
      "Explicação:",
      textoSemFormatacao(l.explicacao ?? "").trim(),
      "",
      "-".repeat(80),
    );
  });
  // Bloco de Notas: BOM do UTF-8 (acentos) e quebras de linha do Windows
  const corpo = "﻿" + partes.join("\n").replace(/\n/g, "\r\n") + "\r\n";
  const nome = `Repositório - ${especie.replace(/[\\/:*?"<>|]/g, "-")}.txt`;
  return new Response(corpo, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "content-disposition": `attachment; filename="repositorio.txt"; filename*=UTF-8''${encodeURIComponent(nome)}`,
      "cache-control": "no-store",
    },
  });
}
