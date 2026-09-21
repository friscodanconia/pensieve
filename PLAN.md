# Pensieve Plan

## High Priority

- [x] **Fix Mirror re-analysis triggered on every tab visit**: `contentHashRef` is initialized to `''` in `MirrorView.tsx`, so whenever the component remounts (user navigates back to the Mirror tab), the content-change effect sees `hash !== ''` and schedules a 5-second re-analysis even if nothing changed since the last analysis — consuming a credit each visit. Fix: initialize `contentHashRef` with the actual current content hash instead of `''`.

- [x] **Fix word count showing 0 on Mirror tab**: When the user is on the Mirror tab, `currentContent` is `project.tabs[2].content` which is always `''` (Mirror has no stored content — it's an AI-generated view). So the status bar shows "0 words" with no "min read" estimate on the Mirror tab. Since Mirror reflects the Draft, the status bar should show the Draft word count when on Mirror tab. Fix: change the `wordCount` memo in `App.tsx` to use `tab0Content` instead of `currentContent` when `activeTab === 2`.

- [x] **Fix Mirror blank state when switching projects while on the Mirror tab**: When the user is on the Mirror tab and switches projects, `App.tsx` resets `mirrorAnalysis → ''` and `mirrorStatus → 'idle'`. MirrorView is still mounted (its first-mount effect won't re-run), so the content-change effect's 5-second debounce is all that fires — leaving Mirror showing just a bare "Refresh" button with no content or spinner for 5 seconds. Fix: add a `useEffect` in `MirrorView.tsx` that detects when the `analysis` prop transitions from non-empty to `''` (the project-switch signal) while content exists, and immediately triggers `runAnalysis()` — bypassing the debounce.

- [x] **Wire up credit counter to update in real-time after API usage**: `updateFromResponse` in `useCredits.ts` reads the `X-Credits-Remaining` header that all three API endpoints set after decrementing credits — but it was never called. The displayed credit count never decremented in real-time after using the assistant, Mirror analysis, or Sources extraction. Added `onCreditUpdate` prop to `AssistantPanel` and `MirrorView`, and called `updateFromResponse` directly in `handleProcessSources` in `App.tsx`.

- [x] **Memoize expensive htmlToMarkdown/countWords calls in App.tsx**: `htmlToMarkdown` and `countWords` both create DOM elements and run per-render — meaning they fire on every keystroke. Wrap `wordCount`, `currentMarkdown`, `draftMarkdown`, `sourcesMarkdown`, and `allTabsContext` in `useMemo` with their actual string dependencies so they only recompute when content changes.

- [x] **Fix AssistantPanel chat history not resetting on project switch**: `messages` state in `AssistantPanel.tsx` is never cleared when switching projects, so stale conversation from a previous project persists (and the AI sees the new project's content while the history references the old one). Add `projectId` prop and a `useEffect` to clear messages on change, then pass `activeProjectId` from `App.tsx`.

- [x] **Fix Mirror state not resetting on project switch**: `mirrorAnalysis`, `mirrorStatus`, and `mirrorLastUpdated` in `App.tsx` are global and never cleared when switching projects, so Mirror shows stale analysis from the previous project.

- [x] **Fix Mirror analysis race condition**: If the user edits content while an analysis fetch is in-flight, the old (stale) result can resolve after a newer one and overwrite it. Add a generation counter (`analysisGenRef`) to `MirrorView.tsx` so only the most recently triggered analysis can update state.

## Done

- [x] **Fix Mirror re-analysis bug**: Removed dead/buggy early-return on line 95 of `MirrorView.tsx` where `analysis && hash === contentHashRef.current` was always `true` (since `contentHashRef.current` was just set to `hash` on the previous line). This prevented Mirror from ever re-analyzing when content changed if any prior analysis existed. Also removed `analysis` from the `useEffect` dependency array since it was no longer used in that effect.
