# Super Roguedust Notes

## 2026-08-12 — foundation

- Repository initialized on `main`; Vite and TypeScript are the only development dependencies.
- Design contract records the fixed 1600x900 arena, five-sector route rhythm, exact economy, ships, boons, bosses, Threat Protocol, accessibility, and production QA requirements.
- Source boundary now includes stable types, seeded math, validated localStorage persistence, keyboard/pointer/gamepad snapshots, lazy procedural audio, and the fixed-step simulation skeleton with bounded entity caps.
- `npx tsc --noEmit` passes for the current source set.
- Current milestone: the composition root, renderer, UI, and browser shell remain.
- Next action: wire the simulation into the Canvas/DOM composition root, then exercise a fresh launch and death loop.
- Known issue: production browser QA is pending until `src/main.ts` exists.
