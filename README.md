# SimpleosV2

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.0.0-next.4.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:42024/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the desktop app for your own machine:

```bash
bun install
bun run tauri:build
```

That produces an NSIS installer on Windows, an AppImage and `.deb` on Linux, and an
unnotarized `.app`/`.dmg` on macOS, under `src-tauri/target/release/bundle/`. No signing
key of any kind is required.

A self-built app **still receives official updates**: update verification uses the
public key committed in `src-tauri/tauri.conf.json`, so a build from this repo trusts
the same signed releases as a downloaded one. It just cannot be published as an update
itself, since nothing signed its artifacts. See
[docs/releasing-updates.md](docs/releasing-updates.md) for how releases are cut and how
to rehearse the update flow locally.

To build only the Angular bundle (no desktop shell):

```bash
bun run build
```

This compiles the frontend into `dist/simpleos/browser`.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
