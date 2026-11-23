# Expo phone-first starter

Drop-in config for any new Expo app so it uses the same phone-only workflow as Packlight.
Full workflow: `docs/PHONE-WORKFLOW.md` in github.com/fvonhoven/packlight.

## Apply to a new app

```sh
npx create-expo-app@latest my-app && cd my-app
rsync -a --exclude README.md <packlight>/starter/ .   # eas.json, .eas/workflows, AGENTS.md, CLAUDE.md, .claude/
npx expo install expo-updates expo-dev-client
```

Then in `app.json`:

```json
{
  "expo": {
    "runtimeVersion": { "policy": "fingerprint" },
    "ios": {
      "bundleIdentifier": "com.fvonhoven.<slug>",
      "config": { "usesNonExemptEncryption": false }
    },
    "android": { "package": "com.fvonhoven.<slug>" },
    "extra": { "eas": { "projectId": "<from expo.dev>" } },
    "updates": { "url": "https://u.expo.dev/<projectId>" }
  }
}
```

Remove the `push:` trigger from `ship-preview.yml` until the first signed build exists
(see docs/PHONE-WORKFLOW.md, Per-app setup, step 4), then restore it.

Replace `APP_NAME` in `AGENTS.md`, add a `typecheck` and `test` script to `package.json`
(`pr-checks.yml` runs both), push, connect the repo on expo.dev, run `ios-preview.yml`.
