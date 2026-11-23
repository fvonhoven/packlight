# Packlight — Expo packing list app

A minimalist, offline-first packing checklist built with Expo, React Native, and TypeScript.

## Features

- Create any number of packing lists, with a starter “Weekend away” example.
- Add/remove items and tap to mark each as packed or unpacked.
- See progress on every list and on the packing screen.
- Rename, duplicate (resets checkmarks), reset, or delete lists.
- Automatically save all lists to on-device AsyncStorage.
- Share any list as a formatted checklist through your phone’s native share sheet (Messages, Mail, WhatsApp, etc.).
- Import a received Packlight text share, a Markdown checklist, or any line-by-line list through **Import** on the home screen. This creates an independent local copy.

## Install on your iPhone with EAS Build

See **[EAS-INSTALL.md](EAS-INSTALL.md)** for cloud-build setup and a shareable iPhone install link. The `preview` profile in `eas.json` is configured for internal/ad hoc iOS distribution.

## Run it

Requirements: Node.js 22.13+ and the current Expo Go app on your phone (Expo SDK 58).

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go (Android) or with your iPhone camera/Expo Go as prompted by Expo. The dev computer and phone usually need to be on the same network. If not, try `npx expo start --tunnel`.

Use `npm run ios` for an installed iOS simulator or `npm run android` for an Android emulator.

Run `npm test` for model/import/export unit tests and `npm run typecheck` for TypeScript checks.

## How sharing works

Tap **Share** on an open list. Packlight invokes the operating system's share sheet with human-readable text. The recipient does **not** need Packlight to read it. To add it to their own Packlight app, they can copy that shared text and use **Import**. Items marked packed are retained on import.

**Scope:** This MVP uses on-device storage only. Sharing creates a portable text copy — it does not create an online, real-time collaborative list or a public web link. Deleting the app may remove saved data; there is no account sync or cloud backup.

## Project structure

- `App.tsx` — complete two-screen UI, dialogs, persistence, and native sharing.
- `src/model.ts` — pure packing-list data and text import/export helpers.
- `tests/model.test.js` — unit tests for the list format and parser.

## Next steps, if needed

For live shared lists with multi-device edits, add authentication and a cloud database (for example Supabase or Firebase) and send invite links. For a native release, run EAS Build and configure app IDs/branding.
