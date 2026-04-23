# Streaming Architecture (Revised)

## ⚠️ Reality Check

HLS + AES-128 does NOT prevent piracy completely.

It protects against:
- Direct downloads
- Link sharing
- Hotlinking

It does NOT prevent:
- Screen recording
- Camera recording

Goal: **Increase difficulty of unauthorized redistribution**

---

# AES-128 Encryption Flow

1. Client loads `.m3u8` manifest
2. Manifest includes:

   EXT-X-KEY → /api/playback/key

3. Player requests key
4. Backend validates session
5. Backend returns 16-byte AES key
6. Segments are decrypted in browser

---

# Session Model (Improved)

Avoid strict IP-only validation.

## Store:
- user_id
- course_id
- session_token
- device_fingerprint (hashed)
- ip_address (soft validation)
- expires_at

## Rules:

- Same user + different fingerprint → revoke old session
- IP mismatch → log warning (do NOT instantly revoke)
- Expired session → deny key access

---

# CDN Layer (IMPORTANT)

Always use a CDN in production.

## Recommended:
- Cloudflare / CloudFront
- Signed cookies or headers
- Edge validation

## Benefits:
- Reduces backend load
- Blocks scraping early
- Improves latency

---

# Segment Protection

Even if `.ts` files are requested directly:

- Require Authorization headers
- Or use signed URLs

---

# Key Storage Security

DO NOT store raw keys insecurely.

## Recommended:
- Use KMS (AWS KMS / GCP KMS)
- Or encrypt keys at rest

---

# Threat Model Summary

| Threat | Mitigation |
|------|--------|
| Link sharing | Signed manifest |
| Key extraction | Authenticated endpoint |
| Account sharing | Session tracking |
| Devtools bypass | Server-side validation |
| Screen recording | ❌ Not preventable |