import type { NextConfig } from "next";

const config: NextConfig = {
  // motor de cálculo e leitor de fichas são publicados como código TypeScript dentro do monorepo
  transpilePackages: ["@painel-ea/engine", "@painel-ea/leitor-ficha", "@painel-ea/documentos"],
  // o pdf.js roda no servidor sem ser empacotado (usa o próprio worker em Node)
  serverExternalPackages: ["pdfjs-dist", "@react-pdf/renderer"],
  experimental: { serverActions: { bodySizeLimit: "20mb" } },
};

export default config;
