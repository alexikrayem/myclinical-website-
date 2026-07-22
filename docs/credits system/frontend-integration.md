# Client Integration & Frontend Components

The client application integrates with the credit system to display live balances, prompt card redemptions, and lock/unlock digital resources based on real-time permissions checks.

---

## 1. State Management & Authentication Integration (`AuthContext.tsx`)

The client application tracks token balances globally inside the React Authentication Context:

- **State Hook**: Calling `useAuth()` exposes two primary credit variables:
  - `credits`: An object containing standard balances (`balance`, `video_watch_minutes`, `article_credits`, `research_credits`, `total_earned`) and a list of scoped typed balances (`typed_credits`).
  - `refreshCredits()`: An async function that pulls hot balance updates from `GET /api/credits/balance` client-side API wrapper and updates the local React state.
- **Sync Event Triggers**: Balances are refreshed:
  1. Immediately upon successful login.
  2. Following successful voucher code redemptions.
  3. Whenever resources are purchased (e.g. course purchased, article unlocked).

---

## 2. React Components Library

The UI implements two modular dashboard elements to manage credits:

### A. The Balance Widget (`CreditBalance.tsx`)
A visual pill rendered in the navigation header displaying the general-purpose credit balance.

- **Dynamic Dropdown Menu**: Clicking the widget expands an animated details card mapping out:
  - Global Credits breakdown (General coins, watch minutes, article count, research count).
  - Scoped/Typed Credit Assets (Iterated badge tags for each campaign category like "Orthodontics").
- **UX Hooks**: Features a "+" Quick Charge action opening the redemption wizard. It automatically enforces visibility guards: it remains hidden if a session is anonymous or user context is uninitialized.

### B. The Code Redemption Wizard (`CreditRedeemModal.tsx`)
An interactive popup dialog that allows users to redeem physical cards or online promo codes.

- **Input Optimization**: Converts lowercase letters to uppercase on-the-fly and strips away forbidden inputs (retaining only numeric, alphabetical, and separator hyphens).
- **Result Panels**: Displays rich dynamic feedback post-execution:
  - Success banner showing Arabic status explanations.
  - Detailed grid showing newly added values across categories: General Balance, Video Watch Time, Article credits, and Research credits.
- **State Cleanup**: Refresh triggers `refreshCredits()`, updates context, clears typed keys, and emits a toast notice.

---

## 3. Playback Consumption & HLS Attention Checks

For courses utilizing minute-by-minute streaming billing, runtime consumption is verified on-the-fly:

1. **API Heartbeat pinging**: 
   - During video streaming (HLS playback), the browser periodically reports watch progression.
   - The application makes an encrypted fetch to the backend `POST /api/credits/consume-video` with the current elapsed time.
2. **Attention Verification Challenges**:
   - To prevent accounts from running video players in background tabs to farm certificates or drain minutes without learning, the video player fires random visual attention challenge alerts.
   - If the user fails to confirm the prompt within a designated window, the HLS player pauses, stream segments stop downloading, and consumption requests are suspended.
3. **Graceful Degradation**:
   - If a heartbeat reports a 400 error (`CREDITS_INSUFFICIENT`), the application blocks video decoding, displays an overlay modal redirecting the user to recharge, and fires a warning notification.
