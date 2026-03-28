# Design System: 도림 자동차 견적 해결책

## 1. Visual Theme & Atmosphere

A precise, data-first interface built for financial professionals calculating automotive operating lease quotes. The atmosphere is **clinical but approachable** — like a well-organized finance desk that takes its numbers seriously. Think Bloomberg Terminal restraint married to modern product design clarity.

- **Density:** Daily App Balanced (4) — forms breathe; no cockpit claustrophobia, but no wasted whitespace either
- **Variance:** Asymmetric-leaning (8) — layout hierarchy is intentional and non-symmetrical; monthly payment dominates visually at all times
- **Motion:** Fluid CSS (6) — spring-physics interactions on interactive elements; no cinematic theatrics for a professional tool

The defining visual signature: a **dark charcoal header strip** contrasting sharply against a **cool near-white canvas**, with white cards that float above the background due to subtle shadow. One single accent color — a **deep professional indigo** — appears on CTAs, active states, focus rings, key financial metrics, and the lender badge. Everything else is neutral.

---

## 2. Color Palette & Roles

- **Canvas Mist** (`#F3F4F8`) — Primary background surface. A very slightly blue-tinted near-white that reads as neutral but gives cards a floating quality when layered on top.
- **Pure Surface** (`#FFFFFF`) — All card and panel fills. Deliberate separation from the canvas background.
- **Zinc Night** (`#18181B`) — App header background. Creates strong visual anchoring at the top of the page; communicates authority and professional weight.
- **Charcoal Ink** (`#1C1C1C`) — Primary text. Off-black, never pure `#000000`. Used for headings, labels, and key values.
- **Muted Steel** (`#6E6E6E`) — Secondary text, descriptions, field labels, metadata. Maintains hierarchy without shouting.
- **Whisper Border** (`#E7E7E7`) — All structural dividers: card borders, row separators, divide-x lines. Subtle; never draws attention to itself.
- **Deep Indigo** (`#3B4FD0`) — The single accent color. Used exclusively for: primary buttons, active tab underlines, monthly payment hero values, lender type badges, focus rings, card accent pill markers, and the header brand badge. Saturation is calibrated below 80% — rich but not neon.
- **Indigo Mist** (`rgba(59,79,208,0.08)`) — Ultra-light indigo tint used as hero section background within the result card. Whisper-level; communicates premium brand color without overwhelming.
- **Amber Warning** (`#92400E` text / `#FFFBEB` bg / `#FDE68A` border) — Warning and advisory messages only. Never used decoratively.
- **Zinc Header Text** (`#FFFFFF`) — Text and icons appearing on the Zinc Night header background.
- **Zinc Subtitle** (`#A1A1AA`) — Subtitle and metadata text on the dark header.

**Banned colors:**
- Pure black `#000000` — always off-black
- Purple, violet, or pink accents — this is a finance tool, not a creative studio
- Neon or oversaturated variants of any color
- Green as a "success" accent — conflicts with the single-accent rule; use indigo tints

---

## 3. Typography Rules

- **Primary Font:** `Geist Variable` — Used for all UI text, labels, headings, navigation. Clean, modern, slightly technical character that suits a financial tool. Variable weight allows precise control without loading multiple files.
- **Korean Text Fallback:** `Pretendard` — For Korean-character-heavy text. Excellent legibility at small sizes; professional, not decorative.
- **Numbers & Financial Figures:** System monospace stack (`ui-monospace`, `SFMono-Regular`, `SF Mono`, `Menlo`, `Consolas`) — All currency amounts, percentages, rates, and financial metrics use monospace with `tabular-nums`. This ensures proper column alignment and visual stability when numbers change.

**Scale hierarchy:**
- **Hero financial metric (monthly payment):** `3xl` / `font-black` / `tracking-tight` — the single most dominant number on screen
- **Secondary metrics (IRR, residual rate, total cost):** `base` / `font-bold` — readable but clearly subordinate
- **Section titles (card headers):** `sm` / `font-semibold` — understated; authority through restraint, not size
- **Field labels (form rows):** `xs` / `font-semibold` — compact, no wasted vertical space
- **Metadata and sub-values:** `[10px]` / `font-medium` / uppercase + wide tracking for labels; `[11px]` / regular for secondary values

**Banned:**
- `Inter` — banned universally
- Any serif font — this is a dashboard and financial tool; serifs communicate editorial, not precision
- Gradient text on any heading
- Oversized H1 that "screams" — hierarchy comes from weight and color contrast, not raw size

---

## 4. Component Stylings

**Buttons:**
- Primary CTA ("견적 계산"): Deep Indigo fill, white text, `font-semibold`, no outer glow, subtle `-1px translateY` on `:active` to simulate physical press. Full-width within its container to signal its importance.
- Secondary/Outline: Transparent background, whisper border, muted foreground text. Compact (`sm` size) when paired with a primary CTA.
- Disabled state: 50% opacity; clearly inert.

**Cards (Form Section Cards):**
- White background (`#FFFFFF`) on Canvas Mist (`#F3F4F8`) — the contrast gives natural elevation.
- `shadow-sm` — a barely-there shadow that implies floating. Tinted subtly to the canvas background hue.
- `rounded-xl` — generously rounded, modern.
- Card header: A small `4px × 14px` Deep Indigo rounded pill as left-side accent marker. White background for the header row. Title in Charcoal Ink at `sm`/`font-semibold`. No dark full-header backgrounds.
- **Anti-pattern:** Do NOT use dark (`bg-slate-900`) header bars on form cards. The accent pill communicates section identity without brute-force contrast.

**Result Card (QuoteResultCard) — The Hero Component:**
- Elevated shadow with indigo tint: `box-shadow: 0 8px 24px -4px rgba(59,79,208,0.15)` — communicates this card as the key output.
- Horizontal split layout: left panel (monthly payment hero) + right panel (stacked secondary metrics).
- Left panel: Deep Indigo `#3B4FD0` background at 3% opacity (`Indigo Mist`). Monthly payment in `3xl`/`font-black`/`text-primary`/`font-mono`. Label in `10px` uppercase tracking-widest muted. Sub-value (internal figure) in `11px` muted.
- Right panel: Three stacked metric rows divided by Whisper Border lines. Each row: label `10px` uppercase muted, value `base`/`font-bold`/`font-mono`, optional sub-value `10px` muted. Width fixed at `w-48` (192px).
- Lender header: compact badge row. Lender name in `sm`/`font-semibold`. Condition badges as small outline pills (`10px`/`font-medium`). High-residual badge uses Indigo Mist background + Deep Indigo text.

**Form Grid (within each card):**
- 4-column grid: `[100px label | input | 100px label | input]`
- Label cells: Canvas Mist background, Charcoal Ink text, right border in Whisper Border.
- Input cells: white or Canvas Mist background, Whisper Border border, `rounded` corners, `h-8`/`text-xs` for compact density.
- Row separators: Whisper Border bottom border on all but last row.
- Max card width: `720px` — form cards never stretch beyond this regardless of screen width.

**Inputs:**
- Background: Canvas Mist (`#F3F4F8`). Appearance: recessed into the form surface.
- Focus: Deep Indigo ring (`ring-2 ring-primary/50`), border transitions to indigo.
- Disabled: 50% opacity. No interaction affordance.
- Checkboxes and radio buttons: `accent-color: Deep Indigo`. Not generic browser blue.

**Select Dropdowns:**
- Trigger: identical to standard input styling.
- Content/Popup: white background, `rounded-lg`, `shadow-md`, `ring-1 ring-black/10`. `min-w-72` for model/trim selectors to prevent name truncation.
- Items: `py-1` compact, focused state uses Canvas Mist background.

**Stat Row (bottom of VehicleInfoCard):**
- Replaces 3-equal-card pattern.
- `divide-x` with Whisper Border — no card boxes.
- First cell ("최종차량가"): value in Deep Indigo for visual primacy.
- All values in monospace `font-mono tabular-nums`.
- Labels: `10px` uppercase tracking-wider muted.

**Empty State (before calculation):**
- Centered composition in a `rounded-xl` dashed-border container.
- Small icon in a circular Canvas Mist pill.
- Short instructional text: medium weight title + small muted description.
- No generic "No data" text.

**Loading States:**
- Button during calculation: text changes to "계산 중..." with disabled state. No spinner overlay.

**Warnings:**
- Amber palette only. Rounded inline boxes below the result card. Never disrupts the hero layout.

---

## 5. Layout Principles

**Page structure:** Two-column grid: `[minmax(0, 720px) | 440px]`. Left: stacked form cards. Right: result card (sticky). Gap `20px`. Padding `20px` all sides.

**Left column constraint:** Maximum `720px`. This is the critical rule — without this cap, form inputs stretch grotesquely wide on large monitors. The 720px constraint keeps each input cell at approximately `230px` which is appropriate for a financial form.

**Right column:** Fixed `440px`. Sticky to the viewport top (`sticky top-5 h-fit`) so the result card stays visible while the user scrolls through the form.

**Card layout within left column:** Cards stack vertically with `gap: 12px`. No horizontal side-by-side form cards.

**Grid over flexbox math:** All multi-column layouts use CSS Grid. `calc()` percentage hacks are banned. Use `grid-cols-[fixed_1fr_fixed_1fr]` patterns.

**Section spacing:** Within cards, form rows are exactly `min-height: 40px`. No arbitrary tall rows.

**Asymmetry:** The 720px left / 440px right split is intentionally asymmetric. The heavier left form and lighter right result panel create a visual hierarchy that mirrors the user's workflow (fill form → see result).

---

## 6. Motion & Interaction

**Philosophy:** All motion communicates state change or provides tactile feedback. No decorative animation for its own sake in a financial tool.

**Spring physics:** `type: spring, stiffness: 100, damping: 20` for any interactive element that benefits from weight (modals, drawers, expandable sections).

**CSS transitions:** All hover states, focus states, tab switches: `transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1)`. Subtly decelerating — feels premium without drawing attention.

**Tab switching:** Active underline slides via CSS `border-bottom` transition. No Framer Motion required.

**Button press:** `:active` state applies `scale(0.98)` or `-translateY(1px)` for tactile push sensation.

**Accordion/details (고급 설정):** Smooth height transition using `details`/`summary` element. No jump.

**Banned motion:**
- No page-load entrance animations — this is a tool, not a landing page
- No infinite loops or pulsing on static data
- Never animate `top`, `left`, `width`, or `height`
- No parallax scrolling
- No gesture-based swipe animations

---

## 7. Anti-Patterns (Banned)

**Visual:**
- Emojis anywhere in the UI
- Pure black `#000000` — always off-black Zinc variants
- Neon glow or `box-shadow` outer glows on buttons or cards
- Full dark header bars (`bg-slate-900`) on form section cards — use accent pill instead
- Green as a success color (conflicts with single-accent rule)
- Gradient text on any heading or metric value
- Oversaturated accent colors

**Typography:**
- `Inter` font — banned entirely
- Any serif font (`Times New Roman`, `Georgia`, `Garamond`) — financial tool, not editorial
- Screaming oversized H1 headlines

**Layout:**
- Form cards wider than `720px` on large screens
- Three equal-width card grids (`grid-cols-3` with equal feature cards)
- Centered hero sections
- Horizontal overflow on any viewport
- `h-screen` — always use `min-h-[100dvh]`
- Flexbox percentage math (`calc(33% - 1rem)`)

**Content:**
- AI copywriting clichés: "Elevate", "Seamless", "Unleash", "Next-Gen", "Revolutionize"
- Generic placeholder names: "John Doe", "Acme Corp"
- Round fake numbers: `99.99%`, `50%` (use realistic messy data)
- Filler UI text: "Scroll to explore", "Get started today", scroll arrow icons
- Broken Unsplash image links

**Interaction:**
- Custom mouse cursors
- Spinning loaders (use skeletal shimmer)
- Generic `window.addEventListener('scroll')` for animation
