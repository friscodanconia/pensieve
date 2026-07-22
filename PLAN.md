# Pensieve Plan

## High Priority

- [x] **Wire up credit counter to update in real-time after API usage**: `updateFromResponse` in `useCredits.ts` reads the `X-Credits-Remaining` header that all three API endpoints set after decrementing credits — but it was never called. The displayed credit count never decremented in real-time after using the assistant, Mirror analysis, or Sources extraction. Added `onCreditUpdate` prop to `AssistantPanel` and `MirrorView`, and called `updateFromResponse` directly in `handleProcessSources` in `App.tsx`.

- [x] **Memoize expensive htmlToMarkdown/countWords calls in App.tsx**: `htmlToMarkdown` and `countWords` both create DOM elements and run per-render — meaning they fire on every keystroke. Wrap `wordCount`, `currentMarkdown`, `draftMarkdown`, `sourcesMarkdown`, and `allTabsContext` in `useMemo` with their actual string dependencies so they only recompute when content changes.

- [x] **Fix AssistantPanel chat history not resetting on project switch**: `messages` state in `AssistantPanel.tsx` is never cleared when switching projects, so stale conversation from a previous project persists (and the AI sees the new project's content while the history references the old one). Add `projectId` prop and a `useEffect` to clear messages on change, then pass `activeProjectId` from `App.tsx`.

- [x] **Fix Mirror state not resetting on project switch**: `mirrorAnalysis`, `mirrorStatus`, and `mirrorLastUpdated` in `App.tsx` are global and never cleared when switching projects, so Mirror shows stale analysis from the previous project.

- [x] **Fix Mirror analysis race condition**: If the user edits content while an analysis fetch is in-flight, the old (stale) result can resolve after a newer one and overwrite it. Add a generation counter (`analysisGenRef`) to `MirrorView.tsx` so only the most recently triggered analysis can update state.

## Done

- [x] **Fix Mirror re-analysis bug**: Removed dead/buggy early-return on line 95 of `MirrorView.tsx` where `analysis && hash === contentHashRef.current` was always `true` (since `contentHashRef.current` was just set to `hash` on the previous line). This prevented Mirror from ever re-analyzing when content changed if any prior analysis existed. Also removed `analysis` from the `useEffect` dependency array since it was no longer used in that effect.
