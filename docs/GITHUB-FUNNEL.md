# GitHub marketing — free Effectum → paid Pro

**Strategy:** Effectum (public) is the funnel. Effectum Pro (private repo + effectum-pro.com) is what makes money.

## What “polished” repos usually have (and we do)

| Thing | Effectum | Notes |
|-------|----------|--------|
| README hero image | `docs/assets/hero-banner.png` | **PNG** (not SVG) — GitHub strips/breaks fancy SVG |
| Lava dividers | `docs/assets/lava-divider.png` | Same |
| Badges | npm version, MIT | Top of README |
| Link to paid product | effectum-pro.com | Every README pass |
| **Social preview** (link shares) | `docs/assets/social-preview.png` | **You:** Repo → Settings → General → Social preview → upload PNG |
| **Topics** | agents, mcp, effectum, … | Repo About sidebar |
| **Website** | https://effectum-pro.com | Points buyers at Pro (not npm) |

## What you might expect but is normal to skip

| Thing | Why Effectum looks “empty” |
|-------|----------------------------|
| **Packages** (GitHub tab) | We publish **`@effectumcore/effectum` on [npmjs.com](https://www.npmjs.com/package/@effectumcore/effectum)**, not GitHub Packages. The tab stays empty unless you publish to `npm.pkg.github.com`. |
| **GitHub Marketplace** | For apps/actions for sale — not where devtools get discovered |
| **Releases with assets** | Optional later; not required for npm install funnel |

## Funnel flow

```text
GitHub README (hero + story)
    → npm install @effectumcore/effectum  (free MIT)
    → builder hits limits / wants audit
    → effectum-pro.com  (Stripe → download)
```

## Owner checklist (GitHub hub)

**npm (done):** `@effectumcore/effectum` **0.1.2** on [npmjs.com](https://www.npmjs.com/package/@effectumcore/effectum). README badge updates automatically from shields.io.

### Already set on the repo (verify)

| Item | Target |
|------|--------|
| **About → Description** | Free MIT local agent runtime … Upgrade: effectum-pro.com |
| **About → Website** | https://effectum-pro.com |
| **Topics** | agents, mcp, effectum, typescript, local-first, … |

### You do in the browser (~3 min)

1. **Social preview** — [Repo Settings → General](https://github.com/mwatso12026-bit/Effectum/settings) → **Social preview** → upload  
   `C:\Users\Heather\Documents\GitHub\Effectum\docs\assets\social-preview.png`  
   (Use **PNG**, not SVG.)

2. **Pin on profile** — [Your profile](https://github.com/mwatso12026-bit?tab=repositories) → **Customize pins** → pin **Effectum**.

3. **Push git to match npm** — commit `package.json` / `package-lock.json` at **0.1.2** on `main` (PR if branch is protected).

Effectum-Pro stays private; public funnel is **this repo + npm + effectum-pro.com**.