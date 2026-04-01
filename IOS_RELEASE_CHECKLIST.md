# iOS Release Checklist (Use Later)

Use this only when you are ready to pay for and publish iOS.

## A) Accounts and access

1. Confirm Apple Developer Program is active for the Apple ID you will use in build prompts.
2. Confirm this Apple ID has a Developer Team in Apple Developer Portal.

## B) App identity

1. Open `app.json`.
2. Verify `ios.bundleIdentifier` is unique and owned by your Apple Developer Team.
3. Keep `ios.buildNumber` increasing for each production build.

## C) Build on Windows with EAS cloud

1. Log in to Expo:
   - `npx eas login`
2. Ensure project is linked:
   - `npx eas init` (only if not already linked)
3. Run preview build:
   - `npm run ios:build:preview`
4. Run production build:
   - `npm run ios:build:prod`

During prompts:
1. Let EAS manage credentials unless you have existing ones.
2. Sign in with the Apple ID that has an active Developer Team.

## D) Submit and distribute

1. Submit build to App Store Connect:
   - `npm run ios:submit`
2. In App Store Connect, add app metadata, screenshots, privacy details, and age rating.
3. Start TestFlight internal testing.
4. Submit for App Review when ready.

## E) Optional Mac-only tasks

Use a Mac only if needed for:
1. Xcode-only native debugging.
2. Advanced signing/profile fixes.
3. Final sanity checks on iOS simulator/device in Xcode.

## F) Nothing wasted from free workflow

All of the following remain valid:
1. React Native code in `App.tsx` and future components.
2. TypeScript setup.
3. Expo project configuration.
4. Android/web-tested business logic and UI.
