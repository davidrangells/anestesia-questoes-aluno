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
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      {(title || subtitle || actions) && (
        <div className="rounded-[28px] border border-slate-200/70 bg-white/80 shadow-[0_16px_50px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="px-6 py-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              {title ? (
                <div className="text-[22px] sm:text-[26px] font-black tracking-tight text-slate-900 truncate">
                  {title}
                </div>
              ) : null}
              {subtitle ? (
                <div className="mt-1 text-sm text-slate-500">{subtitle}</div>
              ) : null}
            </div>

            {actions ? (
              <div className={cn("flex items-center gap-2 flex-wrap")}>
                {actions}
              </div>
            ) : null}
          </div>
        </div>
      )}

      <div>{children}</div>
    </div>
  );
}