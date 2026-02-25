import AlunoGuard from "@/components/AlunoGuard";
import AlunoSidebar from "@/components/aluno/AlunoSidebar";
import AlunoTopHeader from "@/components/aluno/AlunoTopHeader";

export default function AlunoPrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AlunoGuard>
      <div className="min-h-screen bg-[radial-gradient(1200px_circle_at_20%_0%,rgba(15,23,42,0.06),transparent_55%),radial-gradient(900px_circle_at_100%_20%,rgba(2,132,199,0.08),transparent_45%)]">
        <div className="flex min-h-screen">
          <AlunoSidebar />

          <div className="flex-1 flex flex-col min-w-0">
            <AlunoTopHeader />

            <main className="flex-1 min-w-0">
              <div className="px-6 sm:px-8 lg:px-10 py-8">
                <div className="mx-auto w-full max-w-[1200px]">
                  {children}
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>
    </AlunoGuard>
  );
}