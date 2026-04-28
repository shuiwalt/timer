# KickTalk timer

Free Windows-first workflow using Expo + React Native + TypeScript.

## Goal

Build and test the app for free on:
- Web browser
- Android phone/emulator

Then switch to iOS release later with minimal changes.

## 1) Install and run locally on Windows

```bash
npm install
npm start
```

This opens Expo Dev Tools.

## 2) Free daily development modes

### Web mode (fastest UI iteration)

```bash
npm run web
```

### Android mode (real app behavior)

```bash
npm run android
```

You can run Android on:
- A physical Android phone with Expo Go
- Android Emulator (from Android Studio)

## 3) Recommended weekly dev loop

1. Build UI and timer behavior in web mode.
2. Validate gestures, layout, and performance in Android mode.
3. Commit frequently.
4. Keep iOS-specific release steps for later.

## 4) Keep iOS-ready now (no extra cost today)

These settings are already included so you do not lose work:
- `ios.bundleIdentifier` in `app.json`
- EAS project linked (`owner` and `extra.eas.projectId`)
- `eas.json` build profiles for future iOS builds

## 5) iOS release later

Use this checklist when you are ready:
- [iOS Release Checklist](./IOS_RELEASE_CHECKLIST.md)

## 6) Android command-line guide

Use this when you want to package, deploy, launch, or test the Android app from Windows PowerShell:
- [Android Windows Command-Line Guide](./ANDROID_WINDOWS_COMMAND_LINE_GUIDE.md)
