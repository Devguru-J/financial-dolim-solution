# Design System Document: Precision-Led Financial Intelligence

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Architectural Ledger."** 

Unlike generic SaaS platforms that rely on "friendly" rounded corners and excessive whitespace, this system embraces the density of professional financial operations. It is designed to feel like a high-end, custom-built terminal—authoritative, immovable, and surgical in its precision. We break the "template" look by prioritizing **Information Density** over "fluff," using a sophisticated tonal layering system that favors background shifts over crude borders. The aesthetic is "Low-Contrast, High-Context," ensuring that Korean typography and complex numeric data remain the focal point during extended periods of institutional use.

---

## 2. Colors & Surface Architecture
We move away from the "boxes within boxes" approach. Depth is created through a sophisticated hierarchy of cool-toned surfaces.

### Primary Tonal Range
- **Primary (`#041627`)**: Our "Anchor Navy." Used for primary actions and sidebar navigation to ground the interface.
- **Primary Container (`#1a2b3c`)**: Used for high-level headers and "Command Center" areas.
- **Surface (`#f7f9fb`)**: The foundational canvas. A cool, low-strain gray that mimics high-quality bond paper.

### Status Tokens
- **Success/Active (Tertiary Fixed: `#6ffbbe`)**: A sharp Emerald Green. Use for "Active" contracts and successful data imports.
- **Warning/Pending (Amber)**: Use `on_primary_fixed_variant` tones for high-visibility warnings without the "alarmist" red.
- **Error (`#ba1a1a`)**: Reserved strictly for critical data mismatches or failed estimations.

### The "No-Line" Rule
**Explicit Instruction:** Prohibit the use of 1px solid `#cccccc` borders to separate sections. 
- Use **Surface Hierarchy** to define boundaries. A `surface_container_low` section sitting on a `surface` background creates a clear, sophisticated break.
- **The Glass & Gradient Rule:** For floating modals or "sticky" table headers, use `surface_container_lowest` with a 15% opacity and a `20px` backdrop-blur. This "Frosted Glass" effect ensures the user never loses context of the data underneath.

---

## 3. Typography: The Editorial Voice
We utilize a dual-font strategy to balance character and readability.

- **Display & Headlines (Manrope):** A geometric sans-serif that provides a modern, architectural feel for high-level dashboard metrics.
- **Body & Data (Inter/Pretendard):** Chosen for its exceptional legibility in Korean (Hangul) characters and its optimized **Tabular Figures**. 
    - *Note:* All numeric data in tables **must** use `font-variant-numeric: tabular-nums` to ensure columns of figures align perfectly for visual scanning.

**Hierarchy Strategy:**
- **Title-LG (`1.375rem`):** Reserved for page headers.
- **Label-MD (`0.75rem`):** Used for table headers and metadata. High-density environments require smaller, all-caps (for English) or medium-weight (for Korean) labels to maximize data visibility.

---

## 4. Elevation & Depth: Tonal Layering
Traditional drop shadows are too "heavy" for a dense financial tool. We use **Ambient Depth**.

- **The Layering Principle:**
    1. Base: `surface`
    2. Content Sections: `surface_container_low`
    3. Active Cards/Inputs: `surface_container_lowest` (White)
- **Ambient Shadows:** Only use shadows on floating elements (modals, tooltips). Use `on_surface` at 4% alpha with a `32px` blur and `8px` Y-offset.
- **The "Ghost Border":** For form inputs or secondary buttons, use `outline_variant` at **20% opacity**. It should be felt, not seen.

---

## 5. Components: Engineered for Density

### Tables (The Core Engine)
- **Structure:** No vertical lines. Use `surface_container_highest` for the sticky header.
- **Row States:** Hover state uses `surface_container_low`. Selected state uses a subtle `primary_fixed_dim` (10% opacity) left-edge accent (4px).
- **Cell Padding:** Use Spacing Scale `2` (0.4rem) for vertical and `4` (0.9rem) for horizontal to maintain high density without text touching.

### Form Controls (Financial Precision)
- **Input Fields:** Use a "Filled" style with `surface_container_high`. The bottom border is a 2px `outline_variant` that transitions to `primary` on focus.
- **Multi-step Forms:** Use a vertical "Progress Rail" on the left using the Spacing Scale `8` (1.75rem) gutter.

### Status Badges
- High-contrast text on low-contrast backgrounds.
- **Active:** `tertiary_container` background with `on_tertiary_fixed_variant` text.
- **Development:** `secondary_container` background with `on_secondary_container` text.

### Advanced Data Cards
For summaries, use "Integrated Gradients." A subtle linear gradient from `primary` to `primary_container` (at a 135-degree angle) for top-level portfolio totals creates a "Premium/Expert" feel.

---

## 6. Spacing Scale: The 0.2rem Grid
This system uses a custom `0.2rem` (approx 3.2px) base unit to allow for the extreme precision required in Korean finance UI.

- **Compact Layouts:** Use `spacing.2` (0.4rem) for internal component padding.
- **Section Spacing:** Use `spacing.10` (2.25rem) to separate major data blocks.
- **Asymmetry:** Encourage "Editorial Offsets." For example, a sidebar navigation can have a wider right margin (`spacing.12`) than its left margin to create a sense of forward motion.

---

## 7. Do's and Don'ts

| Do | Don't |
| :--- | :--- |
| **Do:** Use background tonal shifts (`surface_container`) to separate data groups. | **Don't:** Use 1px black or gray borders to create "boxes." |
| **Do:** Use **Tabular Figures** for all currency and percentage values. | **Don't:** Use proportional spacing for numbers; it breaks vertical scanning. |
| **Do:** Use `0.25rem` (4px) border radius for a professional, "sharp" look. | **Don't:** Use "Pill" shapes or large radii (`>12px`) which feel too consumer-grade. |
| **Do:** Provide high-contrast "Success" indicators for financial accuracy. | **Don't:** Use "Soft Blue" for success; in finance, green is the color of truth. |
| **Do:** Allow data to breathe using vertical whitespace (`spacing.6+`). | **Don't:** Cram text into small containers just to save space; prioritize readability. |