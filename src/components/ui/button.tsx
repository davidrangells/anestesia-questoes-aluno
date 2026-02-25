import * as React from "react";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export const Button = React.forwardRef<HTMLButtonElement, Props>(function Button(
  { className, variant = "primary", size = "md", disabled, ...props },
  ref
) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition " +
    "focus:outline-none focus:ring-4 focus:ring-slate-200 " +
    "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none";

  const variants: Record<ButtonVariant, string> = {
    primary: "bg-slate-900 text-white hover:bg-slate-800",
    secondary: "bg-white text-slate-900 border border-slate-200 hover:bg-slate-50",
    outline: "bg-transparent text-slate-900 border border-slate-300 hover:bg-slate-50",
    ghost: "bg-transparent text-slate-900 hover:bg-slate-100",
    danger: "bg-red-600 text-white hover:bg-red-500",
  };

  const sizes: Record<ButtonSize, string> = {
    sm: "px-3 py-2 text-sm",
    md: "px-5 py-3 text-sm",
    lg: "px-6 py-4 text-base",
  };

  return (
    <button
      ref={ref}
      disabled={disabled}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    />
  );
});