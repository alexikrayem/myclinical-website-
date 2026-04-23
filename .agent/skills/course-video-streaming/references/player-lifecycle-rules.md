# React + HLS.js Lifecycle Rules

## 1. Setup / Teardown Rule

Always initialize and destroy inside ONE useEffect.

### Correct order:
1. hls.destroy()
2. player.destroy()

---

## 2. Avoid React Re-renders

❌ DO NOT:
Track video time using useState every second

✅ DO:
- Use event listeners
- Throttle updates (10–30s)

---

## 3. Cleanup Requirements

You MUST:
- Remove event listeners
- Destroy HLS instance
- Destroy Plyr instance

---

## 4. HLS Configuration

Recommended:

- maxMaxBufferLength: 30
- startLevel: -1

---

## 5. Error Recovery

Handle:

- NETWORK_ERROR → restart loading
- MEDIA_ERROR → recoverMediaError
- Other → destroy player

---

## 6. Extra Safety (NEW)

Before destroy:

```js
hls.detachMedia();
hls.destroy();