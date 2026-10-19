import { PaginaValores } from "@/components/PaginaValores";

export default async function Recebidos({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ importado?: string }>;
}) {
  const [{ id }, { importado }] = await Promise.all([params, searchParams]);
  return <PaginaValores id={id} tipo="recebido" proximaEtapa="devidos" importado={importado === "1"} />;
}
