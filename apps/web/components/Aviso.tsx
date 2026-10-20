export function Aviso({ tipo = "info", children }: { tipo?: "info" | "erro" | "ok" | "atencao"; children: React.ReactNode }) {
  const cores = {
    info: "border-sky-200 bg-sky-50 text-sky-900",
    erro: "border-red-200 bg-red-50 text-red-900",
    ok: "border-green-200 bg-green-50 text-green-900",
    atencao: "border-amber-200 bg-amber-50 text-amber-900",
  }[tipo];
  return <div role={tipo === "erro" ? "alert" : "status"} className={`border px-4 py-3 text-sm ${cores}`}>{children}</div>;
}
