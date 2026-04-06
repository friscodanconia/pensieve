# Pensieve Plan

## High Priority

- [x] **Fix Mirror state not resetting on project switch**: `mirrorAnalysis`, `mirrorStatus`, and `mirrorLastUpdated` in `App.tsx` are global and never cleared when switching projects, so Mirror shows stale analysis from the previous project.

## Done

- [x] **Fix Mirror re-analysis bug**: Removed dead/buggy early-return on line 95 of `MirrorView.tsx` where `analysis && hash === contentHashRef.current` was always `true` (since `contentHashRef.current` was just set to `hash` on the previous line). This prevented Mirror from ever re-analyzing when content changed if any prior analysis existed. Also removed `analysis` from the `useEffect` dependency array since it was no longer used in that effect.
