# APP_NAME: agent instructions

APP_NAME is an Expo app (Expo SDK 58, React Native 0.88, TypeScript).
The owner develops it entirely from an iPhone by chatting with Claude. Read
`docs/PHONE-WORKFLOW.md` in github.com/fvonhoven/packlight for the full workflow.

## Ground rules
- Don't rewrite the app. Make small, reviewable commits on `main` or a feature branch.
- Prefer local storage; no auth or backend unless the owner asks.
- Keep the UI minimal and mobile-first.
- Pure logic belongs in `src/model.ts` with tests in `tests/model.test.js`.

## Before every push
1. `npm install`
2. `npm run typecheck`
3. `npm test`
4. `npx expo install --check` and `npx --yes expo-doctor@latest`
5. `npx expo export --platform ios --output-dir /tmp/export` (proves the JS bundle builds)

Never report a build, update or install as done without checking its status (Expo MCP
`build_info` / `workflow_info`, or the Expo Services app).

## Shipping: update or new build?
Pushing to `main` runs `.eas/workflows/ship-preview.yml`, which compares the native
fingerprint with existing preview builds and picks for you:
- **EAS Update** (no reinstall): changes to JS/TS, styles, copy, images bundled by Metro.
- **New build** (reinstall from Expo Services): adding/upgrading a package with native
  code, changing `app.json` native fields (bundle id, permissions, plugins, icon, splash),
  Expo SDK upgrades.
Tell the owner which one happened and, for a new build, give the install link.

## Workflows (`.eas/workflows`)
- `ship-preview.yml`: push to main, update vs rebuild (above).
- `ios-preview.yml`: manual fresh signed preview build.
- `register-iphone-and-build.yml`: enroll a new device, then build.
- `simulator-build.yml`: unsigned simulator build for Expo cloud simulator testing.
- `pr-checks.yml`: typecheck + tests on PRs.

## Limits
- Never commit or print EXPO_TOKEN, Apple credentials, .p8 keys or provisioning files.
- Never submit to the App Store, publish to the `production` channel, or start paid cloud
  simulators/sandboxes without the owner's explicit OK.
