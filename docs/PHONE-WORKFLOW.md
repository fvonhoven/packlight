# Phone-only Expo workflow

Build, test and ship Expo apps from an iPhone: chat with Claude, keep code in GitHub,
build and update with Expo Services (EAS). No Mac or local terminal.

## How the pieces fit

| Piece | Role |
| --- | --- |
| Claude (iPhone app, cloud coding session) | Writes code, runs typecheck/tests, commits, pushes, triggers and inspects builds through the Expo connector |
| GitHub | Source of truth. Pushes to `main` trigger EAS Workflows |
| Expo Services (EAS) | Cloud builds, signing, OTA updates, workflows, cloud simulators |
| Expo Services iPhone app | Build status, notifications, logs, install builds, rerun workflows |
| Apple Developer account | Signing. Expo talks to Apple through an App Store Connect API key |

## One-time account setup (do once, ever)

1. **Expo Services iPhone app**: install from the App Store, sign in, allow notifications.
2. **Claude connectors**: in Claude settings, keep **Expo** and **GitHub** connected.
3. **App Store Connect API key**: appstoreconnect.apple.com > Users and Access >
   Integrations > Team Keys > generate (Admin role). Download the .p8 to Files (one chance).
   On expo.dev > account > Credentials > iOS, add it with its Key ID and Issuer ID.
   Never paste the key into chat.
4. **Register your iPhone** (once per device): run the `register-iphone-and-build`
   workflow from the Expo Services app, open the enrollment link on the iPhone, install the
   profile (Settings > General > VPN & Device Management), then approve the device on
   expo.dev. Afterwards enable Settings > Privacy & Security > Developer Mode and restart
   when iOS asks.

## Per-app setup

1. github.com/new: create an empty repo (no README). Pick **Private** if you want it private.
   Then tell Claude the name; Claude attaches it and pushes.
2. expo.dev > Projects > Create project with the same slug. Give Claude the Project ID.
3. expo.dev > project > Project settings > GitHub > connect the repo.
4. **First signed build (the one step that needs a terminal, once per app):** Expo will not
   create a new app's certificate and ad hoc profile unattended. From any terminal:
   `EXPO_NO_KEYCHAIN=1 npx eas-cli@latest build -p ios --profile preview`, sign in to
   Apple, say yes to generating credentials, pick your iPhone. Every later build and
   update runs from the cloud.
5. Install the build from the Expo Services app.

### Things learned the hard way (Packlight, Nov 2026)
- Claude's Expo connector has view/run access only. It can read builds, logs and
  workflows, but Expo refuses builds it starts ("Entity Not Authorized ... CREATE").
  Builds that matter are started by **pushes to main** (Expo's GitHub app has full
  access) or by tapping **Run** on a workflow at expo.dev / in Expo Services.
- Claude sessions can't create GitHub repos or Expo projects; those are steps 1 and 2.
- Builds past the plan's included credits are billed pay-as-you-go. Keep automatic
  rebuilds off until step 4 has succeeded, or every push burns a failing build.
- Builds only refresh the ad hoc profile in `register-iphone-and-build.yml`. That refresh
  needs the App Store Connect key **assigned to the app** (expo.dev > project >
  Credentials > iOS > App Store Connect API Key), not just stored on the account.
  Without it the build fails with "No App Store Connect API Key found for ad-hoc
  provisioning profile refresh".
- If `eas` fails Apple login with "Received undefined", it's a stale Keychain password
  or an old CLI: use `EXPO_NO_KEYCHAIN=1 npx eas-cli@latest`.

## Daily loop

Ask Claude something like:

> Update Packlight with feature X. Test it and send the update to my iPhone.

Claude will:
1. Make the change, run `typecheck`, `test`, `expo-doctor`, and an iOS bundle export.
2. Commit and push to `main`.
3. `ship-preview.yml` fingerprints the native layer:
   - **Same fingerprint**: publishes an EAS Update to the `preview` channel. Close and
     reopen the app twice (first launch downloads, second applies).
   - **New fingerprint**: starts a signed preview build. Install it from Expo Services
     when it finishes.
4. Check the workflow result and tell you which path ran.

### What forces a new build
New or upgraded native packages, `app.json` native fields (bundle id, permissions,
plugins, icon, splash, URL scheme), Expo SDK upgrades. Everything else ships as an update.

## New app recipe

> Create a new Expo app that does X. Build it, test it, and give me an installation link.

Claude will:
1. Scaffold with `npx create-expo-app@latest`, then copy in `starter/` from this repo
   (eas.json, workflows, AGENTS.md, .claude settings).
2. Set `ios.bundleIdentifier` to `com.fvonhoven.<slug>`, `runtimeVersion` fingerprint
   policy, install `expo-updates` and `expo-dev-client`.
3. Ask you for the two Safari steps above (repo, Expo project).
4. Push, run `ios-preview.yml`, watch logs, fix failures, return the install link.

Device registration and the API key carry over: same Apple team, same iPhone.

## Build profiles (`eas.json`)

| Profile | Use |
| --- | --- |
| `development` | Dev client for live reload against a dev server |
| `development-simulator` | Same, for cloud simulators |
| `preview` | **Default.** Signed ad hoc build for your iPhone, `preview` update channel |
| `preview-simulator` | Unsigned simulator build for Expo cloud simulator testing |
| `production` | App Store / TestFlight. Only with explicit approval |

App versions are stored remotely (`appVersionSource: remote`); production auto-increments.

## Secrets

- Never in git or chat: Apple password, .p8 keys, EXPO_TOKEN, certificates.
- Apple signing: Expo-managed credentials plus the App Store Connect API key on expo.dev.
- App secrets: expo.dev > project > Environment variables (development / preview /
  production). Use **Secret** visibility. `EXPO_PUBLIC_*` values end up in the app bundle,
  so never put secrets there.

## Testing

- Every push: typecheck, unit tests, expo-doctor, bundle export (run by Claude).
- PRs: `pr-checks.yml` runs typecheck and tests in Expo Workflows.
- Visual QA: `simulator-build.yml`, then start an Expo cloud simulator on the build
  (paid Expo plan; Claude asks before starting one).

## Release to the App Store (only on request)

1. Bump `version` in `app.json` if needed.
2. Build with the `production` profile; submit with `eas submit` (TestFlight first).
3. OTA updates to production users go to the `production` channel.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| "Install" fails or app won't open | Device not in the ad hoc profile: rerun `register-iphone-and-build`. Check Developer Mode is on |
| Update doesn't appear | Reopen the app twice. Check the build's channel is `preview` and fingerprint matches |
| Build fails at signing | API key missing or wrong role on expo.dev Credentials |
| Workflow didn't trigger on push | GitHub repo not connected in Project settings > GitHub |
