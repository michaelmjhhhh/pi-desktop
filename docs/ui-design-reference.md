# UI design reference

This refinement follows the visual system in [T3 Code](https://github.com/pingdotgg/t3code/tree/50ff4c371eab927a9650c114975241999f4cd7b1), inspected on 2026-09-15.

- [Standard palettes](https://github.com/pingdotgg/t3code/blob/50ff4c371eab927a9650c114975241999f4cd7b1/apps/web/src/themePalette.ts): neutral canvas/sidebar/surface roles, subtle borders, restrained blue accents. Pi keeps brighter dark-theme foregrounds for readability.
- [Typography](https://github.com/pingdotgg/t3code/blob/50ff4c371eab927a9650c114975241999f4cd7b1/apps/web/src/appearanceFonts.ts): system sans-serif for the interface and monospace for code. SF Pro remains the requested macOS default, with SF Mono for code and existing fallback fonts.
- [Shared geometry](https://github.com/pingdotgg/t3code/blob/50ff4c371eab927a9650c114975241999f4cd7b1/apps/web/src/index.css): 8px control corners, compact sidebar insets, and 52px workspace headers.
- [Composer surface](https://github.com/pingdotgg/t3code/blob/50ff4c371eab927a9650c114975241999f4cd7b1/apps/web/src/components/chat/ComposerSurface.tsx): a rounded raised surface is the primary focus. Secondary tools are progressively disclosed through Options.

The implementation uses Pi Desktop's existing components and preserves its project/session model, split-panel constraints, shortcuts, and settings. Visual verification is manual under AGENTS.md; see docs/manual-testing.md.
