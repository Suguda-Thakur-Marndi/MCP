---
name: Precision Intelligence
colors:
  surface: '#f8f9fd'
  surface-dim: '#d8dade'
  surface-bright: '#f8f9fd'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3f7'
  surface-container: '#eceef2'
  surface-container-high: '#e7e8ec'
  surface-container-highest: '#e1e2e6'
  on-surface: '#191c1f'
  on-surface-variant: '#594139'
  inverse-surface: '#2e3134'
  inverse-on-surface: '#eff1f5'
  outline: '#8d7168'
  outline-variant: '#e1bfb5'
  surface-tint: '#ab3600'
  primary: '#a73400'
  on-primary: '#ffffff'
  primary-container: '#cb4914'
  on-primary-container: '#fffbff'
  inverse-primary: '#ffb59c'
  secondary: '#006970'
  on-secondary: '#ffffff'
  secondary-container: '#9df0f9'
  on-secondary-container: '#016f77'
  tertiary: '#8d4b00'
  on-tertiary: '#ffffff'
  tertiary-container: '#b15f00'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbcf'
  primary-fixed-dim: '#ffb59c'
  on-primary-fixed: '#390c00'
  on-primary-fixed-variant: '#822700'
  secondary-fixed: '#9df0f9'
  secondary-fixed-dim: '#81d3dc'
  on-secondary-fixed: '#002022'
  on-secondary-fixed-variant: '#004f55'
  tertiary-fixed: '#ffdcc3'
  tertiary-fixed-dim: '#ffb77d'
  on-tertiary-fixed: '#2f1500'
  on-tertiary-fixed-variant: '#6e3900'
  background: '#f8f9fd'
  on-background: '#191c1f'
  surface-variant: '#e1e2e6'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 2rem
    fontWeight: '600'
    lineHeight: 2.5rem
    letterSpacing: -0.025em
  headline-xl-mobile:
    fontFamily: Inter
    fontSize: 1.5rem
    fontWeight: '600'
    lineHeight: 2rem
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 1.5rem
    fontWeight: '600'
    lineHeight: 2rem
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 1.125rem
    fontWeight: '600'
    lineHeight: 1.5rem
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: '600'
    lineHeight: 1.25rem
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: '400'
    lineHeight: 1.5rem
    letterSpacing: -0.011em
  body-md:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: 1.375rem
    letterSpacing: -0.006em
  body-sm:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: '400'
    lineHeight: 1.125rem
    letterSpacing: 0em
  code-lg:
    fontFamily: JetBrains Mono
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: 1.375rem
    letterSpacing: -0.01em
  code-md:
    fontFamily: JetBrains Mono
    fontSize: 0.75rem
    fontWeight: '400'
    lineHeight: 1.125rem
    letterSpacing: -0.005em
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 0.6875rem
    fontWeight: '500'
    lineHeight: 1rem
    letterSpacing: 0.02em
  label-md:
    fontFamily: Inter
    fontSize: 0.8125rem
    fontWeight: '500'
    lineHeight: 1.125rem
    letterSpacing: -0.005em
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 0.6875rem
    fontWeight: '600'
    lineHeight: 0.875rem
    letterSpacing: 0.06em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 2rem
  space-xxs: 0.125rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
  space-2xl: 2rem
  space-3xl: 3rem
---

## Brand & Style

This design system establishes an authoritative, high-integrity visual language for mission-critical AI security, protocol governance, and automated risk approval. Engineered specifically for security operations centers (SOC), enterprise architects, and compliance officers, it deliberately rejects the tropes of generic artificial intelligence tooling—eschewing synthetic violet gradients, glowing wireframes, and dark-mode cyberpunk neon. 

Instead, the aesthetic draws inspiration from swiss technical journals, financial risk terminals, and archival registry systems. It balances dense tabular data with quiet visual luxury: warm ivory foundations, tactile borders, graphite-ink typographic contrast, and deliberate burnt-orange accents reserved for critical decisions and irreversible signatures. The interface feels steady, unhurried, and legally binding—instilling operational clarity and absolute control under pressure.

## Colors

The palette is anchored by warm, paper-adjacent mineral surfaces rather than cold synthetic whites, reducing ocular strain during prolonged monitoring sessions:

- **Foundation & Surfaces:**
  - `canvas-default`: `#F9F8F6` (Warm Ivory primary background)
  - `canvas-subtle`: `#F5F4F0` (Recessed canvas, outer gutters, and split-panel rails)
  - `surface-card`: `#FFFFFF` (Pure flat white for elevated operational cards and inspect dialogs)
  - `surface-container-muted`: `#F0EEE9` (Header bars, table headers, inactive tabs, and telemetry wells)
  - `border-subtle`: `#E5E2DC` (Single-pixel hairline rule for structural boundaries)
  - `border-focus`: `#1E2124` (High-contrast graphite outline for active focus rings)

- **Typography & Ink:**
  - `text-primary`: `#1E2124` (Graphite ink for titles, numeric values, and primary actions)
  - `text-secondary`: `#5C6166` (Muted charcoal for field labels, timestamps, and secondary descriptors)
  - `text-tertiary`: `#8A9096` (Micro metadata, protocol paths, and auxiliary state)

- **Semantic & Intent Roles:**
  - `accent-primary` (`#D9531E`) & `accent-hover` (`#C24413`): Burnt Orange. Exclusively reserved for primary system commitments, manual security approvals, override signatures, and active execution triggers.
  - `semantic-trusted` (`#1B7A82`) & `semantic-trusted-deep` (`#146167`): Desaturated Teal. Used for verified model payloads, cryptographically signed tools, and pass states.
  - `semantic-warning` (`#D97706`) & `semantic-warning-deep` (`#B45309`): Amber. Signifies pending approvals, heuristic drift, rate anomalies, and unvetted MCP connections.
  - `semantic-critical` (`#C53030`) & `semantic-critical-deep` (`#9B2C2C`): Muted Crimson. Applied to prompt injection blocks, capability revocations, and hard access blocks.
  - `semantic-code` (`#2D3748`): Dark Slate. Dedicated to schema keys, trace signatures, tokens, and raw protocol exchange logs.

## Typography

The typography architecture uses a disciplined dual-typeface pairing:

1. **System UI (`Inter`):** Applied across core application interfaces, navigation, modals, and narrative audit copy. Tight negative letter-spacing (`-0.01em` to `-0.025em`) ensures an editorial, high-density cadence suited for enterprise software.
2. **Technical Telemetry (`JetBrains Mono`):** Applied systematically to all operational data artifacts—trace hashes, Model Context Protocol (MCP) tool schema definitions, latency figures (ms), status labels, IP endpoints, and memory limits.

Typographic hierarchy prioritizes tabular alignment over ornamentation. Numerical and monospace tokens always utilize proportional or tabular lining numbers (`font-variant-numeric: tabular-nums`) to preserve optical column gutters across dense log feeds.

## Layout & Spacing

Layout adheres to a precise, data-dense split-pane architecture optimized for wide displays and multi-window monitoring:

- **Desktop (>= 1280px):** Fixed left navigation rail (`240px` or collapsed `56px`), fluid multi-column operational grid (`12-column`, `1.5rem` gutter), and optional right-hand collapsible Inspector Drawer (`380px` to `480px` fixed).
- **Tablet (768px - 1279px):** 8-column layout, `1rem` gutter. Inspector drawer docks into a floating slide-over sheet or secondary tab pane.
- **Mobile (< 768px):** Single-column stacked stream, collapsible filter sheets, horizontal scroll locks for complex schema matrices. Outer screen margins reduce to `1rem`.

Component spacing follows a micro 4px/8px incremental rhythm (`space-xxs` to `space-3xl`), optimizing row density in audit logs while preserving clear structural breathing room between primary analytical panels.

## Elevation & Depth

This design system rejects heavy drop shadows, neon glows, and excessive glassmorphic blurs in favor of structural grid boundaries and tonal layering:

1. **The Structural Hairline:** Spatial separation is established primarily through 1px border lines in `#E5E2DC`. Cards, sidebars, and control toolbars are defined by sharp borders rather than volumetric shadow.
2. **Tonal Planar Stacking:**
   - Level 0 (Base Canvas): `#F9F8F6` / `#F5F4F0`
   - Level 1 (Working Surface / Card / Table Row): `#FFFFFF` bordered by `#E5E2DC`
   - Level 2 (Sub-Surface / Header Bar / Code Well): `#F0EEE9` inset inside Level 1
   - Level 3 (Floating Inspectors & Command Palettes): `#FFFFFF` featuring a crisp, restrained dual shadow (`0 1px 3px 0 rgba(30, 33, 36, 0.05), 0 8px 24px -4px rgba(30, 33, 36, 0.08)`) and border `#D8D4CC`.
3. **Data Grid Planarity:** Tables and log traces intentionally operate at shadow-none (`box-shadow: none`), using thin border dividers (`#E5E2DC`) and alternating hover fills (`#F5F4F0`) to ensure frictionless scanning of thousands of log entries without visual interference.

## Shapes

The shape system employs an intentionally compact, technical corner radius (`roundedness: 1` — base radius of `4px` / `0.25rem`). This provides crisp, instrument-grade contours suited for high-density tools:

- **Base Radius (`4px` / `0.25rem`):** Buttons, text inputs, table row action triggers, status chips, code chips, and notification toasts.
- **Large Radius (`8px` / `0.5rem`):** Analytical dashboard cards, approval inspector panels, and modal containers.
- **Full Radius (Pill):** Strictly reserved for real-time connection status indicators (e.g., active socket connection pulses and live telemetry tags) where a physical LED metaphor is required.

## Components

### Buttons
- **Primary Approval / Signature:** Background `#D9531E`, text `#FFFFFF`, border none, hover `#C24413`. Active press state shifts to `#B03B0F`. Focused with a 2px offset ring in `#1E2124`.
- **Secondary / Operational:** Background `#FFFFFF`, text `#1E2124`, border `1px solid #E5E2DC`, hover `#F5F4F0` with border `#D8D4CC`.
- **Destructive / Deny:** Background `#FFFFFF`, text `#C53030`, border `1px solid #F8D7DA`, hover `#FDF2F2` with border `#C53030`.
- **Ghost / Tool Action:** Background transparent, text `#5C6166`, hover `#F0EEE9` and text `#1E2124`. Height `28px` for compact table-row action bars.

### Badges & Status Chips
- Height `20px`, border-radius `4px`, padding `0 6px`. Typography `code-sm` uppercase.
- **Trusted / Verified:** Background `#E6F3F4`, border `1px solid #B8DFE2`, text `#146167`.
- **Pending / In Review:** Background `#FEF3C7`, border `1px solid #FDE68A`, text `#92400E`.
- **Blocked / Critical:** Background `#FEE2E2`, border `1px solid #FECACA`, text `#991B1B`.
- **Neutral / Monospace Metadata:** Background `#F0EEE9`, border `1px solid #E5E2DC`, text `#5C6166`.

### Inputs & Search Bars
- Background `#FFFFFF`, border `1px solid #E5E2DC`, text `body-md` (`#1E2124`), placeholder `#8A9096`.
- Focus state: Border `#1E2124`, ring `1px solid #1E2124` without soft blur.
- Command Palette Search: Height `44px`, leading monospace shortcut badge (`⌘K`), background `#FFFFFF`, bottom border `1px solid #E5E2DC`.

### Tables & Log Streams
- Headers: Background `#F0EEE9`, text `label-caps` (`#5C6166`), height `32px`, border-bottom `1px solid #E5E2DC`.
- Rows: Background `#FFFFFF`, hover `#F9F8F6`, border-bottom `1px solid #F0EEE9`, compact vertical padding (`8px` top/bottom).
- Monospace Data Cells: `code-md` styling for Trace IDs, Tool Name URIs (`mcp://filesystem/write`), and latency values.

### Approval Split-Inspector (Platform-Specific)
- A side-by-side or sliding drawer container dividing incoming AI agent parameter requests against organizational security policy.
- Left pane: Raw JSON / RPC Payload viewer (`#2D3748` text on `#F5F4F0` container).
- Right pane: Policy Evaluation matrix featuring high-contrast amber/teal validation badges and dual signature CTA actions ("Grant 1-Time Exec" / "Deny & Revoke Key").