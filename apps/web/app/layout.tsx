import type { Metadata } from "next";
import "./globals.css";

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
