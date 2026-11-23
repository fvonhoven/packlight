# Build and install Expo apps using only your iPhone (after account bootstrap)

## 1. Install the mobile control panel

Install **Expo Services**: https://apps.apple.com/us/app/expo-services/id6822373026
Sign in with your Expo account. It can start/rerun workflows, inspect logs, install internal builds, and launch cloud simulators. Cloud Simulators require an eligible paid Expo plan.

## 2. Give a cloud coding agent your source code

Create a GitHub repo for this project, and use Codex Cloud (if available in your ChatGPT app) or a comparable cloud coding agent with GitHub write access. The cloud environment must support Node, npm, GitHub, and Expo authentication. Move all files from this ZIP's `packlight-expo` directory to the repository root (NOT as a single ZIP). Set up an Expo account at https://expo.dev.

## 3. First-time EAS / signing bootstrap, using the cloud environment

Have the agent run `npm install`, `npm run typecheck`, `npm test`, and `npx --yes @expo/agent-cli@latest status`. Resolve errors first. Link your Expo project with `npx eas-cli@latest init` (or use EAS CLI's recommended create/link procedure); follow any interactive Expo OAuth prompts yourself. Run `npx eas-cli@latest credentials:configure-build -p ios -e preview` to configure EAS-managed credentials. This may require you to authenticate with Apple Developer securely. Do not paste account credentials, one-time codes or tokens into an AI conversation. Setup may need a cloud terminal with interactive authentication; MCP alone may not handle initial provisioning.

In expo.dev > Project > GitHub settings, install the Expo GitHub App and link this repository. The MCP `build_run` tool requires a connected GitHub repository.

## 4. Register your phone and install

From Expo Services, run `.eas/workflows/register-iphone-and-build.yml` (or ask your Expo-connected agent to run it). Open the device registration link on your iPhone, install the device registration profile under Settings when prompted, then approve the device in your Expo dashboard. The workflow includes a new ad hoc provisioning profile and builds the installable app. It requires an App Store Connect API key configured in Expo Services for non-interactive profile refreshing.

If this workflow is blocked by credentials or API-key setup, use the cloud terminal's interactive `npx eas-cli@latest device:create` followed by `npx eas-cli@latest build -p ios --profile preview`, which lets Expo prompt for Apple's credentials. Register before the build.

Find the finished build in Expo Services > Builds, tap Install on your registered iPhone and enable Settings > Privacy & Security > Developer Mode if requested. A signed internal preview build runs standalone; Expo Go and a Mac are not required.

## 5. Repeated no-desktop loop

1. Prompt Codex Cloud (or another GitHub-connected coding agent) to make a feature change, run tests, and commit/push it.
2. If only JS/assets/styles changed, configure `expo-updates` once (`npx expo install expo-updates` and `npx eas-cli@latest update:configure`) and publish an EAS Update to channel `preview`, ideally after checks. The installed app receives compatible updates on launch.
3. For native dependencies, app permissions, or major SDK changes, run `.eas/workflows/ios-preview.yml` via Expo Services or Expo MCP; install the new build from the iPhone app.
4. For visual QA, start a cloud simulator from Expo Services (paid Expo plan).

## Notes

- This starter ZIP is NOT signed, built, uploaded to GitHub, or linked to an Expo account.
- `com.fvonhoven.packlight` is the example iOS bundle identifier. Confirm it is yours before provisioning.
- Avoid automatic builds on each commit: cloud builds consume quota. The included workflows are manual on purpose.
- Expo Agent (the old `agent.expo.dev` beta) was discontinued July 2026. Use Expo MCP / Skills and a cloud coding agent instead.

Official docs:
- https://docs.expo.dev/eas/workflows/get-started/
- https://docs.expo.dev/eas/workflows/pre-packaged-jobs/
- https://docs.expo.dev/build/internal-distribution/
- https://docs.expo.dev/mcp/
- https://expo.dev/blog/introducing-expo-agent-cli
