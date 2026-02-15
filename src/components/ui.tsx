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

export function Card({ children }: { children: React.ReactNode }) {
  return (
    <section
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 16,
      }}
    >
      {children}
    </section>
  );
}

export function Button({
  children,
  onClick,
  type,
  disabled,
  variant = "primary",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  variant?: "primary" | "ghost" | "danger";
}) {
  const base: React.CSSProperties = {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    fontWeight: 600,
  };

  const styles: Record<string, React.CSSProperties> = {
    primary: { background: "var(--primary)", color: "var(--primaryText)", border: "1px solid transparent" },
    ghost: { background: "transparent", color: "var(--text)" },
    danger: { background: "transparent", color: "#ff6b6b", border: "1px solid #5b2323" },
  };

  return (
    <button type={type ?? "button"} onClick={onClick} disabled={disabled} style={{ ...base, ...styles[variant] }}>
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