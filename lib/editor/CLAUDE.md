<system_context>
ProseMirror-based rich text editor system powering the document artifact panel. Handles schema setup, markdown↔ProseMirror conversion, sentence-level diffing, and inline suggestion rendering.
</system_context>

<file_map>
## FILE MAP
- `config.ts` — ProseMirror `documentSchema` (with list support), `headingRule(level)` input rule, `handleTransaction()` save gate.
- `diff.js` — `patchDocumentNode(schema, oldNode, newNode)`: structural diff + patch. Creates visual diff marks for insertions/deletions.
- `functions.tsx` — `buildDocumentFromContent(content)` (markdown→AST), `buildContentFromDocument(doc)` (AST→markdown), `createDecorations(suggestions, view)`.
- `react-renderer.tsx` — `ReactRenderer.render(component, dom)`: mounts a React tree into an arbitrary DOM element (used for ProseMirror widgets/node views).
- `suggestions.tsx` — `suggestionsPlugin`: ProseMirror plugin that maps `Suggestion` DB records to editor character positions and renders interactive inline widgets.
</file_map>

<patterns>
## PATTERNS

### handleTransaction save guard
`handleTransaction` checks for `no-save` meta on the transaction before persisting content:
```typescript
// Use this flag for programmatic edits that should NOT trigger a save
tr.setMeta("no-save", true);
```
Without this flag, every transaction triggers content persistence.

### Suggestion rendering pipeline
1. `projectWithPositions(doc, suggestions)` — maps each `Suggestion.originalText` to a character range in the document
2. `createDecorations(suggestions, view)` — builds highlight + widget decorations
3. `suggestionsPlugin` manages the decoration state and applies/removes per transaction
4. Widget renders `PreviewSuggestion` React component via `ReactRenderer.render()`
5. User clicks accept → `onApply()` fires → replaces text range, removes decoration

### Diff marks
`patchDocumentNode()` annotates nodes with Diff marks:
- `0` = unchanged, `-1` = deleted (strikethrough), `1` = inserted (highlight)
Diff operates at sentence granularity (via `tokenizeSentences()`) for readable change display.
</patterns>

<critical_notes>
## CRITICAL NOTES
- **`diff.js` is plain JS** — It is not TypeScript. Do not add TS syntax; run types through JSDoc if needed.
- **`ReactRenderer` must be called in a ProseMirror context** — Only use inside node views or widget decorations where a DOM element is available. Never call from React render cycles.
- **`buildDocumentFromContent` parses markdown via React** — It renders `ReactMarkdown` to HTML, then uses `DOMParser` to build the ProseMirror AST. Avoid calling on the server (browser API dependency).
- **`suggestionsPlugin` uses decoration IDs** — When removing a suggestion after apply, match by the suggestion's `id` field to avoid stale state.
</critical_notes>
