# Pi Desktop

Electron app for the [Pi coding agent](https://github.com/earendil-works/pi).

- Browse and resume local sessions.
- Manage models, skills, and plugins.
- View project files, Git changes, and terminals.
- Bundled Node.js runtime.

Sessions load from `~/.pi/agent/sessions`. Set `PI_CODING_AGENT_DIR` to use another agent directory.

## Build

Requires Node.js **22.22.2**. Build on the target OS and architecture.

```sh
npm ci
npm run desktop:build
npm run desktop:dist
```

Output in `dist/`: macOS ZIP/DMG, Windows portable EXE, Linux AppImage.

Verified on Apple Silicon macOS. Windows/Linux builds are untested. macOS builds are not notarized.

## Development

```sh
npm run dev
# In another terminal:
npm run desktop:dev
```

[Testing and releases](docs/release.md)

## License

Based on [Pi Web](https://github.com/agegr/pi-web). Copyright (c) 2026 agegr.

[MIT](LICENSE) · [Third-party notices](NOTICE)
