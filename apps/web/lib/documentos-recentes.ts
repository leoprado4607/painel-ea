/** Últimos documentos que materializam o direito digitados pelo operador, oferecidos como opção em "Informações". */
import { textoSemFormatacao } from "@painel-ea/engine";
import { documentosDoAmparo } from "./amparo";
import type { sessao } from "./sessao";

type Supabase = Awaited<ReturnType<typeof sessao>>["supabase"];

export const QTDE_DOCUMENTOS_RECENTES = 6;
/** Processos lidos para achar os documentos diferentes (o mesmo documento costuma se repetir em vários cálculos). */
const PROCESSOS_CONSULTADOS = 100;

const chave = (d: string) => textoSemFormatacao(d).replace(/\s+/g, " ").trim().toLocaleLowerCase("pt-BR");

/** @param amparos complementos.amparo de cada processo, do mais recente para o mais antigo. Repetidos aparecem uma vez só. */
export function ultimosDocumentos(amparos: (string | null | undefined)[], limite = QTDE_DOCUMENTOS_RECENTES): string[] {
  const vistos = new Set<string>();
  const lista: string[] = [];
  for (const amparo of amparos)
    for (const doc of documentosDoAmparo(amparo)) {
      const k = chave(doc);
      if (!k || vistos.has(k)) continue;
      vistos.add(k);
      lista.push(doc);
      if (lista.length === limite) return lista;
    }
  return lista;
}

/** Documentos dos cálculos iniciados pelo operador, sem os do processo aberto. Se a consulta falhar, o campo só fica sem opções. */
export async function documentosRecentesDoOperador(supabase: Supabase, usuarioId: string, processoAberto?: string): Promise<string[]> {
  const { data, error } = await supabase.from("processo").select("id, amparo:complementos->>amparo")
    .eq("criado_por", usuarioId).order("atualizado_em", { ascending: false }).limit(PROCESSOS_CONSULTADOS)
    .returns<{ id: string; amparo: string | null }[]>();
  if (error) return [];
  return ultimosDocumentos((data ?? []).filter((p) => p.id !== processoAberto).map((p) => p.amparo));
}
