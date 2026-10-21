import { NextResponse } from "next/server";
import { caminhoDoZip, nomeDoPacote } from "@/lib/pacote";
import { supabaseServidor } from "@/lib/supabase/server";

/**
 * "Download arquivos": baixa o ZIP de uma versão emitida (uma pasta com cada documento em PDF separado), por um link
 * temporário (60 s) do Storage. Versões emitidas antes desta opção não têm ZIP.
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const { id, docId } = await params;
  const supabase = await supabaseServidor();
  const [{ data: doc }, { data: p }] = await Promise.all([
    supabase.from("documento").select("caminho_storage, versao").eq("id", docId).eq("processo_id", id).maybeSingle(),
    supabase.from("processo").select("numero, militar:militar_id(nome)").eq("id", id).maybeSingle(),
  ]);
  if (!doc) return new Response("Documento não encontrado.", { status: 404 });
  const militar = (p?.militar as unknown as { nome: string } | null)?.nome ?? "";
  const nome = `${nomeDoPacote(p?.numero ?? null, militar)} - v${doc.versao}.zip`;
  const { data, error } = await supabase.storage.from("documentos").createSignedUrl(caminhoDoZip(doc.caminho_storage), 60, { download: nome });
  if (error || !data) {
    return new Response("Os arquivos separados não existem para esta versão (emitida antes desta opção). Reabra o processo e emita de novo.", {
      status: 404, headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  return NextResponse.redirect(data.signedUrl);
}
