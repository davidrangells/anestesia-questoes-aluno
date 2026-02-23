import AlunoGuard from "@/components/AlunoGuard";

export default function AlunoLayout({ children }: { children: React.ReactNode }) {
  return <AlunoGuard>{children}</AlunoGuard>;
}