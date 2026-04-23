
---

# 📁 4. `examples/react-player.md`

```markdown
# Example: Secure React Video Player (Improved)

## Key Improvements:
- Proper cleanup
- Token handling awareness
- Error recovery
- Progress throttling

```tsx
// Key improvement example snippet

hls.on(Hls.Events.ERROR, (_event, data) => {
  if (data.fatal) {
    switch (data.type) {
      case Hls.ErrorTypes.NETWORK_ERROR:
        setTimeout(() => hls.startLoad(), 1000);
        break;
      case Hls.ErrorTypes.MEDIA_ERROR:
        hls.recoverMediaError();
        break;
      default:
        hls.destroy();
        break;
    }
  }
});