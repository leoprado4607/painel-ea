import type { TipoDocumento } from "@painel-ea/documentos";
import { montarDocumentos } from "@/lib/emissao";

const TIPOS: TipoDocumento[] = ["pacote_completo", "solicitacao", "cpex", "recapitulacao", "resumo", "exercicio"];

/**
 * Prévia em PDF (rascunho, não guardada): os mesmos documentos da emissão, com aviso no rodapé.
 * ?doc=solicitacao|cpex|recapitulacao|resumo|exercicio (&ano=2020) gera só aquela parte, para as abas dos documentos.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const doc = url.searchParams.get("doc") as TipoDocumento | null;
  const tipo = doc && TIPOS.includes(doc) ? doc : "pacote_completo";
  const ano = Number(url.searchParams.get("ano")) || undefined;
  try {
    const { pdf } = await montarDocumentos(id, { rascunho: true, tipo, ano });
    return new Response(new Uint8Array(pdf), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="previa-${tipo}-${id}.pdf"`, "Cache-Control": "no-store" },
    });
  } catch (e) {
    return new Response((e as Error).message, { status: 400 });
  }
}
