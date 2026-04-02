# SimplEOS v2 — Design Specification

## 1. Brand Identity

SimplEOS is not a generic crypto wallet. It was born from EOS Rio — a block producer team that lived inside the Antelope ecosystem. The wallet reflects that heritage: **technically precise, community-rooted, and unapologetically functional**. It exists for people who run nodes, vote for producers, stake resources, and interact with smart contracts daily.

### Design Principles

1. **Clarity over decoration** — Every pixel serves a purpose. No ornamental gradients, no glassmorphism, no floating 3D coins. This is a tool for managing real assets.
2. **Layered darkness** — Three surface tiers create depth without shadows: `bg-deep` (deepest), `bg-base` (main surfaces), `bg-raised` (cards, panels). This was SimplEOS v1's signature — evolve it, don't abandon it.
3. **The blue thread** — SimplEOS cyan-blue (`#0094d2`) is the brand color. It connects every interaction — focused inputs, active navigation, CTAs, links. It's not a decoration, it's a signal that says "you can interact with this."
4. **Typography as data** — In a wallet, numbers are content. They deserve dedicated typographic treatment — larger, bolder, and optionally in a distinct typeface for scannability.
5. **Chain-aware personality** — Each chain gets a subtle accent shift. Vaulta keeps the core blue. WAX gets warm amber. Telos gets purple. This isn't just cosmetic — it's a subconscious cue that tells the user which network they're on.

---

## 2. Color System

### 2.1 Core Palette (Dark Mode — Primary)

```
SURFACE LAYERS
  --bg-deep:       #111218    Deepest layer (sidebar, app chrome)
  --bg-base:       #1a1b26    Main content background
  --bg-raised:     #24253a    Cards, panels, input backgrounds
  --bg-hover:      #2d2e45    Hover state on raised surfaces
  --bg-active:     #33345a    Active/pressed state

BORDERS
  --border-subtle: #2a2b3d    Default borders (cards, dividers)
  --border-focus:  #0094d2    Focused inputs, selected items

TEXT
  --text-bright:   #f0f1f5    Headings, balances, primary content
  --text-body:     #b4b7c9    Body text, descriptions
  --text-muted:    #6b6f85    Labels, timestamps, hints
  --text-disabled: #484b5e    Disabled elements
```

### 2.2 Brand Accent

```
  --accent:        #0094d2    Primary brand blue (inherited from v1)
  --accent-hover:  #00a8ef    Lighter on hover
  --accent-muted:  rgba(0, 148, 210, 0.12)   Background tint for active states
```

### 2.3 Semantic Colors

```
  --positive:      #2dd4a8    Incoming transfers, success, confirmations
  --negative:      #f04438    Errors, failed transactions, warnings
  --caution:       #f5a623    Pending states, low resources
  --info:          #8b7cf6    Informational badges, secondary highlights
```

### 2.4 Chain Accent Overrides

When the user switches chains, `--accent` shifts to the chain's identity color. The rest of the palette stays constant.

| Chain    | Accent Override | Accent Hover  |
|----------|----------------|---------------|
| Vaulta   | `#0094d2`      | `#00a8ef`     |
| WAX      | `#f5a623`      | `#fbbf24`     |
| Telos    | `#7c3aed`      | `#8b5cf6`     |
| Ultra    | `#8b5cf6`      | `#a78bfa`     |
| FIO      | `#3b82f6`      | `#60a5fa`     |
| Libre    | `#22c55e`      | `#4ade80`     |
| XPR      | `#7c3aed`      | `#8b5cf6`     |

This means buttons, active nav indicators, focused inputs, and links all shift subtly when you switch chains — without touching the layout or readability.

---

## 3. Typography

### 3.1 Font Stack

| Role          | Family              | Fallback                              |
|---------------|---------------------|---------------------------------------|
| Headlines     | Inter               | system-ui, -apple-system, sans-serif  |
| Body          | Inter               | system-ui, -apple-system, sans-serif  |
| Data/Mono     | Space Grotesk       | 'SF Mono', monospace                  |

**Why Inter**: Clean, legible at all sizes, excellent number rendering, widely cached in browsers.
**Why Space Grotesk for data**: Geometric, monospaced-feeling but proportional. Account names like `igorls.gm`, public keys, and token amounts read better in it. It has a technical, crypto-native quality without being cold.

### 3.2 Type Scale

| Token                | Size   | Weight | Line Height | Usage                           |
|----------------------|--------|--------|-------------|---------------------------------|
| `--text-hero`        | 42px   | 700    | 1.1         | Primary balance display          |
| `--text-headline`    | 24px   | 600    | 1.3         | Page titles, section headers     |
| `--text-title`       | 18px   | 600    | 1.4         | Card titles, sub-sections        |
| `--text-body`        | 14px   | 400    | 1.5         | Standard body text               |
| `--text-label`       | 12px   | 500    | 1.4         | Form labels, nav items, badges   |
| `--text-caption`     | 11px   | 400    | 1.4         | Timestamps, hints, fine print    |

### 3.3 Numeric Typography Rules

- Token amounts always use Space Grotesk, `--text-body` weight 500
- The hero balance uses Inter 700 at 42px for impact
- Account names (12-char Antelope names) use Space Grotesk, 14px, weight 500
- Public keys use Space Grotesk, 13px, weight 400 (truncated with `...` in middle)
- Always include the token symbol after amounts, in `--text-muted` color

---

## 4. Layout

### 4.1 App Shell

```
┌────────────────────────────────────────────────────────────────┐
│ ┌──────────┐┌─────────────────────────────────────────────────┐│
│ │          ││  ACCOUNT TABS (if multiple accounts)            ││
│ │          │├─────────────────────────────────────────────────┤│
│ │  SIDEBAR ││                                                 ││
│ │  (240px) ││              CONTENT AREA                       ││
│ │          ││              (scrollable)                        ││
│ │          ││                                                 ││
│ │          ││                                                 ││
│ │          ││                                                 ││
│ │          ││                                                 ││
│ │  CHAIN   ││                                                 ││
│ │ SELECTOR ││                                                 ││
│ └──────────┘└─────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────────────┘
```

- **Sidebar**: 240px fixed, `--bg-deep` background. Never scrolls.
- **Account tabs**: Horizontal tab bar at top of content when >1 account. Each tab shows: account name + balance. Mimics v1's mat-tab-group pattern.
- **Content area**: Fills remaining space, scrolls vertically. Max content width: 960px centered with auto margins. Padding: 32px.

### 4.2 Spacing Scale

Base unit: **4px**

| Token    | Value | Usage                                |
|----------|-------|--------------------------------------|
| `--sp-1` | 4px   | Tight gaps (icon-to-label)           |
| `--sp-2` | 8px   | Inline spacing, small gaps           |
| `--sp-3` | 12px  | Input padding, compact cards         |
| `--sp-4` | 16px  | Standard card padding                |
| `--sp-5` | 20px  | Section spacing within cards         |
| `--sp-6` | 24px  | Between cards/sections               |
| `--sp-8` | 32px  | Content area padding                 |
| `--sp-10`| 40px  | Major section breaks                 |
| `--sp-12`| 48px  | Page top/bottom breathing room       |

### 4.3 Border Radius

| Token          | Value | Usage                                     |
|----------------|-------|-------------------------------------------|
| `--radius-sm`  | 4px   | Buttons, badges, small elements           |
| `--radius-md`  | 8px   | Cards, panels, inputs                     |
| `--radius-lg`  | 12px  | Modal dialogs, balance cards              |
| `--radius-full`| 9999px| Chain icon badges, pills                  |

The v1 used 5px uniformly. v2 uses a 3-step scale — slightly more rounded for primary surfaces (8px), sharper for small interactive elements (4px). This is subtle but gives a more modern feel without going soft.

---

## 5. Component Specifications

### 5.1 Sidebar Navigation

```
STRUCTURE:
┌─────────────────────────┐
│  SimplEOS               │  Brand wordmark, Inter 600, 18px
│                         │
│  ┌─────────────────────┐│
│  │ igorls.gm        ▾ ││  Account name (Space Grotesk, 14px, 500)
│  │ 12,847.3291 EOS    ││  Balance (Space Grotesk, 13px, --text-muted)
│  └─────────────────────┘│
│                         │
│  ● History          ←   │  Active: --accent left border (3px), --text-bright
│    Send                 │  Inactive: --text-muted, no border
│    Resources            │
│    Vote / Stake         │
│    REX                  │  Conditionally shown per chain.features
│    Contracts            │
│    Settings             │
│    About                │
│                         │
│  ─────────────────────  │  Subtle divider (--border-subtle)
│  ┌─────────────────────┐│
│  │ 🔵 Vaulta (EOS)  ▾ ││  Chain selector with icon + name
│  └─────────────────────┘│
│  v2.0.0                 │  Version, --text-disabled, 11px
└─────────────────────────┘
```

**Active indicator**: 3px left border in `--accent`, not a background fill. This is clean, precise, and carries from v1's design language. The text shifts from `--text-muted` to `--text-bright`.

**Icons**: Lucide, 18px, 1.5px stroke. Positioned 12px left of label. Color matches text state.

**Keyboard shortcuts**: Display as subtle badge on the right side of each nav item (e.g., `Alt+S` for Send), visible on hover. Power users from v1 relied on these.

### 5.2 Balance Display (Wallet View)

```
BALANCE                               TOTAL VALUE (USD)
12,847.3291 EOS                       $14,132.06
                                      +2.4% last 24h

🔒 Staked 4,200.0000 EOS  |  🔓 Unstaked 8,647.3291 EOS
```

- "BALANCE" label: `--text-label`, 12px, uppercase, letter-spacing 1px
- Amount: Inter 700, 42px, `--text-bright`. The comma-separated format aids scannability.
- Symbol suffix: Space Grotesk 500, 24px, `--text-muted`
- USD card: Separate raised surface on the right. Shows fiat value + 24h change.
- Staked/Unstaked row: 13px, `--text-muted`, with lock/unlock icons (Lucide, 14px)

### 5.3 Resource Meters

Three horizontal cards in a row:

```
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ CPU     34% used │ │ NET      8% used │ │ RAM     72% used │
│ ████░░░░░░░░░░░░ │ │ █░░░░░░░░░░░░░░░ │ │ ███████████░░░░░ │
│ 12.4ms / 36.2ms  │ │ 0.4KB / 5.2KB    │ │ 124.3KB / 172.8KB│
│ Staked: 2,100    │ │ Staked: 2,100    │ │                  │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

- Card background: `--bg-raised`
- Progress bar: 4px height, `--radius-full`
  - Fill color: `--accent` when <70%, `--caution` when 70-85%, `--negative` when >85%
  - Track color: `--bg-hover`
- Usage text: Space Grotesk, 13px, `--text-body`
- v1 turned resource bars red at 85% — preserve this behavior exactly.

### 5.4 Transaction History Rows

```
┌──────────────────────────────────────────────────────────────┐
│ ↓  Received from alice.wam          +250.0000 EOS   2h ago  │
│ ↑  Sent to bob.gm                   -100.0000 EOS   5h ago  │
│ ✓  Voted for 24 producers                           1d ago  │
│ 🔒 Staked 500.0000 EOS                              2d ago  │
│ ↓  Received from carol.wax          +75.0000 EOS    3d ago  │
└──────────────────────────────────────────────────────────────┘
```

- Row height: 52px. Clickable — expands to show full transaction details.
- Divider: 1px `--border-subtle` between rows (v1 pattern).
- Icon: 20px, color-coded (green for receive, default for send, blue for vote).
- Description: Inter 400, 14px, `--text-body`
- Amount: Space Grotesk 500, 14px. `--positive` for incoming, `--text-body` for outgoing.
- Timestamp: 12px, `--text-muted`, right-aligned.
- Pagination: "Showing 1-12 of 847" with page controls. 12 rows per page (v1 default).

### 5.5 Forms

**Input Fields**
- Background: `--bg-raised`
- Border: 1px `--border-subtle`, radius `--radius-md`
- Padding: 12px 16px
- Font: Inter 400, 14px
- Label: Above input, 12px, `--text-muted`, uppercase, letter-spacing 0.5px
- Focus: Border shifts to `--accent`, subtle glow `0 0 0 3px var(--accent-muted)`
- Error: Border `--negative`, error message below in 12px `--negative`

**Buttons**
- Primary: `--accent` background, white text, 14px, 500 weight, uppercase, letter-spacing 1px
  - Height: 40px, padding 0 24px, radius `--radius-sm`
  - Hover: `--accent-hover`, transition 150ms
- Ghost: Transparent, `--accent` text, 1px `--accent` border
  - Hover: `--accent-muted` background
- Danger: `--negative` background for destructive actions (logout, delete key)

**Confirmation Modal** (signing transactions)
- Centered overlay, backdrop blur 4px
- Modal background: `--bg-raised`, radius `--radius-lg`
- Max width: 480px
- Transaction summary as structured key-value pairs (not raw JSON by default, expandable to JSON)
- Passphrase input field
- Two buttons: Cancel (ghost) | Confirm (primary)
- v1 showed Ricardian contracts in an accordion — preserve this for EOS mainnet

### 5.6 Onboarding / Landing

The v1 landing was carefully designed with 4 entry paths. Preserve this structure:

```
┌──────────────────────────────────────────────────┐
│                                                  │
│              SimplEOS logo (animated)            │
│       "Your simple and secure EOS wallet"        │
│                                                  │
│         ┌────────────────────────────┐           │
│         │  Select Chain      ▾      │           │
│         └────────────────────────────┘           │
│                                                  │
│   ┌──────────────┐  ┌──────────────┐            │
│   │ Import Key   │  │ New Account  │            │
│   └──────────────┘  └──────────────┘            │
│   ┌──────────────┐  ┌──────────────┐            │
│   │ Import Backup│  │ Check Account│            │
│   └──────────────┘  └──────────────┘            │
│                                                  │
│         Connection status indicator              │
└──────────────────────────────────────────────────┘
```

- Centered layout, no sidebar.
- Logo can use Lottie animation (v1 used `logoanim.json`). Or a clean SVG wordmark.
- Chain selector with chain icons and names.
- Four action cards: equal size, `--bg-raised`, hover lifts slightly.
- Connection status at bottom: green dot for connected, spinner for connecting, red for failed with RETRY.

### 5.7 Lock Screen

- Full-screen centered, `--bg-deep` background.
- SimplEOS logo or wordmark at top.
- "Enter your passphrase to unlock" in `--text-muted`.
- Single password input, autofocused.
- Unlock button (primary).
- "Import a key" text link below.
- Failed attempt counter: "Wrong passphrase. X attempts remaining." in `--negative`.
- After 5 failures: wipe and restart (v1 behavior — keep it).

---

## 6. Motion & Transitions

| Interaction          | Duration | Easing               |
|----------------------|----------|----------------------|
| Hover (buttons, nav) | 150ms    | ease                 |
| Focus ring appear    | 100ms    | ease-out             |
| Route transition     | 200ms    | ease-in-out (fade)   |
| Modal enter          | 200ms    | ease-out (scale 0.95→1 + fade) |
| Modal exit           | 150ms    | ease-in              |
| Accordion expand     | 250ms    | ease-in-out          |
| Toast slide in       | 300ms    | ease-out             |
| Toast auto-dismiss   | 4000ms   | —                    |

**Loading states**: Skeleton placeholders (pulsing rectangles in `--bg-hover`), not spinners. Spinners only for connection status on the landing page.

---

## 7. Iconography

**Library**: Lucide (MIT, treeshakeable SVG)

**Sizes**:
- Navigation: 18px
- Inline/body: 16px
- Dense contexts: 14px
- Hero/feature: 24px

**Stroke**: 1.5px (Lucide default)

**Color**: Matches adjacent text color. Active state shifts to `--accent`.

**Key icon mappings** (from v1, adapted to Lucide names):
| Feature     | v1 Icon       | v2 Lucide Icon   |
|-------------|---------------|------------------|
| History     | history       | `clock`          |
| Send        | paper-plane   | `arrow-up-right` |
| Resources   | memory        | `cpu`            |
| Vote/Stake  | edit/lock     | `vote`           |
| REX         | exchange-alt  | `repeat`         |
| Contracts   | puzzle-piece  | `file-code`      |
| Settings    | cog           | `settings`       |
| About       | info-circle   | `info`           |
| Received    | arrow-down    | `arrow-down-left`|
| Sent        | arrow-up      | `arrow-up-right` |
| Staked      | lock          | `lock`           |
| Unstaked    | lock-open     | `lock-open`      |

---

## 8. Accessibility

- **Contrast**: All text-on-background pairs meet WCAG AA (4.5:1 minimum).
  - `--text-bright` (#f0f1f5) on `--bg-base` (#1a1b26) = 12.8:1
  - `--text-body` (#b4b7c9) on `--bg-base` (#1a1b26) = 7.3:1
  - `--text-muted` (#6b6f85) on `--bg-base` (#1a1b26) = 3.8:1 (decorative/non-essential only)
- **Focus**: Visible focus ring on all interactive elements (2px `--accent`, 2px offset).
- **Keyboard**: Full keyboard navigation. Tab order follows visual layout. Escape closes modals.
- **Screen readers**: ARIA labels on icon-only buttons. Live regions for transaction results.
- **Reduced motion**: Respect `prefers-reduced-motion` — disable transitions and animations.

---

## 9. Responsive Behavior

This is a desktop app (Tauri), not a website. But the window is resizable:

| Window Width   | Behavior                                    |
|----------------|---------------------------------------------|
| ≥1280px        | Full layout, sidebar + content              |
| 960px–1280px   | Sidebar collapses to 60px (icons only)      |
| <960px         | Not supported (min window size is 960×640)  |

The sidebar collapse shows only icons (no labels) with tooltips on hover. The chain selector shows only the chain icon. This is a compact mode, not a mobile mode.

---

## 10. What Changed from v1

| Aspect              | v1                          | v2                                    |
|---------------------|-----------------------------|---------------------------------------|
| Surface colors      | #191919 / #272727 / #333333 | #111218 / #1a1b26 / #24253a (cooler, blue-tinted) |
| Accent              | #0094d2                     | #0094d2 (kept — it IS SimplEOS)       |
| Border radius       | 5px uniform                 | 4/8/12px scale                        |
| Font                | Metropolis                  | Inter + Space Grotesk                 |
| Shadows             | Box shadows on cards        | Minimal — surface layering instead    |
| Icons               | FontAwesome Pro              | Lucide (MIT, lighter)                |
| Balance size        | 46px                        | 42px (slightly tighter)              |
| Transitions         | 0.3s                        | 0.15s (snappier)                     |
| Component lib       | Clarity + Material + PrimeNG| CDK Aria + custom CSS                |
| Chain awareness      | Same look everywhere        | Accent color shifts per chain        |
| Keyboard shortcuts  | Alt+key (present but hidden)| Alt+key (visible on hover)           |

**What stayed the same**: The blue accent, the 3-tier dark surface layering, the sidebar navigation pattern, the account tabs, the balance-first hierarchy, the transaction confirmation flow, the PIN vs passphrase separation, the 5-attempt lockout, the exchange memo validation, the chain-conditional feature flags, and the overall information architecture.

---

## 11. File Reference

This spec should be implemented using:
- CSS custom properties in `src/styles.css`
- Angular CDK (Aria primitives) for dialogs, overlays, a11y
- Lucide Angular for icons
- No external component library
- All styling is custom CSS — full control, no framework fights
