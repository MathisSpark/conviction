---
name: research-product-releases
description: Research a Jupiter Predict market about whether a product, feature, or model will ship by a date (Gemini X.Y released by, Cybercab pricing, Starship test flights, app launches). Use for R&D / shipping-timing markets. Reads dev signals, exec statements, leaks, regulatory state.
---

# Research Product Releases

## When to use
Trigger this skill when the market question references:
- A named product or model with a release date ("Gemini 3.5 released by ___")
- A test flight / launch / deployment ("Starship Flight 12 by ___")
- A pricing milestone ("Cybercab ≤ $X by ___")
- Any "Will X ship by date Y" framing

## Workflow
1. **Lock the resolution criteria.** What counts as "released"? (General availability vs preview? US-only vs global?)
2. **Read dev signals:**
   - Official roadmap pages + recent release notes
   - GitHub commit cadence on related repos
   - Beta/preview leaks on X, Reddit, dev forums
3. **Read exec signaling:**
   - Recent statements from the CEO / product lead on X / interviews / earnings calls
   - Patterns of "promising soon" — be skeptical of vague signals
4. **Compute base rate:** how often does this company hit its stated dates? (Tesla famously misses, Apple hits, Google in-between.)
5. **Output JSON** with `probabilityYes`, `confidence`, `reasoning`, `sources`, `caveats`.

## Rules of thumb
- If the team has slipped a similar deadline in the last 12 months: discount probability by ~15%.
- If a Beta is already in the wild: bump probability +20%.
- If the deadline is < 7 days away with no signal of impending release: probability is low.
- Always cite the specific signals you found, with verbatim quotes.
