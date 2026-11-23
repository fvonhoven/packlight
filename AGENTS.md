# Packlight: cloud-first Expo app

- Target Expo SDK 58 and React Native 0.88; follow official SDK 58 docs.
- Install dependencies using `npm install`, then run `npm run typecheck` and `npm test`.
- Use `npx --yes @expo/agent-cli@latest status` before choosing a development workflow.
- The official Expo agent instructions can be set up with `npx --yes @expo/agent-cli@latest agents:setup`.
- EAS workflows live in `.eas/workflows`. Do not submit a cloud build or start paid cloud simulators without user approval.
- Preview builds: run `ios-preview.yml` with Expo Workflows or Expo MCP; physical-device registration uses `register-iphone-and-build.yml`.
- Prefer EAS Update on the `preview` channel for JS-only changes after installing and configuring `expo-updates`; native changes require a new build.
- Do not commit EXPO_TOKEN, Apple credentials, Expo project secrets or provisioning files.
- If a tool is missing, follow `https://docs.expo.dev/agents/codex/` and `https://docs.expo.dev/mcp/`.
