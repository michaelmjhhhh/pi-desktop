# Desktop releases

1. On the target OS/architecture, install Node 22.22.2 and run `npm ci`.
2. Run `npm test`, `npm run test:desktop`, `npm run lint`, and `node_modules/.bin/tsc --noEmit`.
3. Run `npm run desktop:build` then `npm run desktop:dist`.
4. Launch the packaged artifact and verify session discovery, model settings, a terminal command, external links, and shutdown.
5. Distribute the artifacts from `dist/` after signing/notarization where required.

There is no npm publish or upstream update-check workflow. Build each OS and architecture natively; the bundled Node runtime is pinned in `scripts/build-desktop.mjs`.

`LICENSE` and `NOTICE` ship with every package. Retain third-party license files in bundled dependencies and the Node distribution.
