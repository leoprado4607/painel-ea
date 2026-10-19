import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLICAS = ["/login", ...(process.env.NODE_ENV === "development" ? ["/dev/previa"] : [])];

/**
 * Renova a sessão a cada requisição e protege as páginas: sem login → /login.
 * O 2º fator (autenticador) está desligado por enquanto (decisão de 19/10/2026); a tela /mfa continua no código
 * para religar. A troca obrigatória da senha provisória é conferida no layout (que já lê o perfil), para o
 * middleware não consultar o banco em toda requisição.
 */
export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (lista) => {
        lista.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        lista.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
  // getClaims valida o token localmente (chaves de assinatura do Supabase) e renova a sessão se preciso
  const { data } = await supabase.auth.getClaims();
  const logado = !!data?.claims?.sub;
  const caminho = req.nextUrl.pathname;
  const redirecionar = (para: string) => {
    const url = req.nextUrl.clone();
    url.pathname = para;
    url.search = "";
    const r = NextResponse.redirect(url);
    res.cookies.getAll().forEach((c) => r.cookies.set(c));
    return r;
  };

  if (!logado) return PUBLICAS.includes(caminho) ? res : redirecionar("/login");
  if (caminho === "/login" || caminho === "/mfa") return redirecionar("/processos");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico)$).*)"],
};
