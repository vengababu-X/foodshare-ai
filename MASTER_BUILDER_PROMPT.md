# Master AI Builder Prompt (for Cursor / Bolt / v0 / ChatGPT)

> ⚠️ **Caveat before using this prompt elsewhere:** the prompt below was written to
> *recreate* the platform quickly in other AI builders. It intentionally contains
> shortcuts that **do not match this repository's production implementation**:
>
> - **"Judge Auth Bypass" 1-click login** — this repo enforces real HTTP-Only JWT
>   middleware; unauthenticated visitors are redirected to `/login` (no bypass).
> - **Base64 data-URI photo upload** — this repo uploads real images to Cloudinary
>   via `POST /api/upload` and stores the HTTPS CDN URL on the Donation document.
> - **`Math.random()` freshness scores** — this repo computes real AI quality /
>   urgency scores from the item/cooked-at/expiry data.
> - **Hardcoded demo KPIs** — this repo aggregates live MongoDB documents for all
>   admin/impact statistics and exports a real CSV.
>
> If you paste this prompt into another tool, expect the result to be a demo-grade
> app. To repair *this* codebase instead, work from `src/` directly.

---

```text
You are an expert Full-Stack Next.js 14 App Router engineer. Create/Repair the complete "FreeBuff AI" zero-food-waste platform.

REQUIREMENTS & ARCHITECTURE:
1. TECH STACK: Next.js 14 (App Router), TypeScript, Tailwind CSS, Mongoose (MongoDB), JWT, Lucide-React.
2. DATABASE CACHING: src/lib/db.ts must maintain a cached connection object for serverless efficiency.
3. MODELS:
   - User (name, email, password, role: DONOR|NGO|VOLUNTEER|ADMIN, organization)
   - Donation (donorId, title, quantity, weightKg, category, expiryHours, image, status: AVAILABLE|ACCEPTED|DELIVERED, aiFreshnessScore, carbonOffsetKg)
   - Delivery (donationId, ngoId, volunteerId, status: ASSIGNED|PICKED_UP|DELIVERED, verificationToken)
4. PHOTO UPLOAD: src/app/api/upload/route.ts converts uploaded files to Base64 Data URIs so image upload works zero-dependency out-of-the-box locally.
5. AUTHENTICATION:
   - src/app/api/auth/login auto-seeds initial donor, ngo, volunteer, and admin demo accounts on first invocation.
   - Sets HTTP-Only JWT cookies.
   - Global Navbar provides a "Judge Auth Bypass" 1-click login button to switch context without 401 locks.
6. PORTALS:
   - Donor Portal (/donor): Upload photo, specify quantity/weight, publish live listing, open ESG diploma.
   - NGO Portal (/ngo): Real-time live feed polling every 5s, claim listing -> triggers automatic Delivery dispatch job.
   - Volunteer Portal (/volunteer): Route details + interactive WebRTC camera QR handshake verification.
   - Admin Portal (/admin): Key KPI metrics & CSV export.

Ensure all imports match, zero missing components, and all buttons are completely connected end-to-end.
```
