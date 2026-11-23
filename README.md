# Packlight

A minimal, offline-first packing checklist app. Expo SDK 58, React Native 0.88, TypeScript.

## Features

- Any number of packing lists, starting with a "Weekend away" example
- Add and remove items, tap to mark packed or unpacked
- Progress on every list card and on the list screen
- Rename, duplicate (resets checks), reset checks, delete
- Auto-saves to on-device storage (AsyncStorage)
- Share a list as readable text through the native share sheet
- Import a Packlight share, a Markdown checklist, or any line-by-line list

Sharing produces a portable text copy, not a live shared list. There's no account or cloud
sync; deleting the app removes its data.

## Develop from your iPhone

This repo is set up for a phone-only workflow: Claude writes and tests the code, GitHub
stores it, Expo Services builds, signs and ships it. Read
**[docs/PHONE-WORKFLOW.md](docs/PHONE-WORKFLOW.md)**.

Short version: ask Claude for a change. When it pushes to `main`, the `ship-preview`
workflow either sends an over-the-air update (JS-only change) or starts a new signed
preview build (native change) for your iPhone.

## Commands

```sh
npm install
npm run typecheck
npm test                 # model, import and export unit tests
npx expo start           # local dev server, if you ever have a computer handy
```

## Structure

- `App.tsx`: the two-screen UI, dialogs, persistence and sharing
- `src/model.ts`: pure list data and text import/export helpers
- `tests/model.test.js`: unit tests
- `.eas/workflows/`: Expo Services workflows
- `starter/`: reusable config for new Expo apps using the same workflow
- `AGENTS.md`: instructions for coding agents
