---
status: accepted
---

# Card thumbnails come from an owned image library in Cloudflare R2, served through the app's Worker

No public mirror of support card art exists (gk-img covers idols, P-items and skill cards only; hatsuboshi-library serves from its author's private Cloudinary account behind a URL scheme `img_general_{assetId}_full.webp`). We extract the art ourselves from the game CDN, downscale to webp, keep the game's filename convention, and store it in an R2 bucket bound to this app's Cloudflare Worker, which serves `/img/*` with immutable cache headers next to the static site. This keeps one subdomain per app (the tia-tools rule), costs nothing at this size, and lets future tia-tools apps reuse the bucket. Alternatives rejected: a git image repo on GitHub Pages (binary churn, would need a second subdomain or a github.io URL), bundling into the app's `public/` (image refresh becomes an app deploy, no reuse), our own Cloudinary account (vendor outside the stack), hotlinking someone else's mirror (their bandwidth, no permission). The URL prefix is a single constant in the app so the store can move later; the filenames cannot change cheaply once shared.

Source: user decision D6 after comparing four options, grill-me session 2026-09-16 (`docs/plans/EXECPLAN_SUPPORT_CARD_SCORE_TABLE.md` § Decision Log). hatsuboshi-library findings verified by reading its `app/assets/media.ts` and live bundle the same day.
