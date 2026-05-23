import React, { forwardRef } from "react";

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
  controls,
  actions,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  controls?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <Card
      className={className}
      style={{
        border: "1px solid var(--border)",
        borderRadius: 16,
        overflow: "visible",
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--border)",
          background: "rgba(255,255,255,0.02)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: 0.2,
          }}
        >
          {title}
        </div>

        {(controls || actions) && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            {controls}
            {actions}
          </div>
        )}
      </div>

      <div style={{ padding: 16 }}>{children}</div>
    </Card>
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

export function IconButton({
  children,
  label,
  variant = "secondary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: React.ReactNode;
  label: string;
  variant?: ButtonVariant;
}) {
  return (
    <Button
      {...props}
      variant={variant}
      aria-label={label}
      title={label}
      style={{
        width: 34,
        height: 34,
        minWidth: 34,
        padding: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 999,
        ...props.style,
      }}
    >
      {children}
    </Button>
  );
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: Array<{ label: string; value: T }>;
  onChange: (value: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 2,
        padding: 3,
        border: "1px solid var(--border)",
        borderRadius: 999,
        background: "rgba(255,255,255,0.03)",
      }}
    >
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            style={{
              border: "none",
              borderRadius: 999,
              padding: "6px 10px",
              minHeight: 28,
              background: selected ? "var(--primary)" : "transparent",
              color: selected ? "#fff" : "var(--mutedText)",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              transition: "var(--transition-fast)",
              whiteSpace: "nowrap",
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input(props, ref) {
  return (
    <input
      ref={ref}
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
});

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
export function Badge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "muted";
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        background:
          tone === "muted" ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.08)",
        color: "var(--text)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {children}
    </span>
  );
}

export function StatusBadge({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "success" | "warning" | "danger" | "muted";
}) {
  const tones = {
    success: {
      background: "rgba(34,197,94,0.12)",
      border: "rgba(34,197,94,0.22)",
      color: "rgba(134,239,172,0.95)",
    },
    warning: {
      background: "rgba(234,179,8,0.12)",
      border: "rgba(234,179,8,0.22)",
      color: "rgba(253,230,138,0.95)",
    },
    danger: {
      background: "rgba(239,68,68,0.12)",
      border: "rgba(239,68,68,0.22)",
      color: "rgba(254,202,202,0.95)",
    },
    muted: {
      background: "rgba(148,163,184,0.10)",
      border: "rgba(255,255,255,0.14)",
      color: "rgba(203,213,225,0.95)",
    },
  } as const;

  const t = tones[tone];

  return (
    <span
      style={{
        padding: "4px 10px",
        borderRadius: 999,
        border: `1px solid ${t.border}`,
        background: t.background,
        color: t.color,
        fontWeight: 900,
        fontSize: 12,
        textTransform: "uppercase",
        letterSpacing: 0.6,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

export function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        background: "rgba(255,255,255,0.03)",
        padding: "14px 14px",
        boxShadow: "var(--shadow-soft)",
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: "var(--mutedText)",
          letterSpacing: 0.4,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 6,
          fontSize: 26,
          fontWeight: 900,
          letterSpacing: -0.6,
          color: "var(--text)",
        }}
      >
        {value}
      </div>
      {hint ? (
        <div style={{ marginTop: 4, fontSize: 12, color: "var(--mutedText)" }}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}

export function ActionTextLink({
  children,
  href,
  onClick,
  icon,
  muted = false,
}: {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  icon?: React.ReactNode;
  muted?: boolean;
}) {
  const commonStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 13,
    fontWeight: 600,
    color: muted ? "var(--mutedText)" : "var(--text)",
    textDecoration: "none",
    background: "transparent",
    border: "none",
    padding: 0,
    cursor: "pointer",
  };

  if (href) {
    return (
      <a href={href} style={commonStyle}>
        {icon}
        {children}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} style={commonStyle}>
      {icon}
      {children}
    </button>
  );
}

export function InlineAction({
  children,
  onClick,
  muted = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: "transparent",
        border: "none",
        padding: 0,
        cursor: "pointer",
        fontSize: 13,
        textDecoration: "underline",
        color: muted ? "var(--mutedText)" : "var(--text)",
      }}
    >
      {children}
    </button>
  );
}

export function InfoTile({
  label,
  value,
  action,
}: {
  label: string;
  value: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: 12,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            color: "var(--mutedText)",
            marginBottom: 4,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 14,
            color: "var(--text)",
            overflowWrap: "anywhere",
          }}
        >
          {value}
        </div>
      </div>

      {action ? <div>{action}</div> : null}
    </div>
  );
}

export function SectionActions({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
        paddingTop: 4,
      }}
    >
      {children}
    </div>
  );
}