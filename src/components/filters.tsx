"use client";

import type { CSSProperties, ReactNode } from "react";
import { Button } from "@/components/ui";

type FilterPanelProps = {
  children: ReactNode;
  style?: CSSProperties;
};

export function FilterPanel({ children, style }: FilterPanelProps) {
  return (
    <div
      style={{
        display: "grid",
        gap: "var(--space-3)",
        marginBottom: "var(--space-4)",
        padding: "var(--space-3)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        background: "rgba(255,255,255,0.02)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

type FilterRowProps = {
  label: string;
  children: ReactNode;
  labelWidth?: number;
  style?: CSSProperties;
};

export function FilterRow({ label, children, labelWidth = 96, style }: FilterRowProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `${labelWidth}px 1fr`,
        gap: "var(--space-3)",
        alignItems: "start",
        ...style,
      }}
    >
      <div
        style={{
          color: "var(--text)",
          fontSize: 13,
          fontWeight: 800,
          paddingTop: 8,
        }}
      >
        {label}:
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {children}
      </div>
    </div>
  );
}

type FilterChipProps = {
  children: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  title?: string;
};

export function FilterChip({
  children,
  selected = false,
  disabled = false,
  onClick,
  title,
}: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        border: selected ? "1px solid var(--primary)" : "1px solid var(--border)",
        background: selected ? "rgba(124,58,237,0.22)" : "rgba(255,255,255,0.03)",
        color: selected ? "var(--text)" : "var(--mutedText)",
        borderRadius: 999,
        padding: "7px 11px",
        fontSize: 13,
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {children}
    </button>
  );
}

type ClearFiltersButtonProps = {
  visible: boolean;
  onClick: () => void;
  label?: string;
};

export function ClearFiltersButton({
  visible,
  onClick,
  label = "Clear advanced filters",
}: ClearFiltersButtonProps) {
  if (!visible) return null;

  return (
    <div>
      <Button type="button" variant="secondary" onClick={onClick}>
        {label}
      </Button>
    </div>
  );
}
