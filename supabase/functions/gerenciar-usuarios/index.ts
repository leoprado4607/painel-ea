// Edge Function: o Admin cadastra, desativa/reativa, exclui e redefine o acesso dos operadores.
// Usa a service role (disponível só aqui, no Supabase) para a API administrativa de login; o site nunca vê essa chave.
// Exige login (Verify JWT ligado): o Admin é identificado pelo token enviado pelo site.
//
// Login por CPF: o Supabase Auth só entra por e-mail, então cada operador recebe o e-mail técnico
// "<11 dígitos>@cpf.painel-ea.local" (nunca recebe mensagens). O site converte o CPF digitado no mesmo e-mail.
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

type Pedido =
  | { acao: "criar"; cpf: string; nome: string; posto?: string; omId: string }
  | { acao: "desativar" | "reativar" | "excluir" | "redefinir"; usuarioId: string };

const DOMINIO_LOGIN = "cpf.painel-ea.local";

const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });

/** CPF: 11 dígitos, não repetidos, dois dígitos verificadores (módulo 11). */
function cpfValido(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const dv = (n: number) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(cpf[i]) * (n + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(cpf[9]) && dv(10) === Number(cpf[10]);
}

/** Senha provisória legível (sem caracteres ambíguos), com letras, números e símbolo. */
function senhaProvisoria(): string {
  const letras = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz", numeros = "23456789", simbolos = "@#$%&*!?";
  const todos = letras + numeros + simbolos;
  const sorteio = (alfabeto: string, n: number) => {
    const buf = new Uint32Array(n);
    crypto.getRandomValues(buf);
    return [...buf].map((x) => alfabeto[x % alfabeto.length]).join("");
  };
  const partes = [...sorteio(letras, 6), ...sorteio(numeros, 3), ...sorteio(simbolos, 1), ...sorteio(todos, 4)];
  const ordem = new Uint32Array(partes.length);
  crypto.getRandomValues(ordem);
  return partes.map((c, i) => [ordem[i]!, c] as const).sort((a, b) => a[0] - b[0]).map(([, c]) => c).join("");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return resposta({ erro: "use POST" }, 405);
  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  // Quem está pedindo (pelo token do site)
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const { data: quem, error: eQuem } = await admin.auth.getUser(token);
  if (eQuem || !quem.user) return resposta({ erro: "não autenticado" }, 401);
  const { data: eu } = await admin.from("perfil").select("papel, ativo, excluido_em").eq("usuario_id", quem.user.id).maybeSingle();
  if (!eu?.ativo || eu.excluido_em || eu.papel !== "admin") return resposta({ erro: "apenas o Admin pode gerenciar operadores" }, 403);

  let p: Pedido;
  try { p = await req.json(); } catch { return resposta({ erro: "pedido inválido" }, 400); }

  if (p.acao === "criar") {
    const cpf = String(p.cpf ?? "").replace(/\D/g, "");
    const nome = String(p.nome ?? "").trim();
    if (!cpfValido(cpf)) return resposta({ erro: "CPF inválido" }, 400);
    if (!nome) return resposta({ erro: "informe o nome" }, 400);
    const { data: om } = await admin.from("om").select("id").eq("id", p.omId).maybeSingle();
    if (!om) return resposta({ erro: "escolha a OM do operador" }, 400);
    const { data: repetido } = await admin.from("perfil").select("usuario_id").eq("cpf", cpf).is("excluido_em", null).maybeSingle();
    if (repetido) return resposta({ erro: "já existe um operador com este CPF" }, 400);
    const senha = senhaProvisoria();
    const { data: novo, error } = await admin.auth.admin.createUser({
      email: `${cpf}@${DOMINIO_LOGIN}`, password: senha, email_confirm: true, user_metadata: { nome },
    });
    if (error || !novo.user) {
      const jaExiste = /already|registered|exists/i.test(error?.message ?? "");
      return resposta({ erro: jaExiste ? "já existe um login com este CPF" : `não foi possível criar: ${error?.message}` }, 400);
    }
    const { error: e2 } = await admin.from("perfil").insert({
      usuario_id: novo.user.id, om_id: om.id, papel: "operador", nome, posto: p.posto?.trim() || null, cpf, trocar_senha: true,
    });
    if (e2) {
      await admin.auth.admin.deleteUser(novo.user.id); // não deixa login sem perfil
      return resposta({ erro: `não foi possível criar o perfil: ${e2.message}` }, 400);
    }
    return resposta({ ok: true, usuarioId: novo.user.id, senhaProvisoria: senha });
  }

  // Demais ações: só sobre operadores (nunca sobre si mesmo nem sobre outro Admin)
  if (!("usuarioId" in p) || p.usuarioId === quem.user.id) return resposta({ erro: "ação não permitida sobre o próprio usuário" }, 400);
  const { data: alvo } = await admin.from("perfil").select("papel, excluido_em").eq("usuario_id", p.usuarioId).maybeSingle();
  if (!alvo || alvo.excluido_em) return resposta({ erro: "operador não encontrado" }, 404);
  if (alvo.papel !== "operador") return resposta({ erro: "só é possível alterar operadores" }, 403);

  if (p.acao === "desativar" || p.acao === "reativar") {
    const ativo = p.acao === "reativar";
    const { error } = await admin.from("perfil").update({ ativo }).eq("usuario_id", p.usuarioId);
    if (error) return resposta({ erro: error.message }, 400);
    await admin.auth.admin.updateUserById(p.usuarioId, { ban_duration: ativo ? "none" : "876000h" });
    return resposta({ ok: true });
  }

  if (p.acao === "redefinir") {
    // Sem e-mail não há "esqueci a senha": o Admin gera nova senha provisória e apaga o autenticador,
    // para o operador cadastrar de novo (celular trocado ou perdido).
    const senha = senhaProvisoria();
    const { error } = await admin.auth.admin.updateUserById(p.usuarioId, { password: senha });
    if (error) return resposta({ erro: error.message }, 400);
    const { data: fatores } = await admin.auth.admin.mfa.listFactors({ userId: p.usuarioId });
    for (const f of fatores?.factors ?? []) await admin.auth.admin.mfa.deleteFactor({ userId: p.usuarioId, id: f.id });
    await admin.from("perfil").update({ trocar_senha: true }).eq("usuario_id", p.usuarioId);
    return resposta({ ok: true, senhaProvisoria: senha });
  }

  if (p.acao === "excluir") {
    // Apaga o login de vez quando o operador não tem registros ligados a ele. Se já criou processos ou
    // documentos, o login é bloqueado e marcado como excluído: some da lista, libera o CPF para novo
    // cadastro e mantém o nome na auditoria.
    const { error } = await admin.auth.admin.deleteUser(p.usuarioId);
    if (!error) return resposta({ ok: true, apagado: true });
    const { error: e2 } = await admin.from("perfil")
      .update({ ativo: false, excluido_em: new Date().toISOString() }).eq("usuario_id", p.usuarioId);
    if (e2) return resposta({ erro: e2.message }, 400);
    await admin.auth.admin.updateUserById(p.usuarioId, {
      email: `excluido-${p.usuarioId}@${DOMINIO_LOGIN}`, ban_duration: "876000h",
    });
    return resposta({ ok: true, apagado: false });
  }
  return resposta({ erro: "ação desconhecida" }, 400);
});
