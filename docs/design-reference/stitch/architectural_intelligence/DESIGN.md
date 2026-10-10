---
name: Architectural Intelligence
colors:
  surface: '#f8f9fc'
  surface-dim: '#d8dadd'
  surface-bright: '#f8f9fc'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e7e8eb'
  surface-container-highest: '#e1e2e5'
  on-surface: '#191c1e'
  on-surface-variant: '#58423c'
  inverse-surface: '#2e3133'
  inverse-on-surface: '#eff1f3'
  outline: '#8b716a'
  outline-variant: '#dfc0b7'
  surface-tint: '#a73918'
  primary: '#a43716'
  on-primary: '#ffffff'
  primary-container: '#c54f2c'
  on-primary-container: '#fffbff'
  inverse-primary: '#ffb5a0'
  secondary: '#0f6a65'
  on-secondary: '#ffffff'
  secondary-container: '#a1eee7'
  on-secondary-container: '#176e69'
  tertiary: '#a83132'
  on-tertiary: '#ffffff'
  tertiary-container: '#c94947'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbd1'
  primary-fixed-dim: '#ffb5a0'
  on-primary-fixed: '#3b0900'
  on-primary-fixed-variant: '#862201'
  secondary-fixed: '#a3f0ea'
  secondary-fixed-dim: '#87d4ce'
  on-secondary-fixed: '#00201e'
  on-secondary-fixed-variant: '#00504c'
  tertiary-fixed: '#ffdad7'
  tertiary-fixed-dim: '#ffb3ae'
  on-tertiary-fixed: '#410005'
  on-tertiary-fixed-variant: '#8a1a1f'
  background: '#f8f9fc'
  on-background: '#191c1e'
  surface-variant: '#e1e2e5'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 2.25rem
    fontWeight: '600'
    lineHeight: 2.75rem
    letterSpacing: -0.025em
  headline-lg:
    fontFamily: Inter
    fontSize: 1.75rem
    fontWeight: '600'
    lineHeight: 2.25rem
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 1.25rem
    fontWeight: '600'
    lineHeight: 1.75rem
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: '600'
    lineHeight: 1.5rem
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: '400'
    lineHeight: 1.6rem
  body-md:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: 1.375rem
  body-sm:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: '400'
    lineHeight: 1.125rem
  code-lg:
    fontFamily: JetBrains Mono
    fontSize: 0.875rem
    fontWeight: '500'
    lineHeight: 1.375rem
  code-md:
    fontFamily: JetBrains Mono
    fontSize: 0.75rem
    fontWeight: '400'
    lineHeight: 1.25rem
  label-mono:
    fontFamily: JetBrains Mono
    fontSize: 0.6875rem
    fontWeight: '500'
    lineHeight: 0.875rem
    letterSpacing: 0.04em
  label-ui:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: '500'
    lineHeight: 1rem
    letterSpacing: 0.01em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-lg: 1.5rem
  margin: 1rem
  margin-md: 1.5rem
  margin-lg: 2rem
  space-2xs: 0.125rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
  space-2xl: 2rem
  space-3xl: 3rem
---

## Brand & Style

This design system embodies the ethos of mission-critical engineering, architectural permanence, and cryptographic precision. Built for enterprise security engineers, DevSecOps leaders, and AI safety auditors, it moves intentionally away from generic cyber-clichés, neon glows, and dark "hacker-terminal" palettes. Instead, it grounds the operational environment in the calm, tactile clarity of structural engineering drawings and precision industrial control systems.

The aesthetic blends **Modern Technical Structuralism** with **Swiss Typographic Rigor**:
- **Clarity over Drama:** High contrast delivered through deep graphites on stone-ivory foundations rather than saturated luminescence.
- **Architectural Permanence:** Structural 1px hairline borders that define functional boundaries cleanly, echoing physical blueprint drafted schematics.
- **Subdued Urgency:** Intentional, measured warnings using burnt orange and disciplined crimson, reserving visual weight strictly for security vectors requiring active intervention.
- **Engineered Density:** Compact, information-rich viewports configured for fast human parsing of complex Model Context Protocol (MCP) tool calls, payloads, runtime permissions, and telemetry logs.

## Colors

The palette establishes an authoritative, daylight-balanced workspace designed for extended operational focus without cognitive fatigue.

### Color Tokens & Semantic Roles
- **Canvas & Backgrounds:**
  - `bg-canvas-base`: `#FBFBFA` (Primary page backdrop; natural warm ivory).
  - `bg-canvas-subtle`: `#F6F5F2` (Secondary backdrop, toolbars, sidebar panels).
  - `bg-canvas-sunken`: `#EFECE6` (Code blocks, parameter diffing zones, telemetry trays).
- **Surfaces & Cards:**
  - `surface-elevated`: `#FFFFFF` (Inspector panels, modal dialogs, data table cells).
  - `surface-hover`: `#FAF9F7` (Interactive item hovered state).
- **Structural Borders:**
  - `border-hairline`: `#E5E2DC` (Default container dividing lines, table rules).
  - `border-strong`: `#DCD8D0` (Active tab lines, card boundaries, input controls).
- **Text & Foreground:**
  - `text-primary`: `#191C1E` (Dominant headers, active values, cryptographic hashes).
  - `text-secondary`: `#2B2F32` (Standard body text, column titles).
  - `text-muted`: `#5F656B` (Timestamps, protocol metadata, inactive tabs).
  - `text-subtle`: `#888E96` (Watermarks, keyboard shortcuts, disabled labels).
- **Brand & Intent Accent (Burnt Orange):**
  - `accent-primary`: `#D95D39` (Approval prompts, primary system actions, focused input triggers).
  - `accent-primary-hover`: `#C44E2B` (Pressed/hover primary interactions).
  - `accent-primary-subtle`: `#FDF2EE` (Tinted highlight rows, pending approval badges).
- **Verified & Telemetry Accent (Deep Sage / Teal):**
  - `accent-teal`: `#2A7B76` (Passed validations, verified tools, active daemon heartbeats).
  - `accent-teal-hover`: `#1F605C` (Pressed state for secondary actions).
  - `accent-teal-subtle`: `#EEF6F5` (Container background for safe MCP sessions).
- **Security & Severity Spectrum:**
  - `status-critical`: `#B33939` / Soft surface: `#FAECEC` (Malicious injections, access revocations).
  - `status-medium`: `#D97706` / Soft surface: `#FEF7EC` (Privilege escalations, external model egress).
  - `status-verified`: `#2A7B76` / Soft surface: `#EEF6F5` (Signed tools, deterministic schemas).
  - `status-info`: `#4B5563` / Soft surface: `#F3F4F6` (Schema inspections, inert context syncs).

## Typography

The type system separates natural language policy evaluation from technical infrastructure primitives.

- **Primary Stack (Inter):** Deployed across all navigation, structural headers, audit descriptions, and human-readable analysis. Headings use medium-to-semibold weights with negative letter-spacing for dense, architectural clarity.
- **Monospace Stack (JetBrains Mono):** Mandated for payload schemas, tool arguments, MCP server endpoints, SHA-256 hashes, timestamps, and security tags.
- **Numbers & Metrics:** Tabular figures (`tnum`, `zero`) must be enforced across all telemetry meters, latency metrics, and data tables to preserve baseline alignment in tabular layouts.

## Layout & Spacing

The layout is built around a compact, data-first workspace optimized for multi-pane inspection.

### Architecture & Layout Philosophy
- **Master Grid:** 12-column adaptive layout on desktop (`1440px+`) with fixed `240px` (expandable to `320px` or collapsible to `64px` icon-only) left architectural navigation panel.
- **Split Workspace:** Dual-column or master-detail split (60% event feed / 40% inspector tray) with explicit border lines rather than floating gutters.
- **Density Profile:** Compact 8-point baseline grid with half-step (`4px`) alignment for micro-elements, data grid cells, and mono metadata tags.
- **Reflow Logic:**
  - **Desktop (`>= 1280px`):** Fixed left navigation, fluid event workspace, collateral sliding inspector drawer.
  - **Tablet (`768px - 1279px`):** Collapsible sidebar rail (`64px`), stacked payload inspector.
  - **Mobile (`< 768px`):** Off-canvas navigation, single-column stacked telemetry cards, prioritized single-touch approvals.

## Elevation & Depth

Visual hierarchy relies on structural planes and hairline containment rather than dramatic illumination or layered drops.

### Elevation Levels
1. **Level 0 (Basebed):** `#FBFBFA` canvas background. No shadow, raw stone texture appearance.
2. **Level 1 (Structural Cards & Panes):** `#FFFFFF` surfaces bounded by a crisp `1px solid #E5E2DC` border.
   - *Shadow:* `0 1px 2px 0 rgba(25, 28, 30, 0.03)`
3. **Level 2 (Popovers, Select Menus, Flyouts):**
   - *Border:* `1px solid #DCD8D0`
   - *Shadow:* `0 4px 12px 0 rgba(25, 28, 30, 0.05), 0 1px 3px 0 rgba(25, 28, 30, 0.02)`
4. **Level 3 (Modal Dialogs, High-Risk Interventions):**
   - *Overlay Backdrop:* `rgba(25, 28, 30, 0.35)` with an ultra-light `2px` backdrop-filter blur.
   - *Border:* `1px solid #DCD8D0`
   - *Shadow:* `0 12px 28px -4px rgba(25, 28, 30, 0.12), 0 2px 6px -1px rgba(25, 28, 30, 0.04)`

### Boundary Strategy
Shadows must never serve as the sole differentiator between adjacent planes. Every elevated element must carry a deliberate 1px structural hairline border.

## Shapes

The design system maintains a **Soft-Chiseled** structural language (`roundedness: 1`), conveying structural integrity and industrial utility.

- **Standard Inputs, Badges, Buttons:** `4px` (`0.25rem`) corner radius.
- **Cards, Code Containers, Flyouts:** `6px` or `8px` (`0.5rem`) corner radius maximum.
- **Pills / Status Dots:** Strict circles (`50%` radius) reserved only for binary server state indicators (e.g., active telemetry nodes). Badges, tags, and chips remain squared with a subtle `3px` or `4px` radius to maintain a non-playful, technical aesthetic.

## Components

### Buttons
- **Primary (Approval / Execution):** Solid `#D95D39` fill, `#FFFFFF` text, `4px` radius. Hover: `#C44E2B`. Focus: `2px` outline in `#D95D39` offset by `2px`.
- **Secondary (Inspect / Configuration):** `#FFFFFF` background, `1px solid #DCD8D0`, `#191C1E` text. Hover: `#F6F5F2`.
- **Tertiary / Ghost:** Transparent background, `#5F656B` text. Hover: `#EFECE6`, `#191C1E` text.
- **Danger (Revoke / Block):** `#B33939` text, `1px solid #B33939` border, transparent background. Active/Hover: `#FAECEC`.

### Risk & Severity Badges
- **Form Factor:** Compact, monospace uppercase typography (`label-mono`), `3px` radius, padding `2px 6px`, `1px` border matching the token family.
- **Critical:** `#B33939` text, `#FAECEC` fill, `#F3D1D1` border.
- **Medium:** `#D97706` text, `#FEF7EC` fill, `#FCE2B6` border.
- **Low / Verified:** `#2A7B76` text, `#EEF6F5` fill, `#C5E3E1` border.
- **Info:** `#4B5563` text, `#F3F4F6` fill, `#E5E7EB` border.

### Input Fields & Controls
- **Text & Search:** `#FFFFFF` background, `1px solid #DCD8D0`, `4px` radius, font size `0.875rem`. Placeholder in `#888E96`. Active focus ring: `1px solid #D95D39` with `0 0 0 1px #D95D39`.
- **Checkboxes & Radios:** `14px x 14px` square bounds, `2px` radius. Active state: `#D95D39` background with crisp white check mark icon. Inactive: `1px solid #DCD8D0` on `#FFFFFF`.

### Data Tables (High-Density Audit Trail)
- **Cell Structure:** Fixed vertical height (`36px` compact, `44px` default), `padding: 0 12px`.
- **Table Head:** `#F6F5F2` background, `1px solid #E5E2DC` bottom border, `label-mono` uppercase headers with `#5F656B` color.
- **Table Row:** Alternating subtle row zebra striping optional; standard is `#FFFFFF` with `#FBFBFA` on hover. Dividing bottom hairline `1px solid #E5E2DC`.

### Payload & Code Blocks (MCP Inspection)
- Built on `#EFECE6` with `1px solid #E5E2DC` boundary, `4px` radius.
- Code rendered in `JetBrains Mono` (`code-md`), line-numbered, using muted semantic syntax highlighting (strings in desaturated sage `#2A7B76`, keys in deep graphite `#191C1E`, warnings in burnt orange `#D95D39`).
- Embedded one-click copy button positioned top-right with persistent hairline border.