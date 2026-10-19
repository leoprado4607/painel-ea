import type { NextConfig } from "next";

const config: NextConfig = {
  // motor de cálculo e leitor de fichas são publicados como código TypeScript dentro do monorepo
  transpilePackages: ["@painel-ea/engine", "@painel-ea/leitor-ficha", "@painel-ea/documentos"],
  // o pdf.js roda no servidor sem ser empacotado (usa o próprio worker em Node)
  serverExternalPackages: ["pdfjs-dist", "@react-pdf/renderer"],
  experimental: { serverActions: { bodySizeLimit: "20mb" } },
  // O pdfkit (usado pelo @react-pdf) carrega as fontes padrão por "subpath imports" (#standard-fonts/Helvetica),
  // que o rastreador de arquivos não segue: sem isto, o PDF falha na Vercel com "Cannot find module …/Helvetica.cjs".
  outputFileTracingIncludes: {
    "/**": ["../../node_modules/pdfkit/js/standard-fonts/**/*", "../../node_modules/pdfkit/js/data/**/*"],
  },
};

export default config;
