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

export function SectionCard({
  title,
  children,
  className = "",
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={className}>
      <div className="flex flex-col gap-4">
        <div className="text-sm font-medium text-muted-foreground">
          {title}
        </div>

        {children}
      </div>
    </Card>
  )
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
// --- Form primitives ---------------------------------------------------------

export function FormSection({
  title,
  description,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  title?: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      {...props}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        paddingTop: 12,
        borderTop: "1px solid var(--border)",
        ...props.style,
      }}
    >
      {(title || description) && (
        <header style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {title && (
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{title}</h2>
          )}
          {description && (
            <p style={{ margin: 0, fontSize: 13, color: "var(--mutedText)" }}>
              {description}
            </p>
          )}
        </header>
      )}

      {children}
    </section>
  );
}

export function Field({
  label,
  htmlFor,
  required,
  helpText,
  error,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  label: string;
  htmlFor?: string;
  required?: boolean;
  helpText?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      {...props}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        ...props.style,
      }}
    >
      <label
        htmlFor={htmlFor}
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "var(--mutedText)",
        }}
      >
        {label}
        {required ? <span style={{ marginLeft: 4, color: "var(--text)" }}>*</span> : null}
      </label>

      {children}

      {error ? (
        <div style={{ fontSize: 12, color: "#e5484d" }}>{error}</div>
      ) : helpText ? (
        <div style={{ fontSize: 12, color: "var(--mutedText)" }}>{helpText}</div>
      ) : null}
    </div>
  );
}