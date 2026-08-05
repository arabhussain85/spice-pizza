---
name: Spice Pizza
colors:
  surface: '#fff8f7'
  surface-dim: '#f1d3d0'
  surface-bright: '#fff8f7'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fff0ef'
  surface-container: '#ffe9e7'
  surface-container-high: '#ffe2de'
  surface-container-highest: '#f9dcd9'
  on-surface: '#271816'
  on-surface-variant: '#5b403d'
  inverse-surface: '#3e2c2a'
  inverse-on-surface: '#ffedeb'
  outline: '#8f6f6c'
  outline-variant: '#e4beba'
  surface-tint: '#ba1a20'
  primary: '#af101a'
  on-primary: '#ffffff'
  primary-container: '#d32f2f'
  on-primary-container: '#fff2f0'
  inverse-primary: '#ffb3ac'
  secondary: '#605e5b'
  on-secondary: '#ffffff'
  secondary-container: '#e6e2dd'
  on-secondary-container: '#666460'
  tertiary: '#51595b'
  on-tertiary: '#ffffff'
  tertiary-container: '#6a7173'
  on-tertiary-container: '#eff6f8'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdad6'
  primary-fixed-dim: '#ffb3ac'
  on-primary-fixed: '#410003'
  on-primary-fixed-variant: '#930010'
  secondary-fixed: '#e6e2dd'
  secondary-fixed-dim: '#c9c6c1'
  on-secondary-fixed: '#1c1c19'
  on-secondary-fixed-variant: '#484743'
  tertiary-fixed: '#dde4e6'
  tertiary-fixed-dim: '#c1c8ca'
  on-tertiary-fixed: '#161d1f'
  on-tertiary-fixed-variant: '#41484a'
  background: '#fff8f7'
  on-background: '#271816'
  surface-variant: '#f9dcd9'
  status-free: '#2E7D32'
  status-occupied: '#D32F2F'
  status-pending: '#FFA000'
  charcoal-text: '#1A1A1A'
  cream-bg: '#FCF9F5'
typography:
  display-price:
    fontFamily: Hanken Grotesk
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-bold:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
  touch-target: 48px
---

## Brand & Style

The design system embodies an **Upscale-Casual** aesthetic that bridges the gap between fast-paced service and a warm, inviting dining experience. It moves away from the cold, sterile nature of typical POS systems in favor of a "Bistro-Modern" approach.

### Visual Pillars
- **Warm & Appetizing:** A base of cream and off-white prevents digital eye strain and makes food photography pop.
- **Confident & Energetic:** Using a bold, "Spice Red" as the primary driver for actions and brand identity.
- **Staff-Centric Ergonomics:** High-visibility click targets and generous spacing ensure error-free operation in high-pressure environments.
- **Tactile Softness:** Soft shadows and rounded corners create a physical, friendly feel that mimics modern consumer apps rather than legacy enterprise software.

## Colors

The palette is anchored by **Spice Red**, used strategically for primary actions and "Occupied" states to denote urgency or activity. The background uses **Cream-BG** to provide a sophisticated, warm alternative to pure white.

- **Primary (Spice Red):** Used for CTA buttons, active selection states, and occupied table indicators.
- **Secondary (Cream/Off-white):** Used for page backgrounds and card surfaces to create a layered, "paper-like" depth.
- **Neutral (Charcoal):** High-contrast text for maximum readability under varied lighting.
- **Functional States:** 
  - **Green:** Signals availability and "Live" items.
  - **Amber:** Signals "Pending" or "In-Preparation" items.

## Typography

This system uses a dual-font strategy to balance personality with high-speed utility.

- **Numbers & Prices (Hanken Grotesk):** A sharp, geometric sans-serif used for all currency and numerical data. It ensures that prices like "Rs. 5,500" are scannable from a distance.
- **Labels & UI (Plus Jakarta Sans):** A friendly, contemporary sans-serif used for menu items, categories, and general interface text.

For mobile-specific views, `headline-lg` should scale down to 24px to maintain layout integrity while preserving the bold hierarchy.

## Layout & Spacing

The design system utilizes a **Fluid Grid** with a specific focus on "Touch-Safe" zones for staff operation.

- **Desktop (Counter/Admin):** 12-column grid with wide 24px gutters. The Counter screen utilizes a fixed right-hand panel (380px) for the persistent order summary.
- **Mobile (Admin):** Single-column fluid layout with 16px side margins.
- **Rhythm:** An 8px linear scale governs all padding and margins. 
- **Touch-First:** All interactive elements (menu items, modifiers, table cards) must maintain a minimum height of 48px to accommodate fast-paced manual input.

## Elevation & Depth

Visual hierarchy is achieved through **Tonal Layering** and **Soft Ambient Shadows**.

- **Level 0 (Base):** The Cream background surface.
- **Level 1 (Cards):** Menu items and table cards. They use a subtle 1px border (#E0DCD6) and a soft, diffused shadow (10% opacity, 12px blur) to appear slightly lifted.
- **Level 2 (Modals/Popovers):** Used for item modifiers and void confirmations. These have a more pronounced shadow (15% opacity, 24px blur) to focus attention.
- **Interactive Depth:** Buttons use a slight "press" effect (reducing shadow and darkening color) to provide tactile feedback without complex skeuomorphism.

## Shapes

The shape language is consistently "Rounded" to reinforce the friendly, upscale-casual brand.

- **Standard Cards:** 0.5rem (8px) corner radius.
- **Action Buttons:** 0.5rem (8px) for primary buttons; chips/tags use a pill-shape (full radius).
- **Images:** Food photography in menu cards should always feature 8px rounded corners to align with the container.
- **Input Fields:** 8px radius with a defined 2px border on focus.

## Components

### Buttons
- **Primary:** Spice Red background, white text. Bold, 16px weight.
- **Secondary:** Cream background with a charcoal border.
- **Status Chips:** Small, pill-shaped tags used on table cards (e.g., "30m elapsed") using the status color palette.

### Menu Cards
- Must feature a high-quality food image (top half) and the price in `display-price` (bottom right).
- The entire card is a click target for "Quick Add."

### Table Grid
- 6 Large cards with clear status color-coding. 
- The background of the card should subtly tint when "Occupied" (e.g., 5% Red tint) to make the table state obvious from across the room.

### Order Summary (Counter)
- A vertical list with "Kitchen State" indicators. 
- Items already sent to the kitchen are slightly desaturated; new additions are full-color with an "Unsent" tag.

### Input Fields
- Generous internal padding (16px) for easy typing on tablets/phones.
- Modifier tags (e.g., "Extra Spicy") should be large, toggle-style buttons rather than dropdowns for speed.