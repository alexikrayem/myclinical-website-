# Tabeeb (طبيب)This document distills the design characteristics of the "Tabeeb" project into a comprehensive visual specification. It serves as a stand-alone guide for the "Tabeeb" design system, providing the precise values and the underlying philosophy required to replicate its premium clinical aesthetic.

---

## Design Philosophy: "Clinical Modernism"
The "Tabeeb" visual language is built on the intersection of **Medical Trust** and **Tech-Forward Innovation**. It aims to feel like a high-end medical clinic—sterile and professional—but with the warmth and approachability of a premium digital consumer product.

### Core Pillars:
1.  **Trust & Professionalism**: Centered around a "Clinical Blue" palette and clear, bold typography. The design avoids clutter and prioritizes readability for complex medical content.
2.  **Modernity & Depth**: Leverages **Glassmorphism**, **Gradients**, and **Noise Textures** to create a multi-layered, "Z-axis" feel. This mimics modern OS-level design (like Apple’s visionOS or macOS), positioning the platform as a leader in dental tech.
3.  **Approachability**: Softens the "sterile" nature of medical apps with **Large Corner Radii** (24px) and **Micro-animations**. The UI feels "bouncy" and alive rather than rigid.
4.  **Arabic-First Identity**: Every design decision—from font choice to the "Blue Orb" placement—is optimized for Right-to-Left (RTL) reading flows, ensuring the Arabic user feels native to the experience.

---

## 1. Typography
The system uses a dual-script strategy optimized for high-legibility medical content.

- **Primary Arabic Body**: `Tajawal`
  - *Weights*: Regular (400), Medium (500), Bold (700)
- **Primary Latin & UI**: `Montserrat`
  - *Weights*: 400, 500, 600, 700, 800
- **Arabic Brand Identity**: `MontserratArabic`
  - *Weight*: SemiBold (600)
- **Scale Elements**:
  - *Hero Headings*: 48pt - 72pt (64px - 96px), Font-weight 900
  - *Section Headings*: 32pt - 40pt (42px - 53px), Font-weight 800
  - *Sub-headings*: 18pt - 24pt (24px - 32px), Font-weight 700
  - *Body Text*: 11pt - 12pt (14px - 16px), Line-height 1.6 - 1.8

---

## 2. Color Palette
A clinical system emphasizing trust (Blue) and modernism (Purple).

### Primary Medical Blue
| Level | Hex Code | Role |
| :--- | :--- | :--- |
| 50 | `#eff6ff` | Background tint |
| 100 | `#dbeafe` | Lightest surfaces |
| 200 | `#bfdbfe` | Borders & Accents |
| 500 | `#3b82f6` | Primary Actions / Active states |
| 600 | `#2563eb` | Brand Identity / Navigation |
| 900 | `#1e3a8a` | Contrast text |

### Neutral Grays
| Level | Hex Code | Role |
| :--- | :--- | :--- |
| 50 | `#f8fafc` | Page Background |
| 200 | `#e2e8f0` | Soft Borders |
| 500 | `#64748b` | Muted Text |
| 800 | `#1e293b` | Primary Body Text |
| 900 | `#0f172a` | Headers |

### Accents
- **Clinical Accent**: `#005CB9` (Deep Blue)
- **Modern Highlight**: Gradient from `#8b5cf6` (Purple) to `#7c3aed` (Deep Purple)

---

## 3. Brand Identity & Special Effects
These elements define the "Tabeeb" premium aesthetic and should be used to anchor major sections (Heroes, Feature highlights).

### Glowing Background "Orbs"
Large, soft blurs that create depth without cluttering the layout.
- **Primary Orb**: `800px` x `800px` circle, color `#dbeafe` (`blue-100`) at `40%` opacity.
  - *Effect*: `120px` Blur radius.
  - *Motion*: Subtle pulse (opacity `0.8` to `1.0` over `10s`).
- **Secondary Orb**: `600px` x `600px` circle, color `#f3e8ff` (`purple-100`) at `40%` opacity.
  - *Effect*: `100px` Blur radius.

### Grainy Texture Overlay
To prevent blurs from looking like simple gradients, a global noise texture is used.
- **Asset**: `noise.svg` (grain pattern).
- **Styling**: `20%` opacity with `mix-blend-soft-light`.

### Duo-Colored Typography
Headings use a high-contrast split between neutral darks and vibrant gradients.
- **Base Text**: `text-gray-900` (`#0f172a`).
- **Accent Text**: A `135deg` gradient from `#2563eb` (Blue-600) to `#4f46e5` (Indigo-600).
- **Implementation**: Text is clipped to the background gradient for a "shimmering" effect.

### Live Status Indicators
Used to denote platform-wide activity or "New" content.
- **Outer Ring**: `12px` circle with `4-second` ping animation (scaling up and fading out).
- **Inner Dot**: `12px` solid circle (`blue-500`).

### 3D Perspective Effects
Large imagery and interactive containers use subtle Z-axis depth.
- **Container**: `perspective: 1000px`.
- **Interaction**: On tap/hover, the element rotates on the Y-axis by `2 degrees` to create a "card lift" effect.

---

## 4. Surfaces & Elevation
The UI uses depth and transparency to create a layered, modern look.

### Corner Radii
- **High Emphasis (Cards)**: `24px` (`1.5rem`)
- **Medium Emphasis (Small Cards/Buttons)**: `12px` (`0.75rem`)
- **Pill Style (Tags/Navigation)**: `9999px` (Full rounding)

### Shadows (Elevation)
- **L1 (Flat)**: `0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px 0 rgba(0,0,0,0.06)`
- **L2 (Base Card)**: `0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)`
- **L3 (Floating)**: `0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)`
- **L4 (Interactive/Modal)**: `0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)`

### Glassmorphism System
- **Clear Glass**: `rgba(255, 255, 255, 0.95)`, Blur: `20px`, Border: `1px solid rgba(255,255,255,0.2)`
- **Floating Pill**: `rgba(255, 255, 255, 0.75)`, Blur: `16px`, Shadow: `0 10px 30px -10px rgba(0,0,0,0.08)`

---

## 4. Component Archetypes

### Cards
- **Gaps**: `24px` (`1.5rem`) between cards.
- **Padding**: Internal padding `24px` - `32px`.
- **Interaction**: On tap/hover, transition scale to `1.02` or `1.05` and lift elevation (L2 → L4).

### Buttons
- **Primary**: Gradient `135deg` from `#2563eb` to `#1d4ed8`. Padding: `12px 24px`.
- **Secondary**: White background, `#bfdbfe` border (2px), `#2563eb` text.

### Tags / Badges
- **Shape**: Full pill.
- **Font**: `12px` (`0.75rem`), Font-weight 500.
- **Spacing**: `6px 12px` padding.

---

## 5. Motion & Dynamics

### Timing & Cubic Curves
- **Standard Transition**: `0.3s`
- **Curve**: `cubic-bezier(0.4, 0, 0.2, 1)` (Standard Ease-Out)

### Micro-Animations
- **Entry (Fade-In)**: Start from `opacity: 0`, `translateY(10px)` to `opacity: 1`, `translateY(0)`.
- **Ambient Float**: `translateY(0)` to `translateY(-20px)`, `6s` duration, infinite loop.
- **Pulse**: `opacity: 0.8` to `1.0`, `10s` duration, infinite loop.

---

## 6. UX States
- **Debounce**: Search input should trigger after `300ms` of inactivity.
- **Loading**: Skeletons should use a shimmering linear gradient (`90deg`) from `#e2e8f0` to `#f1f5f9`.
- **Feedback**: Success (Green `#10b981`), Warning (Amber `#f59e0b`), Featured (Purple `#8b5cf6`).
