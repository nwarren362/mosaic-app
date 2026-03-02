import React from "react";

export function Page({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <main
      style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: "20px 16px",
      }}
    >
      {title && (
        <h1 style={{ fontSize: 32, margin: "8px 0 16px", letterSpacing: -0.5 }}>{title}</h1>
      )}
      {children}
    </main>
  );
}

export function Card({
  children,
  style,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode;
}) {
  return (
    <section
      {...props}
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 16,
        ...style,
      }}
    >
      {children}
    </section>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  children,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
}) {
  const base: React.CSSProperties = {
    padding: "10px 16px",
    borderRadius: "var(--radius-md)",
    fontSize: "var(--font-size-sm)",
    fontWeight: 600,
    cursor: "pointer",
    transition: "var(--transition-fast)",
    border: "1px solid transparent",
  };

  const variants: Record<ButtonVariant, React.CSSProperties> = {
    primary: {
      background: "var(--primary)",
      color: "#fff",
      boxShadow: "var(--shadow-soft)",
    },
    secondary: {
      background: "rgba(255,255,255,0.03)",
      color: "var(--text)",
      border: "1px solid rgba(255,255,255,0.18)",
    },
    ghost: {
      background: "transparent",
      color: "var(--mutedText)",
    },
    danger: {
      background: "#e5484d",
      color: "#fff",
    },
  };

  return (
    <button
      {...props}
      style={{
        ...base,
        ...variants[variant],
        ...props.style,
      }}
    >
      {children}
    </button>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        width: "100%",
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid var(--border)",
        background: "transparent",
        color: "var(--text)",
        outline: "none",
      }}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      style={{
        width: "100%",
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid var(--border)",
        background: "transparent",
        color: "var(--text)",
        outline: "none",
        resize: "vertical",
        ...props.style,
      }}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      style={{
        width: "100%",
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid var(--border)",
        background: "transparent",
        color: "var(--text)",
        outline: "none",
        ...props.style,
      }}
    />
  );
}
