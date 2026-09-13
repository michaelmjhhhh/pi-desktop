# Test audit

Audited 152 tracked unit/integration test files and eight browser/Electron UI
scripts. The branch is `chore/test-audit-cleanup`.

## Decisions

- Remove source-text assertions that pin spelling, helper calls, JSX structure,
  CSS classes, ordering of source statements, or counts of implementation tokens.
  They do not prove the described runtime behavior.
- Remove presentation-only static markup checks where the useful check requires
  interaction or visual inspection. Retain rendering regressions for escaping,
  content transformations, link handling, streaming, and error visibility.
- Remove repeated helper coverage masquerading as route coverage. The deleted
  session context/detail tests never called the routes. The detail test named
  “still caps at 1000” actually expected 5000 messages.
- Consolidate configuration checks into a native ESM import that verifies the
  tracing root and app version, without matching source text.
- Remove the browser/Electron UI scripts per the requested manual UI workflow.
  These included useful integration coverage; removal transfers responsibility
  to the manual checklist and does not imply those behaviors are unimportant.
- Retain behavior tests for security, credentials, atomic writes, parsing, file
  paths, session pagination, models, caching, lifecycle, and state transitions.
  Retain callback execution tests for model-load cancellation, keyboard handling,
  and draft restoration: these execute behavior despite reading source fixtures.
- Retain desktop backend authentication, native terminal, shutdown, and packaging
  checks. They do not automate the UI; CI still runs them against staged and
  packaged resources.

## Removed unit test files

Source-only checks unless explicitly identified below as duplicated or presentation
coverage. For mixed files, only the affected cases were removed.

- `app/api/agent/events-route.test.mjs`
- `app/api/files/stream-route.test.mjs`
- `app/api/files/watch-route.test.mjs`
- `app/api/sessions/context-route.test.mjs` — duplicate helper coverage and source-only route checks
- `app/api/sessions/detail-route.test.mjs` — duplicate helper coverage and source-only route checks
- `components/AgentSessionPanel.test.mjs`
- `components/AgentsConfig.test.mjs`
- `components/AppShell.auto-name.test.mjs`
- `components/AppShell.file-viewer-state.test.mjs`
- `components/ChatWindow.extension-request.test.mjs`
- `components/ChatWindow.notices.test.mjs`
- `components/ChatWindow.process-details.test.mjs`
- `components/ChatWindow.quoted-branch.test.mjs`
- `components/FileViewer.state.test.mjs` — source/CSS matching, including a third-party token-class check
- `components/FileViewer.test.mjs`
- `components/ImagePreview.test.mjs`
- `components/SessionSidebar.file-search.test.mjs`
- `components/SessionSidebar.project-identity.test.mjs`
- `components/SessionSidebar.worktree.test.mjs`
- `components/SettingsPanel.test.mjs`
- `components/SettingsUi.test.mjs`
- `components/ToolDefinitionsPanel.test.mjs`
- `components/TurnWrittenFiles.test.mjs` — presentation only; extraction behavior remains in `lib/turn-written-files.test.mjs`
- `hooks/model-scope-startup.test.mjs`
- `hooks/model-switching.test.mjs`
- `hooks/useAgentSession.test.mjs`
- `lib/next-config.test.mjs` — consolidated into `next-config-esm.test.mjs`
- `lib/provider-api-key-route.test.mjs`

## Trimmed files

- `app/api/sessions/runtime-route.test.mjs`: removed 3 source/presentation assertions; retained executable behavior tests.
- `components/AppShell.workspace-memory.test.mjs`: removed 4 source/presentation assertions; retained executable behavior tests.
- `components/ChatAppearance.test.mjs`: removed 2 source/presentation assertions; retained executable behavior tests.
- `components/ChatInput.test.mjs`: removed 5 source/presentation assertions; retained executable behavior tests.
- `components/ExtensionStatusBar.test.mjs`: removed 3 source/presentation assertions; retained executable behavior tests.
- `components/ExtensionWidgets.test.mjs`: removed 6 source/presentation assertions; retained executable behavior tests.
- `components/ModelsConfig.test.mjs`: removed 8 source/presentation assertions; retained executable behavior tests.
- `components/SessionSidebar.test.mjs`: removed 13 source/presentation assertions; retained executable behavior tests.
- `components/SkillsConfig.dormancy.test.mjs`: removed 1 source/presentation assertions; retained executable behavior tests.
- `lib/project-trust.test.mjs`: removed 2 source/presentation assertions; retained executable behavior tests.
- `lib/rpc-manager.test.mjs`: removed 18 source/presentation assertions; retained executable behavior tests.
- `components/BranchNavigator.test.mjs`: removed an identical repeated assertion;
  retained deep-tree, empty-tree, and multiple-root regressions.
- `components/MermaidBlock.test.mjs`: removed the Chinese-diagram SSR check;
  server rendering never executes the diagram-rendering effect, so it only
  verified the container existed. Actual diagram rendering is a manual check.

## UI automation and plumbing

Removed all eight scripts and the obsolete README under `e2e/`, the three UI test
commands, the Playwright dependency/lock entries, the browser CI job, and desktop
UI invocations in CI/release workflows. Removed the empty public test glob.
The desktop build/package jobs and backend tests remain.

## Manual coverage and remaining limits

Use [Manual testing after changes](manual-testing.md). Each handoff should include
its applicable unchecked tasks, then record outcomes when someone performs them.
For this cleanup, run the smoke checklist; before the next release, complete the
feature sections and desktop checks that previously relied on UI automation.

Source assertions for trust wiring, file-watcher wiring, streaming security
headers, API-key route wiring, and RPC startup were removed too. Existing security,
credential, lifecycle, and stream behavior tests remain, but they do not establish
complete route/wiring coverage. The checklist explicitly covers these relevant
manual behaviors; no new automated coverage is claimed.

No application runtime code changed. The UI testing policy is recorded in AGENTS.md. Pre-existing local edits to
AGENTS.md and the untracked image are outside this cleanup.

## Validation

- `npm test`: 686 passed.
- `npm run lint`: passed with no warnings.
- `node_modules/.bin/tsc --noEmit`: passed.
- `npm run test:desktop`: 4 passed, 1 skipped (packaged macOS locale check;
  no `PI_DESKTOP_RESOURCES` supplied). The existing staged runtime was used.
- CI/release YAML parsed and manifest/lock dependencies matched.
- Manual UI checks have not been performed.
