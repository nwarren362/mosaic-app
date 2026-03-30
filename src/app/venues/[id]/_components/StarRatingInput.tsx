"use client";

import { useState } from "react";

type Props = {
  value: number | null;
  onChange: (value: number | null) => void;
};

export default function StarRatingInput({ value, onChange }: Props) {
  const [hoveredValue, setHoveredValue] = useState<number | null>(null);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ display: "flex", gap: 6 }}>
        {[1, 2, 3, 4, 5].map((star) => {
          const activeThreshold = hoveredValue ?? value ?? 0;
          const filled = activeThreshold >= star;

          return (
            <button
              key={star}
              type="button"
              aria-label={`Set rating to ${star}`}
              onClick={() => onChange(star)}
              onMouseEnter={() => setHoveredValue(star)}
              onMouseLeave={() => setHoveredValue(null)}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: 0,
                lineHeight: 1,
                fontSize: 26,
                color: filled ? "#d4a017" : "rgba(255,255,255,0.35)",
                textShadow: filled ? "0 0 8px rgba(212,160,23,0.25)" : "none",
                transition: "color 120ms ease, text-shadow 120ms ease, transform 120ms ease",
                transform: filled ? "scale(1.03)" : "scale(1)",
              }}
            >
              ★
            </button>
          );
        })}
      </div>

      {value != null ? (
        <button
          type="button"
          onClick={() => onChange(null)}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: 0,
            fontSize: 13,
            textDecoration: "underline",
            color: "var(--mutedText)",
          }}
        >
          Clear
        </button>
      ) : null}
    </div>
  );
}