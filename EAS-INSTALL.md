# Install Packlight on your iPhone with Expo EAS Build

Expo's cloud build generates a standalone app you can install directly from a link. You **do not need Expo Go** for the finished preview build.

## Prerequisites

- An Expo account at https://expo.dev/ (free Expo account works for submitting builds; build limits depend on plan).
- Membership in the paid Apple Developer Program, with access to its signing credentials.
- Node.js 22.13+ and npm on any computer (macOS, Windows, or Linux).

## One-time setup

From the project folder, run:

```sh
npm install
npx eas-cli@latest login
npx eas-cli@latest build:configure
```

If EAS asks to create/link an Expo project, select **Yes**. If Apple's Developer Portal says the bundle identifier already belongs to another team, edit `ios.bundleIdentifier` in `app.json` to a unique value you control (also change `android.package` to keep the IDs aligned if desired).

## Register your iPhone

```sh
npx eas-cli@latest device:create
```

Choose the registration-link/web option if offered. Open the generated URL on your iPhone, follow the instructions to register it, and authorize Apple provisioning when prompted. **Register your iPhone before building:** the resulting IPA only installs on registered devices included in the ad hoc provisioning profile.

## Submit cloud iPhone build

```sh
npx eas-cli@latest build --platform ios --profile preview
```

Choose Expo-managed signing credentials and sign in to the correct Apple Developer team when asked. EAS will compile the app remotely; no local Xcode required.

## Install

When EAS finishes, open the generated Expo build details URL **on your iPhone**, then tap **Install**. You may need to enable iOS **Settings → Privacy & Security → Developer Mode** and restart your phone to open the app. Check Expo's current instructions if the flow differs on your iOS release.

The preview build is **standalone**: Expo Go, Metro, a running terminal, and the phone/computer being on the same Wi-Fi are not required after installation.

## Alternative: TestFlight

A TestFlight build uses the `production` profile (`npx eas-cli@latest build -p ios --profile production`) and requires App Store Connect setup and submission to TestFlight; it does not need ad hoc device registration. Use the `preview` profile for the quickest direct install on your own registered iPhone.

## Notes

- This ZIP includes EAS configuration but is **not** a compiled IPA. The cloud build has to be submitted from an authenticated Expo account.
- For an initial build, Expo may ask to create signing credentials in Apple Developer. Do not paste Apple passwords, API keys, or signing secrets into chat.
- `app.json` currently uses `com.fvonhoven.packlight` as a suggested example bundle ID. Change it if it is not appropriate to your Apple Developer team.
