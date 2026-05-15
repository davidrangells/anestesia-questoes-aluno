import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import StagingBanner from "@/components/StagingBanner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Anestesia Questões | Portal do Aluno",
  description: "Portal do aluno para simulados, desempenho e acompanhamento de estudos em anestesiologia.",
  icons: {
    icon: [{ url: "/logo-icon.png", type: "image/png" }],
    shortcut: "/logo-icon.png",
    apple: "/logo-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <head>
        {/*
          Aplica o tema antes do primeiro paint para evitar "flash" entre claro/escuro.
          Lê do localStorage; se não houver preferencia salva, usa claro (ignora OS).
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Sempre forca modo claro, ignorando preferencia salva no localStorage.
              try {
                document.documentElement.dataset.theme = "light";
                document.documentElement.classList.remove("dark");
                localStorage.setItem("aq.aluno.theme", "light");
              } catch (e) {
                document.documentElement.dataset.theme = "light";
              }
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <StagingBanner />
        {children}
      </body>
    </html>
  );
}
