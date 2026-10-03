# Test audit

This records the current cleanup on `chore/slop-audit-cleanup`. Earlier audit
results (including the previously recorded 686 passing tests) are historical;
they are not validation of this branch.

## Current policy and changes

`AGENTS.md` assigns UI verification to the user and prohibits automated UI tests,
including SSR markup/CSS assertions. Tests remain for essential non-UI parsing,
security, persistence, configuration, transport, and state behavior.

This cleanup removed 50 existing top-level test cases across eight suites:

| Suite | Removed cases | Retained coverage |
| --- | ---: | --- |
| `components/ChatInput.test.mjs` | 8 | Text/link conversion, model filtering/modality classification, image processing, command classification, draft merging and rekeying |
| `components/MarkdownBody.test.mjs` | 11 | Math delimiter normalization exclusions for code, raw HTML, escaped text, and links |
| `components/MessageView.test.mjs` | 13 | Image preservation when editing a message; streamed input/token helper checks retained as a standalone non-rendering case |
| `components/MermaidBlock.test.mjs` | 6 | SVG export bytes, Blob MIME type, object-URL cleanup; no diagram or component rendering |
| `components/AnsiText.test.mjs` | 8 | Suite deleted; ANSI stripping/frame normalization remains in `lib/ansi.test.mjs`, but renderer escaping is a manual check |
| `components/ChatMinimap.test.mjs` | 1 | Suite deleted; heading math and actual navigation move to manual checks |
| `components/AppShell.workspace-memory.test.mjs` | 1 | Suite deleted; pure workspace/draft helpers remain separately covered |
| `hooks/model-loading.test.mjs` | 2 | Suite deleted; retry/cancellation UI behavior moves to manual checks |

The removed cases include seven composer rendering cases, its keyboard-handler
source-extraction harness, the message component memo comparator test, and all
remaining SSR rendering cases in the six component suites above. The previous
Mermaid SSR cases only observed source/loading markup: effects never ran, so they
did not establish successful preview or error rendering.

Source-extraction/VM harnesses patched React callbacks and lifecycle state instead
of exercising the actual component lifecycle. Those model-loading, keyboard, and
workspace restoration harnesses are gone. Draft tests now describe the helper
operations they actually exercise rather than claiming React remount/flush checks.

Session-list window tests retain visible/focused row inclusion, unique sorted
indices, bounds, small/empty-list handling, and a window independent of total
collection size. Exact
overscan counts were removed so tuning overscan does not break behavior checks.

## Remaining component-directory inventory

The retained suites exercise functions directly, without mounting components:

- `BranchNavigator`: tree traversal, projection, branch detection, deep-tree safety.
- `ChatInput` and `ChatInput.dormancy`: command/text/image/draft processing and
  command grouping/selection indices.
- `ChatAppearance`: preference clamping.
- `ExtensionStatusBar` and `ExtensionWidgets`: text normalization, update identity,
  and expansion-selection state helpers.
- `MessageView`: tool-input/token text and image-preserving message edits.
- `ModelsConfig`: header drafts, explicit compatibility overrides, and cost drafts.
- `SkillsConfig.dormancy`: stable active/dormant ordering.
- `SessionSidebar`: bounded list-index calculations.
- `MarkdownBody`: math delimiter parsing exclusions.
- `AppShell.terminal` and `file-tab-state`: serialized tab validation and state updates.
- `TerminalPanel`: terminal transport errors, ordered/bounded input, cancellation.
- `MermaidBlock`: export utility with fake DOM/serializer and object-URL functions;
  it checks serialization/resource handling, not a preview, browser download,
  rendering, focus, or user interaction.

Some pure helpers still live in `.tsx` modules and are imported using Jiti. This
does not test their UI wiring. No remaining component/hook test uses SSR markup,
CSS assertions, or source-extraction/VM execution. Non-UI HTML-string assertions
in parser/security helpers are distinct from rendered component markup.

The package test command discovers the retained files; the now-empty hooks test
glob was removed.
Backend/runtime and desktop tests continue to be maintained separately.

## Coverage limits and validation

Use [Manual testing after changes](manual-testing.md), including the focused
replacement checks added for this cleanup. Removing the harnesses does not prove
keyboard priority, effect cancellation, remount draft recovery, preview rendering,
error visibility, renderer HTML escaping, or link UI wiring. Pure helper tests do not establish those flows.

Final branch validation on 2026-10-03:

- `node_modules/.bin/tsc --noEmit --incremental false`: passed.
- `npm run lint`: passed without warnings.
- `npm test`: 658 passed, zero failed or skipped.
- `npm run test:desktop`: two passed, three skipped because staged/packaged
  artifacts were absent. Packaging runtime behavior remains unverified.
- `git diff --check`: passed.

No UI checks were performed and no production build was run. New non-UI coverage
checks malformed command/event envelopes, configuration corruption and rejected
writes, operational error classification, and actual DELETE-route failure ordering.
