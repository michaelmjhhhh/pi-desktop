# Manual testing after changes

After each change, include a to-do list in the handoff using the smoke checks and
only the sections affected by that change. Record pass/fail, app version or commit,
platform, and any skipped checks with their reason. These are manual checks, not
an automation script. Unchecked items have not been verified.

Use a disposable project and sessions for editing/deleting data. Reuse the healthy
local dev server on port 30141; follow AGENTS.md before starting or restarting it.
For layout changes, repeat affected checks in light/dark themes and at wide and
compact window sizes (approximately 1280×900 and 900×640).

## After every change

- [ ] Open the app, select a project and existing session, and confirm the history and composer load without an error overlay.
- [ ] Create a draft, switch sessions and return; confirm its text and attachments survive.
- [ ] Exercise the changed feature through its normal path and one relevant error/cancel path; confirm the app remains usable afterward.
- [ ] Reload and confirm any changed saved setting or state persists as expected. Check the browser console/backend log for new errors.

## Chat, history, and models

- [ ] Send a prompt, observe streamed text and tool progress, stop a run, then send another prompt. Confirm no duplicate user message or stuck running indicator.
- [ ] Queue a follow-up with Alt/Option+Enter; use Shift+Enter for a newline and compose text with an IME. Confirm completion menus and Enter submission still work.
- [ ] Open a long session, scroll upward through at least two older pages, and reach the start of a short session. Confirm no gaps, duplicate messages, or unexpected scroll jumps.
- [ ] Switch away while reading older history, then return. Confirm the reading position is restored. Change branches while older history is loading; confirm the selected branch remains visible.
- [ ] Expand thinking/tool/process details, including a completed turn without a final answer. Navigate a minimap heading in a compacted session; confirm the correct content is reached.
- [ ] Quote selected assistant text into the composer and into a new branched chat. Confirm the quote and selected history match and the source chat remains intact.
- [ ] Select a model and thinking level for a new and an existing session. Confirm pending switches cannot be submitted twice, and errors remain visible and recover on retry.
- [ ] Simulate a failed prompt request using browser network controls; return online and retry. Confirm the draft and images remain recoverable without duplicating an accepted message.
- [ ] Switch between Default, Read-only, and Chat only tool presets; reload the session and confirm its selection is retained. Open System and Tools in a dormant session and confirm no prompt is sent.

## Files and rendered content

- [ ] Search files, expand result folders, open a result, insert a mention, and download it. Clear the search and confirm the normal tree returns; a failed search should show an error.
- [ ] Open multiple file tabs, change preview/source mode, wrapping, and scroll position; switch tabs and close/reopen the panel. Confirm each tab retains its own state.
- [ ] Edit or replace an open file in another editor, then refocus/reopen its tab. Confirm the contents refresh. Repeat with a temporarily missing file recreated at the same path.
- [ ] View a large source file and Markdown containing tables, code, math, and local/external links. Confirm readable layout, responsive scrolling, and correct link destinations.
- [ ] Preview an image from a user message and an extension message. Close with Escape and the backdrop; confirm focus returns to the trigger and no chat shortcut fires.
- [ ] Preview a Mermaid diagram containing Chinese text; toggle source/preview and download the SVG. Open the download and confirm the diagram and labels render.
- [ ] Complete a write/edit tool call and click its written-file button. Confirm it opens the correct path; failed writes should not appear as successful outputs.
- [ ] When file-serving code changes, inspect a file response in browser Network tools: `X-Content-Type-Options` must be `nosniff`; inline SVG must have a script-blocking Content-Security-Policy. Confirm an outside-project file request is rejected.

## Settings and workspace navigation

- [ ] Open General, Models, Skills, Sub-agents, and Plugins from sidebar shortcuts. Confirm one settings panel opens and switching sections preserves the current selection and unsaved fields.
- [ ] Change chat width/font size with an existing draft; confirm both messages and composer resize. Reload and confirm persistence. At a compact window size, scroll to every language option.
- [ ] Switch light/dark using mouse and keyboard. Confirm focus, readable text, visible selection, and persistence; Escape closes the menu without aborting a run.
- [ ] Add/edit provider and model headers, pricing, developer-role compatibility, and thinking overrides in a disposable configuration. Save/reopen and confirm values, row order, and explicit disabled overrides persist.
- [ ] Create same-name global/project sub-agent profiles, toggle enabled state, duplicate and delete a disposable profile. Confirm scope identity, override indication, read-only controls, and deletion confirmation.
- [ ] Toggle skill dormancy and confirm ordering and slash-command selection; enable/disable the built-in sub-agent feature and reload the session to apply it.
- [ ] Change project/worktree, return, then select New. Confirm the correct remembered session, project identity, and parked draft are restored.
- [ ] Rename and delete a disposable session; normal delete asks for confirmation and Shift+click bypasses it. Verify a second window discovers creation, rename, deletion, and running-state changes.
- [ ] After trust-related changes, open an untrusted disposable project containing an extension. Confirm it cannot run before trust is granted, then grant trust and reload. Confirm the extension becomes available.

## Extensions and notifications

Use an installed local extension that offers the relevant dialog/widget. If none
is available, record the check as skipped; do not count it as passed.

- [ ] Open an extension select/input/confirm dialog; use arrows, Enter, and Escape. Collapse and reopen it; confirm the draft survives and the composer remains accessible.
- [ ] Allow a timed dialog to expire. Confirm its countdown and expiry resolve the request; opening another dialog resets its collapsed state.
- [ ] Display long multiline status text and short/long widgets. Confirm scrolling, expand/collapse, at most one expanded widget, and updated content without leaking internal status keys.
- [ ] Trigger a notice, hover or keyboard-focus it, and scroll long content. Confirm expiry pauses while interacting and resumes afterward.
- [ ] With notifications enabled, trigger a background completion/blocking request and click its notification. Confirm the originating session opens without duplicate attention. Confirm sub-agent completion remains silent.
- [ ] Open the agent-session selector during and after a sub-agent run. Confirm the main session stays accessible and running/completed states and search are correct.

## Terminal

- [ ] Open a terminal, run `pwd`, and confirm its project directory. Type rapidly and paste Unicode text; confirm ordered input and readable output.
- [ ] Start a long-running command, hide/show the panel, switch sessions/workspaces, and promptly reload. Confirm the original shell reconnects and output is not duplicated.
- [ ] Resize the terminal with pointer and keyboard, including at a compact window size. Confirm the terminal fits the panel and the page has no horizontal overflow.
- [ ] Create terminal tabs in two workspaces, switch between them, and confirm each retains its own shell and directory.
- [ ] Close a terminal tab and confirm its process stops; close all tabs and confirm a new terminal can be created. Confirm failure messages include useful diagnostics.

## Desktop shell and releases

- [ ] Launch the staged or packaged app; verify session discovery and a terminal command. Confirm new sessions created elsewhere appear without restarting the app.
- [ ] Open an external link and confirm it reaches the OS browser. Navigate between sessions and confirm internal history stays inside the app.
- [ ] Copy and paste a message, then verify notification permission and notification-click routing on the target OS.
- [ ] At minimum window size and different zoom levels, use menus, scroll settings, and resize panels with keyboard and pointer. Confirm the composer draft remains intact.
- [ ] Quit and relaunch; confirm saved layout/settings return and the old backend/terminal processes have shut down.

## SF Pro and sidebar clarity

- [ ] On macOS, confirm navigation, messages, and composer use SF Pro; code blocks and terminal remain monospace. On other platforms, confirm the system sans-serif fallback is readable.
- [ ] At wide and compact sizes in both themes, rapidly scroll a long session list with Files expanded and collapsed. Confirm rows stay visible, no horizontal scroll appears, and the header and Files controls remain reachable. Search sessions and clear the search; confirm scrolling still works.
- [ ] Scroll with the pointer over the conversation marker rail; confirm history moves. Open its preview and scroll to another turn while a reply streams; confirm the preview keeps its reading position and does not scroll the underlying conversation.
- [ ] Resize the chat with the file panel open; confirm the navigator preview fits inside the chat, its headings navigate correctly, and keyboard navigation still works.
- [ ] Expand Usage and Process details; confirm tokens, costs, and tool output remain available. Tab to Copy and activate it; verify the copied answer. Confirm the composer and last reply have clear separation.

## Narrow chat with both side panels open

- [ ] Open the sidebar and file panel, then reload with the saved wide file panel. Confirm the file panel occupies no more than half the space remaining beside the sidebar in desktop split mode.
- [ ] Drag each divider, then resize the window across the compact/desktop breakpoint; repeat with keyboard arrows. Confirm the conversation stays usable and the file panel uses an overlay in compact windows.
- [ ] At the narrowest chat width, check a long model name and all composer controls (thinking, tools, compact, sound). Controls should wrap inside the composer; all buttons and menus remain reachable. Repeat during streaming with Steer, Follow-up, and Stop.
- [ ] Scroll a long answer with a wide table. Only the table should scroll horizontally; the composer remains contained and the header leaves room for the session title.
- [ ] Repeat in both themes and with an increased chat font size. Preserve a draft while toggling panels and reloading.

## Thread sidebar cards

- [ ] Select several threads: the selected row becomes a rounded project/title/branch card, while other rows show one title line and a short age. Confirm the correct thread opens with mouse and keyboard.
- [ ] Hover and Tab through rows: small rename/delete actions replace the trailing timestamp without shifting or shortening the title. Rename a disposable thread and cancel a rename with Escape. Delete another disposable thread and verify Cancel and Shift+click behavior.
- [ ] With many threads, scroll rapidly past the selected card at the top, middle, and end of the list. Confirm no gaps, overlaps, or missing rows, including while an inline rename has focus.
- [ ] Narrow the sidebar to its minimum width and repeat in both themes. Check long project names, titles, branches, and the delete confirmation. Running/unread indicators should remain visible.
- [ ] Search and clear the query; switch projects, reload, and confirm selection and the existing sidebar scroll behavior remain usable.

## Reference sidebar structure

- [ ] Confirm Search and the project picker are the only top navigation rows. The default filter is All projects; selecting one filters the threads correctly. New thread and Add project remain functional.
- [ ] Confirm selected/running/unread session families appear as full cards above Settled. Select a settled thread and confirm it becomes a full card; read a background completion and confirm its unread indicator clears.
- [ ] Collapse and expand Settled with mouse and keyboard. Scroll a long list with several full cards above it; no gaps or overlapping rows should appear. Rename/delete a disposable settled thread and cancel the action.
- [ ] Select a git project, reopen its project menu, and use the embedded worktree picker. Confirm worktree creation, cancellation, and switching are still reachable without clipping the menu.
- [ ] Compare spacing and alignment to the supplied screenshot at normal/minimum sidebar widths in both themes. Confirm font size, timestamps, selected card, and the Settled divider remain readable.
