# Frontend Render Safety

This document defines rules that prevent "blank page" regressions in protected app routes.

## 1) Shared app shells must render visible by default

- Do not apply global `opacity: 0` entrance classes to shared route containers like `AppLayout` main outlets.
- If you animate route content, animations must start visible and degrade safely when JavaScript timing or observers fail.

## 2) Visibility effects are opt-in, never broad

- Scroll-reveal behavior must only target explicit classes (for example, `.landing-reveal` on landing-only sections).
- Avoid selectors that target generic containers like `main section` across the whole app.

## 3) Every route tree needs a runtime fallback

- Wrap protected app routes with an error boundary that renders a visible fallback card.
- Fallback UI should include route context and a retry action.

## 4) Loading and empty states must be obvious in all themes

- Skeletons must remain visible in light and dark mode.
- Dashboard pages must show explicit loading text when fetching critical data.
- Empty states should be visible above the fold on common viewport heights.

## 5) Avoid fragile global style overrides

- Do not use broad `[style*=\"...\"]` selectors for behavior-critical color/visibility on shared UI.
- Prefer explicit classes and dark-mode variants.

## 6) Null-safe rendering for session cards

- Use guard helpers (for example, `safeText`) for dynamic labels and titles.
- Never assume `title`, prompt fields, or profile fields are non-null.
