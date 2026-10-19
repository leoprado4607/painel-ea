import { PaginaValores } from "@/components/PaginaValores";

export default async function Devidos({ params }: { params: Promise<{ id: string }> }) {
  return <PaginaValores id={(await params).id} tipo="devido" proximaEtapa="conferencia" />;
}
