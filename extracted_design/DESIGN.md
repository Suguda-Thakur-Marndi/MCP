---
name: The Control Room
colors:
  surface: '#111317'
  surface-dim: '#111317'
  surface-bright: '#37393e'
  surface-container-lowest: '#0c0e12'
  surface-container-low: '#1a1c20'
  surface-container: '#1e2024'
  surface-container-high: '#282a2e'
  surface-container-highest: '#333539'
  on-surface: '#e2e2e8'
  on-surface-variant: '#b9cbb9'
  inverse-surface: '#e2e2e8'
  inverse-on-surface: '#2f3035'
  outline: '#849585'
  outline-variant: '#3b4b3d'
  surface-tint: '#00e478'
  primary: '#f1ffef'
  on-primary: '#003919'
  primary-container: '#00ff87'
  on-primary-container: '#007138'
  inverse-primary: '#006d36'
  secondary: '#bdf4ff'
  on-secondary: '#00363d'
  secondary-container: '#00e3fd'
  on-secondary-container: '#00616d'
  tertiary: '#fffaf8'
  on-tertiary: '#472a00'
  tertiary-container: '#ffd8ad'
  on-tertiary-container: '#8a5700'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#60ff98'
  primary-fixed-dim: '#00e478'
  on-primary-fixed: '#00210c'
  on-primary-fixed-variant: '#005227'
  secondary-fixed: '#9cf0ff'
  secondary-fixed-dim: '#00daf3'
  on-secondary-fixed: '#001f24'
  on-secondary-fixed-variant: '#004f58'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#111317'
  on-background: '#e2e2e8'
  surface-variant: '#333539'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: 0em
  body-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.01em
  code-md:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: -0.01em
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0em
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.08em
  telemetry-num:
    fontFamily: JetBrains Mono
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: -0.02em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 0.75rem
  gutter-md: 1rem
  gutter-lg: 1.25rem
  margin: 1rem
  margin-md: 1.5rem
  margin-lg: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

The design system embodies the high-stakes precision of an aerospace mission operations center, advanced network operations center (NOC), and industrial telemetry console, specifically engineered for mission-critical AI agent governance. The interface serves security directors, AI infrastructure engineers, and governance teams who must supervise autonomous tool execution, token usage, latency boundaries, and permission sandboxes in real time.

The visual style is characterized as **Tactical Instrumentalism**:
- Pure functional density: Every pixel, border, and status emission conveys state, provenance, or telemetry.
- Zero decorative noise: Absence of playful curves, organic blobs, frosted glass blurs, or expressive drop shadows.
- Calibrated luminous hierarchy: The base environment sits in deep, light-absorbing graphite so that sparse, signal-rich luminescent indicators (electric lime, cool cyan, telemetry amber, crisp kill-switch red) command immediate optical attention.
- Engineering precision: Tight tolerances, micro-borders, strict tabular data alignment, and structural grid dividers that feel machined rather than illustrated.

## Colors

The palette operates on a strict functional luminescent tiering against non-reflective dark carbon surfaces.

### Surface Tiers
- **Void Canvas (`#0B0D11`)**: Deepest background for the application shell, canvas, and main workspace backdrop.
- **Base Surface (`#0E1217`)**: Primary panel, card base, and data deck surface.
- **Elevated Charcoal (`#141922`)**: Hover states, active tool trays, docked modules, and nested terminal logs.
- **Overlay Charcoal (`#1C2331`)**: Contextual overlays, modal inspector drawers, popovers, and elevated controls.

### Structure & Boundaries
- **Base Grid Boundary (`#1E2736`)**: Default structural hairline dividers and passive container borders.
- **Active Structural Border (`#252F40`)**: Interactive element borders, focused cells, and module frames.

### Typographic Luminescence
- **High-Read Off-White (`#E6EDF3`)**: Primary telemetry values, critical labels, and active status readouts.
- **Telemetry Slate (`#8B949E`)**: Secondary labels, system descriptors, table headers, and structural metadata.
- **Muted Wireframe Slate (`#57606A`)**: Inactive metrics, passive units, grid indicators, and disabled affordances.

### Signal & Alert Spectrum
- **Electric Lime (`#00FF87` / `#10B981`)**: Primary signal. Designates verified active state, streaming telemetry, trusted MCP gateways, zero-violation logs, and affirmative governance actions.
- **Cool Cyan (`#00E5FF` / `#38BDF8`)**: Secondary signal. Designates packet transit, socket routing, payload inspection, API endpoints, and dynamic memory footprints.
- **Cautionary Amber (`#F59E0B`)**: Intermediary state. Denotes permission scope escalation, rate-limit thresholds, schema drift, and pending operator approval.
- **Critical Red (`#EF4444`)**: Emergency tier. Signifies autonomous policy breaches, blocked calls, circuit breakers tripped, and operator abort commands.

## Typography

The type ecosystem relies on a symbiotic relationship between an unyielding geometric sans-serif for spatial scanning and an exacting tabular monospace for rigorous data parsing.

### Dual-Font Structure
- **Inter (Prose, Structural Framing, Headings)**: Delivers neutral, uncompromising structural legibility at every scale. Used for system navigation, operational panel headings, contextual tool descriptions, and executive summaries.
- **JetBrains Mono (Telemetry, Identity, Governance Tokens)**: Serves as the first-class data font. Mandatory for all agent run IDs, protocol verbs (`GET`, `MCP_CALL`, `AUTH`), tool payload dumps, memory allocation, epoch timestamps, risk probability scores, and tabular column data.

### Formatting Rules
- All `label-caps` tokens must render in `text-transform: uppercase` with wide tracking (`0.08em`) to mimic aerospace cockpit annunciators.
- All numbers within telemetry, tables, and metric cards must enable tabular numbers (`font-variant-numeric: tabular-nums lining-nums`) to prevent optical shifting during live streaming updates.

## Layout & Spacing

The system implements a rigid, space-efficient fluid grid model designed for dense multi-monitor consoles and high-density operator dashboards.

### Grid Rhythm & Model
- The layout is composed of a continuous 24-column micro-grid or 12-column standard modular grid that dynamically snaps panes into docked bays.
- Gutters are compressed to a baseline of `0.75rem` (12px) to maximize screen real estate, expanding to `1rem` on widescreen NOC monitors (`1920px+`).
- Vertical rhythm strictly adheres to a 4px sub-grid with primary jumps of 8px (`0.5rem`), 12px (`0.75rem`), and 16px (`1rem`).

### Responsive Reflow Strategy
- **Desktop / Multi-Monitor (1440px+)**: Multi-pane layout. Navigation docked left (64px icon rail or 240px tree view), primary telemetry center bay (spanning 16 columns), real-time inspector and intervention console docked right (8 columns).
- **Tablet / Split Console (768px - 1439px)**: Inspector drawer collapses into a push-over side deck. Secondary metric feeds collapse into tabbed matrices.
- **Mobile Handheld (Below 768px)**: Reflows into a single-column operational feed. Tool executions and network maps transition into vertical step-traces with bottom-sheet drawer inspections.

## Elevation & Depth

Visual hierarchy within this system does not rely on ambient diffused blur shadows or multi-layered lighting physics. Depth is engineered strictly via **Tonal Surface Stacking** coupled with **Precision Micro-Borders**.

### Surface Elevation Hierarchy
- **Canvas (`#0B0D11`)**: Base ground plane.
- **Docked Panels (`#0E1217`)**: Separated from Canvas solely by a 1px border of `#1E2736`.
- **Active Sub-panels & Inspect Deck (`#141922`)**: Nested within panels, bound by 1px border of `#252F40`.
- **Modals, Flyouts, & Drawers (`#1C2331`)**: The only floating layers. They reject diffused shadows in favor of a 1px perimeter stroke (`#252F40`) and an internal 1px highlight stroke (`rgba(255, 255, 255, 0.04)`), paired with a stark, non-blurred 8px black offset rim (`rgba(0, 0, 0, 0.75)`).

### Luminescent State Elevation
When an element demands interactive priority or signals alert status:
- Active state is conveyed through border ionization: 1px outline switches to `rgba(0, 255, 135, 0.6)` or `rgba(0, 229, 255, 0.6)`.
- Critical alert state uses a crisp border of `rgba(239, 68, 68, 0.9)` paired with a subtle, non-diffused inner glow (`box-shadow: inset 0 0 0 1px #EF4444`).

## Shapes

The geometric signature is grounded in mechanical tolerance and precision instrumentation.

- **Standard Elements (Buttons, Inputs, Badges, Tabs)**: Fixed at `2px` border radius (`rounded-sm`). This provides just enough curvature to eliminate digital harshness while preserving an industrial feel.
- **Structural Containers (Panels, Deck Trays, Modal Windows)**: Fixed at `4px` border radius (`rounded-md`).
- **Pill shapes (`rounded-full`) are strictly forbidden** across all cards, containers, buttons, and chips. The only acceptable circular elements are 6px or 8px live status ping indicators and operator profile avatars.
- Cut-corners / Chamfered edges (2px 45-degree angled notches) may be used on top-right corners of tactical cards to reinforce mission-control styling.

## Components

### Buttons & Interactive Triggers
- **Primary / Active Action**: Background `#00FF87`, text `#0B0D11`, font `JetBrains Mono`, weight `600`, radius `2px`. Hover shifts to `#10B981`. Focus shows `2px` offset outline in `#00FF87`.
- **Secondary / Data Trigger**: Background `#141922`, border `1px solid #252F40`, text `#E6EDF3`. Hover elevates border to `#00E5FF` with text color shift.
- **Critical / Intercept Trigger (Emergency Stop / Revoke)**: Background `rgba(239, 68, 68, 0.1)`, border `1px solid #EF4444`, text `#EF4444`. Hover fills with `#EF4444` and flips text to `#FFFFFF`.

### Telemetry Badges & Status Chips
- Height: Fixed `20px` or `24px`. Radius: `2px`.
- Layout: Monospace `label-caps` text accompanied by an optional `6px` solid status bead.
- Variants:
  - *Nominal*: Border `1px solid rgba(0, 255, 135, 0.3)`, background `rgba(0, 255, 135, 0.08)`, text `#00FF87`.
  - *Transit/Routing*: Border `1px solid rgba(0, 229, 255, 0.3)`, background `rgba(0, 229, 255, 0.08)`, text `#00E5FF`.
  - *Intervention*: Border `1px solid rgba(245, 158, 11, 0.3)`, background `rgba(245, 158, 11, 0.08)`, text `#F59E0B`.
  - *Quarantined*: Border `1px solid rgba(239, 68, 68, 0.3)`, background `rgba(239, 68, 68, 0.08)`, text `#EF4444`.

### Tables & Live Data Streams
- Compact row height (`32px` for dense views, `40px` for standard inspection).
- Table headers: Uppercase `JetBrains Mono` (`label-caps`), color `#8B949E`, background `#0E1217`, bottom border `1px solid #252F40`.
- Cells: Bottom border `1px solid #1E2736`. Hover state highlights full row in `#141922` with a `2px` left border marker in `#00FF87`.
- Tabular numeric alignment: Always right-aligned for latencies, token counts, and risk scores.

### Input Fields & Parameter Controls
- Background `#0E1217`, border `1px solid #252F40`, radius `2px`, typography `JetBrains Mono` (`code-md`), text `#E6EDF3`.
- Placeholder color: `#57606A`.
- Active focus state: Border switches immediately to `#00E5FF`, zero blur glow. Optional terminal-style vertical bar cursor.

### Toggles, Checkboxes, & Radios
- **Checkboxes**: `14px x 14px` square, `2px` radius. Unchecked has `#141922` surface and `#252F40` border. Checked renders solid `#00FF87` fill with dark checkmark.
- **Switches**: Rectangular slider housing (no pill curves). Frame `32px x 18px`, radius `2px`. Toggle thumb is a crisp `12px x 12px` square moving between states. Active track: `rgba(0, 255, 135, 0.2)` with `#00FF87` thumb.

### Instrument Cards & Deck Panels
- Background `#0E1217`, border `1px solid #1E2736`, radius `4px`.
- Card Header: `32px` height bar with top/bottom hairline borders, housing metric name (`label-caps`), active state indicator, and quick-action icon buttons.
- Content zone padding: `space-md` (`0.75rem`).

### Specialized Domain Components
- **Agent Execution Trace Node**: Step-by-step telemetry card with tool call signature, parent run ID in monospace, latency counter (`ms`), and authorization badge.
- **Circuit Breaker Kill Switch**: Guarded button component requiring slide-to-confirm or dual-action hold to immediately sever agent API privileges.
- **Latency Sparkline Strip**: Canvas/SVG continuous line chart with `#00E5FF` 1px trace and zero fill under the curve.