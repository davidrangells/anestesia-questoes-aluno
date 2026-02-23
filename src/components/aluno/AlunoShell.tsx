// src/components/aluno/AlunoShell.tsx
"use client";

import React from "react";

function cn(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

export default function AlunoShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      {/* Header premium */}
      <div className="rounded-3xl border bg-white shadow-sm">
        <div className="px-5 sm:px-6 py-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="text-xl sm:text-2xl font-black text-slate-900 truncate">
              {title}
            </div>
            {subtitle ? <div className="mt-1 text-sm text-slate-500">{subtitle}</div> : null}
          </div>

          {actions ? <div className={cn("flex items-center gap-2 flex-wrap")}>{actions}</div> : null}
        </div>
      </div>

      {/* Content */}
      <div>{children}</div>
    </div>
  );
}