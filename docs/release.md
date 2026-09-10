# Desktop releases

GitHub Actions builds the application natively for macOS arm64. A tag matching the version in `package.json` publishes the DMG, ZIP, generated release notes, and `SHA256SUMS.txt` to a GitHub Release.

1. Update `version` in `package.json` and `package-lock.json`, then merge the change to `main`.
2. Tag that commit with the matching `v`-prefixed version and push the tag:

   ```sh
   git switch main
   git pull --ff-only
   git tag v0.10.0
   git push origin v0.10.0
   ```

3. Wait for the **Desktop release** workflow to finish.
4. Download the release assets and verify the hashes in `SHA256SUMS.txt`.
5. Launch the packaged application and verify session discovery, model settings, a terminal command, external links, and shutdown.

Tags that do not exactly match `package.json` fail before packaging. Versions with a prerelease suffix, such as `v0.10.0-beta.1`, create a GitHub prerelease. Run the workflow manually from the Actions tab to test the packages without creating a release.

The current packages are unsigned and macOS builds are not notarized. Configure signing before presenting the downloads as trusted production binaries.

There is no npm publish or upstream update-check workflow. The bundled Node runtime is pinned in `scripts/build-desktop.mjs`.

`LICENSE` and `NOTICE` ship with every package. Retain third-party license files in bundled dependencies and the Node distribution.
