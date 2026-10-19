import { Aviso } from "@/components/Aviso";
import { GestaoOperadores, type Operador } from "@/components/GestaoOperadores";
import { sessao } from "@/lib/sessao";

/** Operadores: painel exclusivo do Admin para cadastrar, desativar, redefinir o acesso e excluir. */
export default async function Operadores() {
  const { supabase, perfil, user } = await sessao();
  if (perfil?.papel !== "admin") return <Aviso tipo="info">Somente o Admin cadastra e exclui operadores.</Aviso>;
  const [{ data: usuarios }, { data: oms }] = await Promise.all([
    supabase.from("perfil")
      .select("usuario_id, nome, posto, cpf, papel, ativo, trocar_senha, om:om_id(nome)")
      .is("excluido_em", null).order("papel").order("nome")
      .returns<(Omit<Operador, "om"> & { om: { nome: string } | null })[]>(),
    supabase.from("om").select("id, nome").eq("ativa", true).order("nome"),
  ]);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Operadores</h1>
      <p className="text-sm text-suave">Operadores entram com o CPF e uma senha, veem e editam todos os processos do sistema.</p>
      <GestaoOperadores
        usuarios={(usuarios ?? []).map((u) => ({ ...u, om: u.om?.nome ?? null }))}
        oms={oms ?? []}
        euId={user.id}
      />
    </div>
  );
}
