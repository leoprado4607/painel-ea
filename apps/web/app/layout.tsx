import type { Metadata } from "next";
import "./globals.css";

// Funções na Vercel em São Paulo (gru1), junto do Supabase: o projeto estava em iad1 (Washington) e cada consulta
// atravessava EUA <-> Brasil. Vale para todas as páginas e rotas (configuração herdada pelos segmentos).
export const preferredRegion = "gru1";

export const metadata: Metadata = {
  title: "Painel EA — Exercício Anterior",
  description: "Cálculo de exercício anterior corrigido pelo IPCA/IPCA-E",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
