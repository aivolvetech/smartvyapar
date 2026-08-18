# UI Shell Design

This document details the design system, variables, tokens, and layouts built for the Smart Vyapar desktop retail interface.

---

## 1. Checkpoint Verification Matrix

| Checkpoint | Status | Details |
| :--- | :---: | :--- |
| **Usable at 1366×768** | **PASS** | Responsive grids resize and keep sidebar layouts stable. |
| **No horizontal scroll** | **PASS** | Viewport layout has zero page-level horizontal overflow. |
| **Tab Navigation** | **PASS** | Enforces tabIndex and logical focus flows on forms and actions. |
| **Focus Indicators** | **PASS** | Visible focus outline ring variables are implemented. |

---

## 2. Design System Tokens (CSS Variables)

We define a centralized tokens register inside `src/index.css` to allow ease of maintenance and future theme shifts:

```css
:root {
  /* Spacing */
  --space-xs: 0.25rem;
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 2rem;

  /* Border Radii */
  --radius-xs: 4px;
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  
  /* Dimensions */
  --sidebar-width: 250px;
  --header-height: 65px;

  /* Theme Surfaces (Dark Theme default) */
  --bg-app: #080b11;
  --bg-sidebar: #0f131a;
  --bg-surface: #141822;
  --bg-surface-elevated: #1c212e;
  --border-color: rgba(255, 255, 255, 0.06);

  /* Font Color Hierarchy */
  --text-primary: #f3f4f6;
  --text-secondary: #9ca3af;
  --text-muted: #6b7280;

  /* Colors & Badges */
  --color-primary: #6366f1;
  --color-success: #10b981;
  --color-error: #ef4444;
  --color-warning: #f59e0b;
}
```

---

## 3. Keyboard & Accessibility (A11y) Features

*   **Keyboard Focus Indicator:** Added dynamic `:focus-visible` styling (`outline: 2px solid var(--border-color-focus)`) with a 3px outline offset to provide focus indicator loops.
*   **Semantic Form Layouts:** Built forms with clear `<label>` mappings and ARIA role alerts (`role="alert"`) for inline validation.
*   **Default keyboard submittals:** Enabled native form submit triggers allowing users to press `Enter` to submit profiles and settings updates.
*   **Escape handler:** Listening to global keydowns to dismiss toast alerts automatically upon pressing the `Escape` key.
