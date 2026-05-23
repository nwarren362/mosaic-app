# UI System – Mosaic App

## Purpose

This document defines how UI should be **designed, structured, and implemented** in Mosaic.

It combines:
- **Design principles** (how it should feel)
- **Architecture rules** (how it should be built)

The goal:
👉 Consistent, scalable UI that is easy to build and easy to use

---

## Core Principles

1. **Consistency over creativity**
   - Reuse patterns everywhere
   - Do not invent new UI patterns per page

2. **Hierarchy first**
   - Users must instantly understand what matters
   - Prefer progressive disclosure over cluttered forms

3. **Action clarity**
   - Primary actions are obvious
   - Secondary actions are quieter
   - Destructive actions are controlled

4. **Mobile-first always**
   - Everything must work comfortably on a phone

---

## Technical Architecture (for developers)

### Styling System
- Global styles: `src/app/globals.css`
- Theme presets: `src/lib/themePresets.ts`
- Theme provider: `src/app/providers.tsx`

All colours, spacing, and visual tokens must come from the theme.

---

### UI Primitives

Located in:
```
src/components/ui.tsx
```

Core components:
- Page
- Card
- SectionCard
- Button
- Input
- Textarea
- Field

Rules:
- ❌ Do NOT style raw HTML elements in pages
- ❌ Do NOT introduce new UI patterns directly in pages
- ✅ Add new UI elements to `ui.tsx`

---

### Form Controls

All inputs must use UI primitives:
- Input
- Textarea
- Select

Never use raw `<input>` / `<textarea>` in pages.

---

## Layout System (Design + Structure)

### Two-Page Pattern (MANDATORY)

All entity-based UI must follow this pattern:

---

### 1. Overview Page (List / Grid)

Purpose:
- Browse entities
- Search and filter
- Navigate to detail pages

Structure:
- Minimal page title (optional)
- Search + filters (progressive)
- Card or row list
- Add button: icon-only `+`

Rules:
- No forms visible by default
- Forms appear only after user action
- Cards must be scannable (minimal metadata)

---

### 2. Detail Page (Edit / Manage)

Purpose:
- Edit entity
- Manage related data

Structure:

1. Top Bar
   - Title
   - Back (left)
   - Save / Save & Close (right)

2. Details Section
   - Name
   - Description
   - Status

3. Subsections
   - Tags, Members, Contacts, etc.

Rules:
- Forms are allowed here
- Warn on unsaved changes
- Keep layout clean and structured

---

## Section Pattern (MANDATORY)

All sections must follow:

```
Section Title (count)   [controls]   [+]
```

Rules:
- Title left
- Controls middle/right
- `+` always on far right

---

## Action Hierarchy

### Page Level
- Primary actions (Save)

### Section Level
- Controls (filters)
- Add = icon only
- Add reveals inline form

### Form Actions
- Primary: Add / Save
- Secondary: Cancel

Cancel must:
- Close form
- Reset state

---

## Forms

Rules:
- Hidden by default on overview pages
- Revealed via `+`
- Group fields logically
- Avoid unnecessary fields

---

## Cards & Rows

Allowed patterns:

### Card
- Used for overview lists

### Row
- Used for compact lists
- Single-line layout

---

## Filters

Rules:
- One control per concept
- Use segmented controls

---

## Mobile Rules

- Must work at 375px
- Single-column layouts
- Large tap targets (44px)
- No hover dependency

---

## Destructive Actions

Rules:
- Prefer Active/Inactive over delete
- Only allow delete when safe

---

## What NOT to do

- No inline styling in pages
- No duplicate UI patterns
- No mixing filters and actions

---

## Collaboration Rules

When editing UI:
- Follow this system
- Prefer consistency over speed
- Return full files (not partial edits)

---

## Summary

If unsure:

```
Is this an entity?
→ Yes → Use Overview + Detail pages

Adding something?
→ Use + → inline form → Add / Cancel

Inside a section?
→ Use Section Pattern
```

This system must be followed across all features.