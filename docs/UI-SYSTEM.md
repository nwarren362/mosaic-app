# UI System – Mosaic App

## Philosophy

Mosaic uses a custom UI system designed for:

- Long-term maintainability
- Tenant (agency) specific branding
- Centralised control of visual tokens
- Rapid global visual changes

No page should directly style raw HTML elements.

All UI must flow through the system.

---

## Structure

### Global Styling
- `src/app/globals.css`
  - Defines design tokens (colors, spacing, radius, etc.)
  - Defines dark theme foundation

### Theme Presets
- `src/lib/themePresets.ts`
  - Defines tenant-specific theme overrides
  - Enables per-agency branding

### Theme Provider
- `src/app/providers.tsx`
  - Injects active theme into application
  - Applies theme variables at runtime

### UI Primitives
- `src/components/ui.tsx`

Exports reusable components:
- `Page`
- `Card`
- `Button`
- `Input`
- (Future: `Textarea`, `Select`, etc.)

These components are the ONLY permitted surface for styling form elements.

---

## Rules

1. Do not style raw `<input>`, `<select>`, `<textarea>` directly in pages.
2. Do not use inline styles.
3. Do not introduce external UI frameworks.
4. All new UI elements must be added to `ui.tsx`.
5. Pages should compose primitives, not define styling.

---

## Form Controls

All form controls must use UI primitives:

- Input
- Textarea
- Select

Raw HTML elements must not be used directly in pages.

---

## Adding a New UI Element

Example:

If a `Textarea` is needed:

1. Implement it in `ui.tsx`
2. Match styling of `Input`
3. Export it
4. Use it everywhere via import

Never style textarea directly in a page.

---

## Mobile-First Requirement

All layouts must:

- Be usable at 375px width
- Avoid hover-dependent interactions
- Use large tap targets
- Avoid fixed pixel widths

---

## Branding Strategy

Tenant branding is applied via theme presets.

No component should hard-code:

- Colors
- Backgrounds
- Brand accents

All visual values must reference theme tokens.

---

## Collaboration Contract

When requesting UI changes:

- Provide full file contents.
- Changes should be returned as full replacement files.
- No partial patch edits.

This ensures consistency and prevents styling drift.