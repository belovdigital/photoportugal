# Photo Portugal — Full Audit Task List
**Created: March 19, 2026**
**Status: In Progress**

---

## CRITICAL — Security (must fix before any public access)

1. **npm audit fix** — patch 4 Next.js CVEs (CSRF bypass, DoS, request smuggling, disk cache)
2. **Rate limit on reset-password** — add rate limiting to prevent brute-force on reset tokens
3. **Sanitize blog HTML** — add DOMPurify to prevent XSS via dangerouslySetInnerHTML
4. **Validate file extensions on upload** — whitelist jpg/jpeg/png/webp/gif only
5. **Require NEXTAUTH_SECRET** — fail on startup if env var is not set (remove fallback-secret)

## CRITICAL — Legal / GDPR (must fix before EU launch)

6. **Cookie consent banner** — create CookieConsent component, show on first visit
7. **Privacy Policy update** — add legal basis, data retention, DPA, right to complain, third-party services
8. **Self-service account deletion** — implement actual account deletion in settings (not just "email us")
9. **Company legal info** — add address, registration number, VAT ID to About page and footer

## CRITICAL — Accessibility

10. **Add aria-labels** — icon buttons, modals, mobile menu, interactive elements throughout

## IMPORTANT — Security

11. **Delivery password: SHA256 → bcrypt** — use bcrypt with salt instead of plain SHA256
12. **Blog slug validation** — validate format (lowercase alphanumeric + hyphens only)

## IMPORTANT — Tech / Performance

13. **Add DB indexes** — photographer_profiles.user_id, bookings.payment_status
14. **Photographer profile ISR** — change from force-dynamic to revalidate=60
15. **Health check endpoint** — add /api/health
16. **Image cache cleanup** — add max-age cleanup for /uploads/.cache/

## IMPORTANT — UI / UX

17. **Form validation** — password strength indicator on signup, client-side email format check
18. **Empty states** — add for bookings list, portfolio, packages when empty
19. **Mobile menu auto-close** — close menu after navigation click
20. **Photographer onboarding** — add tips/guides to checklist steps, move Stripe to Payouts

## IMPORTANT — Content / SEO

21. **Fix header "23 locations" → actual count** — use dynamic count
22. **Fix FAQ vs Pricing mismatch** — Premium portfolio photos: "100" vs "Unlimited"
23. **Render photo spots** on location pages (data fetched but not displayed)
24. **Privacy Policy date sync** — update to match Terms date (March 19)

## IMPORTANT — Legal

25. **Clarify "personal use" license** — specify: social media, print, no commercial, no AI training
26. **Add arbitration clause** to Terms — disputes through platform, not courts
27. **Add dispute resolution timeframe** to Terms — "within 5 business days"
28. **Add Stripe chargeback handling** to Terms

## MINOR — Tech

29. **Remove console.log from production** — replace with proper logging or remove
30. **TypeScript strictness** — replace `as { ... }` casts with proper interfaces
31. **PM2 ecosystem config** — create ecosystem.config.js with cluster mode
32. **Add error boundaries** — error.tsx for key page groups

## MINOR — UI / UX

33. **Add typing indicators** to messaging
34. **Add message search** functionality
35. **Add "Preview my profile" link** in photographer dashboard
36. **Add social media links** to footer (Instagram, Facebook)
37. **Fix duplicate Profile/Settings link** in header dropdown

## MINOR — SEO / Content

38. **Populate photographer_count** on location pages from DB
39. **Add hreflang x-default** declaration for English
40. **Verify OG image** is 1200x630 with good branding
41. **Add Google Business Profile** link to footer
