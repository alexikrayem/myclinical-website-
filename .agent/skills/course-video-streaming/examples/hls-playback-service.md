
---

# 📁 5. `examples/hls-playback-service.md`

```markdown
# Backend: HLS Key Delivery (Improved)

## Key Improvements:
- Rate limiting
- Logging
- Expiry validation
- Attention blocking

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30
});

router.get('/key/:courseId', limiter, async (req, res) => {
  const sessionToken = req.headers.authorization?.split(' ')[1] || req.query.token;

  if (!sessionToken) return res.status(401).end();

  const { data: session } = await supabaseAdmin
    .from('playback_sessions')
    .select('*')
    .eq('token', sessionToken)
    .single();

  if (!session) {
    console.warn('Invalid session', { ip: req.ip });
    return res.status(403).end();
  }

  if (new Date(session.expires_at) < new Date()) {
    return res.status(403).end();
  }

  const { data: pending } = await supabaseAdmin
    .from('attention_checks')
    .select('id')
    .eq('session_token', sessionToken)
    .eq('status', 'pending')
    .single();

  if (pending) {
    return res.status(403).end();
  }

  const { data: keyData } = await supabaseAdmin
    .from('course_encryption_keys')
    .select('aes_key_buffer')
    .single();

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-store');

  return res.send(Buffer.from(keyData.aes_key_buffer, 'base64'));
});