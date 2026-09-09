# Pi Desktop

An Electron desktop application for the [Pi coding agent](https://github.com/earendil-works/pi), derived from [Pi Web by agegr](https://github.com/agegr/pi-web).

Open Pi Desktop to browse and resume local conversations, run agents, manage models and skills, inspect files and Git changes, and use the integrated terminal. The application bundles its own Node.js runtime and backend. End users do not need to install Node.js or run an npm command.

## Local sessions

Pi Desktop automatically scans `~/.pi/agent/sessions` using Pi's existing session reader. It uses the same models, credentials, settings, and sessions as the Pi CLI. Launch with `PI_CODING_AGENT_DIR` set to use a different agent directory. Sessions are read in place, without an import or migration. An empty directory opens an empty workspace; configure a provider in Settings → Models to start chatting.

The backend binds only to a random port on `127.0.0.1`, requires a per-launch token supplied by Electron, and exits when the app closes. External web links open in the system browser. The renderer is sandboxed with Node integration disabled.

Project tools such as Git and language runtimes still need to be installed when a project requires them. Node.js and npm/npx are bundled for Pi package management. Pi data stays in your user profile even when the app is moved or removed.

## Build a desktop application

Use Node.js **22.22.2** and npm for development. Build on each target OS and architecture so native modules match the bundled runtime.

```sh
npm ci
npm run desktop:build
npm run desktop:pack   # unpacked application in dist/
npm run desktop:dist   # macOS zip/dmg, Windows portable exe, Linux AppImage
```

The build downloads and checksum-verifies the official Node.js runtime. Desktop builds use `.next-desktop/`, leaving the development output in `.next/` intact. Staged resources live in `.desktop/`. `desktop:pack` and `desktop:dist` use the latest staged build; rerun `desktop:build` after source changes.

On macOS, launch `dist/mac-arm64/Pi Desktop.app` (or `dist/mac/Pi Desktop.app` for Intel). On Windows, run the portable `.exe`. On Linux, mark the AppImage executable and open it. Artifacts are unsigned unless signing credentials are configured through electron-builder; public macOS distribution also requires notarization.

## Development

```sh
npm ci
npm run dev           # local UI server on port 30141
# In another terminal:
npm run desktop:dev
```

`desktop:dev` connects to the existing development server. `npm run desktop:start` launches the staged production backend without packaging.

```sh
npm test
npm run test:desktop   # after desktop:build; tests the bundled backend
npm run test:desktop:ui # launches Electron with isolated session fixtures
node_modules/.bin/tsc --noEmit
npm run lint
```

Use Help → Open logs to inspect backend startup failures. Closing the last window quits the application and its backend.

## Layout

- `desktop/`: Electron lifecycle, isolated backend launcher, packaging configuration
- `scripts/`: desktop build and runtime bundling
- `app/`, `components/`, `hooks/`: Next.js/React interface and API routes
- `lib/`: Pi sessions, agent runtime, models, files, terminal, and Git logic
- `public/`: application assets

Browser installation, LAN launch commands, password login, PWA/service worker, Web Push, and the upstream npm update checker have been removed. Model-provider authentication remains available.

## Attribution and license

Original Pi Web software: **Copyright (c) 2026 agegr**, under the [MIT License](./LICENSE). The original copyright and full permission notice are preserved in this repository and packaged applications. See [NOTICE](./NOTICE). Desktop builds also collect dependency license texts, Electron/Chromium notices, and the Noto Sans Mono font license into the packaged `licenses/` directory. This is a separately maintained derivative; MIT permission does not transfer ownership of the original author's work.
