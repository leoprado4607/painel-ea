import type { Metadata } from "next";
import { Cormorant_Garamond, DM_Sans, Playfair_Display } from "next/font/google";
import "./globals.css";

// Mesma tipografia do Portal da Div Pg Pes (sispagpesbadm.com): DM Sans no texto, Cormorant Garamond nos títulos
// e Playfair Display itálico no nome do sistema.
const dmSans = DM_Sans({ subsets: ["latin"], weight: ["300", "400", "500", "600"], variable: "--fonte-texto", display: "swap" });
const cormorant = Cormorant_Garamond({ subsets: ["latin"], weight: ["400", "600", "700"], style: ["normal", "italic"], variable: "--fonte-titulo", display: "swap" });
const playfair = Playfair_Display({ subsets: ["latin"], weight: ["600"], style: ["italic"], variable: "--fonte-marca", display: "swap" });

export const metadata: Metadata = {
  title: "Painel EA — Exercício Anterior",
  description: "Cálculo de exercício anterior corrigido pelo IPCA/IPCA-E",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${dmSans.variable} ${cormorant.variable} ${playfair.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
