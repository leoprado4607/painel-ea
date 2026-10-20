import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Aviso } from "@/components/Aviso";
import { sessao } from "@/lib/sessao";
import type { Om } from "@/lib/tipos";

const ROTULOS = {
  nome: "Nome da OM", regiao_militar: "Região Militar (ex.: 10ª)", codom: "CODOM", unidade_gestora: "Unidade Gestora (UG)",
  cidade_uf: "Cidade e Estado (ex.: Natal-RN)",
  ordenador_nome: "Ordenador de Despesas — nome e posto", ordenador_funcao: "Ordenador de Despesas — função",
} as const;
// Fiscal Adm e Chefe da Div Pessoal não aparecem mais nos documentos: quem assina é o operador logado (Auxiliar Div Pg Pes).
const CAMPOS = Object.entries(ROTULOS) as [keyof typeof ROTULOS, string][];

async function salvar(form: FormData) {
  "use server";
  const { supabase, perfil } = await sessao();
  const id = String(form.get("id") ?? "");
  if (perfil?.papel !== "admin" || !id) return;
  const dados = Object.fromEntries(CAMPOS.map(([k]) => [k, String(form.get(k) ?? "").trim() || null]));
  if (!dados.nome) return;
  await supabase.from("om").update(dados).eq("id", id);
  revalidatePath("/om");
}

/** Dados da OM usados nos cabeçalhos e nas assinaturas dos documentos. Só o Admin vê e altera. */
export default async function DadosOm({ searchParams }: { searchParams: Promise<{ om?: string }> }) {
  const { supabase, perfil } = await sessao();
  // só o Admin vê e altera os dados da OM (menu "Administração")
  if (perfil?.papel !== "admin") redirect("/passo-a-passo");
  const { data: oms } = await supabase.from("om").select("*").order("nome").returns<Om[]>();
  const { om: pedida } = await searchParams;
  const om = oms?.find((o) => o.id === pedida) ?? oms?.[0];
  if (!om) return <Aviso tipo="atencao">Nenhuma OM cadastrada.</Aviso>;
  return (
    <div className="space-y-4">
      <h1 className="titulo-pagina">Dados da OM</h1>
      <p className="text-sm text-suave">Aparecem no cabeçalho e nas assinaturas dos documentos emitidos.</p>
      {(oms?.length ?? 0) > 1 && (
        <nav aria-label="OMs" className="flex flex-wrap gap-2">
          {oms!.map((o) => (
            <Link key={o.id} href={`/om?om=${o.id}`} aria-current={o.id === om.id ? "page" : undefined}
              className={`border px-3 py-1 text-sm ${o.id === om.id ? "border-marca-700 bg-marca-700 text-white" : "border-borda bg-white text-suave"}`}>
              {o.nome}
            </Link>
          ))}
        </nav>
      )}
      <form action={salvar} key={om.id} className="cartao grid gap-4 sm:grid-cols-2">
        <input type="hidden" name="id" value={om.id} />
        <fieldset className="contents">
          {CAMPOS.map(([k, rotulo]) => (
            <div key={k} className={k === "nome" ? "sm:col-span-2" : ""}>
              <label htmlFor={k} className="rotulo">{rotulo}</label>
              <input id={k} name={k} defaultValue={om[k] ?? ""} className="entrada" required={k === "nome"} />
            </div>
          ))}
          <div className="sm:col-span-2 flex justify-end"><button className="botao">Salvar</button></div>
        </fieldset>
      </form>
    </div>
  );
}
