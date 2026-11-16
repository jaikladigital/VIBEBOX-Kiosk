# Security Specification & Red Team Audit

## 1. Data Invariants
1. **KioskConfig (`/kiosk_configs/{kioskId}`)**:
   - No PII or API secrets (`imgbbApiKey`, `backupApiKey`, `adminPin`) are ever stored here.
   - `ownerUid` must equal `request.auth.uid` on creation and is immutable on updates.
   - `createdAt` must equal `request.time` on creation and is immutable on updates.
   - `updatedAt` must equal `request.time` on both creation and update.
   - `framesUrls` and `sponsorsUrls` lists are strictly bounded (`<= 10` items).
2. **LeaderboardScore (`/kiosk_configs/{kioskId}/scores/{scoreId}`)**:
   - Cannot exist without a valid parent `/kiosk_configs/{kioskId}` owned by `request.auth.uid` (Master Gate `get()`).
   - `kioskId` must match the path `{kioskId}`, `ownerUid` must match `request.auth.uid`.
   - `score` (`0 <= score <= 1000000`) and `level` (`1 <= level <= 1000`) are immutable once recorded; updates are disallowed (only owner/admin can delete to clear leaderboard).
3. **SharedPhoto (`/shared_photos/{photoId}`)**:
   - Contains zero PII; `get` is permitted only by exact valid `photoId` so mobile QR scanners can fetch the shared image.
   - `list` is strictly restricted to `isAdmin()` or `resource.data.ownerUid == request.auth.uid`.
   - `imageUrl` is strictly bounded (`<= 800000` chars) to protect document size limits and prevent abuse.
4. **Verified Auth & Bootstrapped Admin**:
   - All writes require `request.auth != null && request.auth.token.email_verified == true`.
   - Bootstrapped admin email `jaikladigital@gmail.com` requires `email_verified == true`.

## 2. Dirty Dozen Attack Payloads (All Expected: PERMISSION_DENIED)
1. **Unauthenticated Write to Config**: `create /kiosk_configs/booth1` with `auth: null`.
2. **Unverified Email Spoofing**: `create /kiosk_configs/booth1` with `email: "jaikladigital@gmail.com"`, `email_verified: false`.
3. **OwnerUid Spoofing**: `create /kiosk_configs/booth1` with `ownerUid: "victim-uid"` while `auth.uid: "attacker-uid"`.
4. **Shadow / Ghost Field Injection**: `create /kiosk_configs/booth1` with extra field `isAdmin: true` or `secretKey: "abc"`.
5. **Over-sized ID Poisoning**: `create /kiosk_configs/${"a".repeat(200)}` (blocked by `isValidId`).
6. **Client-Forged Timestamp**: `create /kiosk_configs/booth1` with `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time`.
7. **Immutable Field Tampering**: `update /kiosk_configs/booth1` changing `ownerUid` or `createdAt`.
8. **Cross-Tenant Config Hijack**: User B attempts `update /kiosk_configs/booth1` owned by User A.
9. **Orphaned Score Injection**: `create /kiosk_configs/nonexistent/scores/s1` (blocked by Master Gate `get()`).
10. **Score Mutation Tampering**: User attempts `update /kiosk_configs/booth1/scores/s1` to inflate `score`.
11. **Blanket Collection Scraping**: Unauthenticated or non-owner `list /shared_photos` or `list /kiosk_configs`.
12. **Unbounded Array / Payload Exhaustion**: `create /kiosk_configs/booth1` with `framesUrls` containing 50 items or `brandName` with 5000 chars.
