// src/app/aluno/(private)/layout.tsx
import AlunoGuard from "@/components/AlunoGuard";
import AlunoSidebar from "@/components/aluno/AlunoSidebar";

export default function AlunoPrivateLayout({ children }: { children: React.ReactNode }) {
  return (
    <AlunoGuard>
      <div className="flex min-h-screen">
        <AlunoSidebar />
        <main className="flex-1 min-w-0">
          <div className="px-4 sm:px-6 lg:px-8 py-6">{children}</div>
        </main>
      </div>
    </AlunoGuard>
  );
}