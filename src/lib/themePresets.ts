export type ThemePreset =
  | "obsidian"
  | "crimson"
  | "electric"
  | "amethyst"
  | "emerald"
  | "sand"
  | "steel"
  | "sunset";

export const THEME_PRESETS: Record<ThemePreset, Record<string, string>> = {
  obsidian: {
    "--bg": "#0b0d10",
    "--text": "#e8eef6",
    "--mutedText": "#a6b2c2",
    "--card": "#121722",
    "--border": "#232c3a",
    "--primary": "#7c3aed",
    "--primaryText": "#ffffff",
  },
  crimson: {
    "--bg": "#0b0b0d",
    "--text": "#f3f5f7",
    "--mutedText": "#aab3bf",
    "--card": "#141018",
    "--border": "#2a2230",
    "--primary": "#ef4444",
    "--primaryText": "#ffffff",
  },
  electric: {
    "--bg": "#070a10",
    "--text": "#e7f1ff",
    "--mutedText": "#9db2d1",
    "--card": "#0f1626",
    "--border": "#22314f",
    "--primary": "#22d3ee",
    "--primaryText": "#001018",
  },
  amethyst: {
    "--bg": "#0b0a12",
    "--text": "#ecebff",
    "--mutedText": "#b2b0d6",
    "--card": "#141327",
    "--border": "#2a2946",
    "--primary": "#a78bfa",
    "--primaryText": "#120a22",
  },
  emerald: {
    "--bg": "#070c0b",
    "--text": "#e6fff6",
    "--mutedText": "#9cc7b7",
    "--card": "#0f1a17",
    "--border": "#1f3a33",
    "--primary": "#34d399",
    "--primaryText": "#052015",
  },
  sand: {
    "--bg": "#0d0b08",
    "--text": "#fff6e9",
    "--mutedText": "#d1c1aa",
    "--card": "#17130e",
    "--border": "#2c2419",
    "--primary": "#f59e0b",
    "--primaryText": "#1a1206",
  },
  steel: {
    "--bg": "#0a0c10",
    "--text": "#ecf2ff",
    "--mutedText": "#a4afc4",
    "--card": "#111623",
    "--border": "#24304a",
    "--primary": "#60a5fa",
    "--primaryText": "#071018",
  },
  sunset: {
    "--bg": "#0f0a0b",
    "--text": "#fff1f2",
    "--mutedText": "#d8aab0",
    "--card": "#1a1014",
    "--border": "#3a2228",
    "--primary": "#fb7185",
    "--primaryText": "#1a070b",
  },
};