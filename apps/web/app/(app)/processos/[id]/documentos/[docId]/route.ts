import { NextResponse } from "next/server";
import { supabaseServidor } from "@/lib/supabase/server";

/** Abre um documento guardado: gera um link temporário (60 s) do Storage. RLS garante que é da OM do usuário. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const { id, docId } = await params;
  const supabase = await supabaseServidor();
  const { data: doc } = await supabase.from("documento").select("caminho_storage").eq("id", docId).eq("processo_id", id).maybeSingle();
  if (!doc) return new Response("Documento não encontrado.", { status: 404 });
  const { data, error } = await supabase.storage.from("documentos").createSignedUrl(doc.caminho_storage, 60);
  if (error || !data) return new Response("Não foi possível abrir o documento.", { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}
