import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLICAS = ["/login", ...(process.env.NODE_ENV === "development" ? ["/dev/previa"] : [])];

/**
 * Renova a sessão a cada requisição e protege as páginas:
 * sem login → /login; login sem o 2º fator (2FA) → /mfa.
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
  const { data: { user } } = await supabase.auth.getUser();
  const caminho = req.nextUrl.pathname;
  const redirecionar = (para: string) => {
    const url = req.nextUrl.clone();
    url.pathname = para;
    url.search = "";
    const r = NextResponse.redirect(url);
    res.cookies.getAll().forEach((c) => r.cookies.set(c));
    return r;
  };

  if (!user) return PUBLICAS.includes(caminho) ? res : redirecionar("/login");
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const precisa2fa = aal?.currentLevel !== "aal2";
  if (precisa2fa && caminho !== "/mfa") return redirecionar("/mfa");
  if (precisa2fa) return res;
  // Depois do 2FA: senha provisória precisa ser trocada antes de qualquer outra tela.
  const { data: perfil } = await supabase.from("perfil").select("trocar_senha").eq("usuario_id", user.id).maybeSingle();
  if (perfil?.trocar_senha && caminho !== "/trocar-senha") return redirecionar("/trocar-senha");
  if (!perfil?.trocar_senha && caminho === "/trocar-senha") return redirecionar("/processos");
  if (caminho === "/mfa" || caminho === "/login") return redirecionar("/processos");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|ico)$).*)"],
};
