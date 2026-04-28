# Android Windows Command-Line Guide

This guide is for `C:\shuiwaterRepo\timer` on Windows PowerShell.

Current Android app identity:

- Package name: `com.kicktalk.timer`
- Launcher activity: `com.kicktalk.timer/.MainActivity`
- Launcher label: `KickTalk timer`

Current APK output paths:

- Debug APK: `C:\shuiwaterRepo\timer\android\app\build\outputs\apk\debug\app-debug.apk`
- Release APK: `C:\shuiwaterRepo\timer\android\app\build\outputs\apk\release\app-release.apk`

Important note:

- The current `release` build is good for emulator testing and USB sideloading.
- The current `release` build still uses the debug keystore in `android/app/build.gradle`, so it is not ready for Play Store distribution yet.

## 1) One-time PowerShell setup

Open PowerShell and run:

```powershell
Set-Location C:\shuiwaterRepo\timer

$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "C:\Users\shui\AppData\Local\Android\Sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:EXPO_NO_TELEMETRY = "1"
$env:__UNSAFE_EXPO_HOME_DIRECTORY = "C:\shuiwaterRepo\timer\.expo-home"
$env:CI = "1"
```

Install dependencies if needed:

```powershell
npm install
```

If the native Android project does not exist yet, generate it:

```powershell
npx expo prebuild --platform android
```

Use this to confirm Android devices:

```powershell
& "$env:ANDROID_HOME\platform-tools\adb.exe" devices -l
```

Note:

- On this machine, `TimerManual35` has been showing up as `emulator-5554`.
- If you run multiple emulators, the serial can change, so always re-check `adb devices -l`.

## 2) Package on Windows command line

### Build a release APK

This is the best packaging flow for emulator deployment and real-device sideloading.

It produces a standalone APK, so Metro is not required to run the installed app.

```powershell
Set-Location C:\shuiwaterRepo\timer
$env:NODE_ENV = "production"
$env:GRADLE_USER_HOME = "C:\shuiwaterRepo\timer\.gradle-release"

Set-Location .\android
.\gradlew.bat --no-daemon assembleRelease
```

Output:

- `C:\shuiwaterRepo\timer\android\app\build\outputs\apk\release\app-release.apk`

### Build a debug APK

Use this when you want a debug build.

```powershell
Set-Location C:\shuiwaterRepo\timer
$env:NODE_ENV = "development"
$env:GRADLE_USER_HOME = "C:\shuiwaterRepo\timer\.gradle-debug"

Set-Location .\android
.\gradlew.bat --no-daemon assembleDebug
```

Output:

- `C:\shuiwaterRepo\timer\android\app\build\outputs\apk\debug\app-debug.apk`

## 3) Deploy to the Android simulator

### Option A: Build and install in one step

If `TimerManual35` is already running:

```powershell
Set-Location C:\shuiwaterRepo\timer
$env:NODE_ENV = "production"
$env:GRADLE_USER_HOME = "C:\shuiwaterRepo\timer\.gradle-release"

Set-Location .\android
.\gradlew.bat --no-daemon installRelease
```

This installs directly onto the connected emulator.

### Option B: Install an already-built APK with `adb`

```powershell
Set-Location C:\shuiwaterRepo\timer
$Device = "emulator-5554"

& "$env:ANDROID_HOME\platform-tools\adb.exe" -s $Device install -r `
  "C:\shuiwaterRepo\timer\android\app\build\outputs\apk\release\app-release.apk"
```

If you hit a signature conflict, uninstall first:

```powershell
& "$env:ANDROID_HOME\platform-tools\adb.exe" -s $Device uninstall com.kicktalk.timer
```

## 4) Bring `com.kicktalk.timer` up on the simulator

### Launch the app directly

```powershell
$Device = "emulator-5554"
& "$env:ANDROID_HOME\platform-tools\adb.exe" -s $Device shell am start `
  -n com.kicktalk.timer/com.kicktalk.timer.MainActivity
```

### Alternate launcher-style open

```powershell
$Device = "emulator-5554"
& "$env:ANDROID_HOME\platform-tools\adb.exe" -s $Device shell monkey `
  -p com.kicktalk.timer -c android.intent.category.LAUNCHER 1
```

### Verify the app is the focused app

```powershell
$Device = "emulator-5554"
& "$env:ANDROID_HOME\platform-tools\adb.exe" -s $Device shell dumpsys window |
  Select-String "mCurrentFocus|mFocusedApp"
```

Expected result should mention:

- `com.kicktalk.timer/.MainActivity`

### Verify the package is installed

```powershell
$Device = "emulator-5554"
& "$env:ANDROID_HOME\platform-tools\adb.exe" -s $Device shell pm path com.kicktalk.timer
```

## 5) Test on the simulator

Recommended smoke-test flow:

1. Install the latest release APK.
2. Launch `KickTalk timer`.
3. Start a timer.
4. Let it run long enough to confirm the countdown updates correctly.
5. Background the app and reopen it.
6. Confirm vibration behavior still works when the timer completes.

Useful simulator test commands:

### Clear logcat before a test

```powershell
$Device = "emulator-5554"
& "$env:ANDROID_HOME\platform-tools\adb.exe" -s $Device logcat -c
```

### Watch logs during a test

```powershell
$Device = "emulator-5554"
& "$env:ANDROID_HOME\platform-tools\adb.exe" -s $Device logcat
```

If you want a narrower view in PowerShell:

```powershell
$Device = "emulator-5554"
& "$env:ANDROID_HOME\platform-tools\adb.exe" -s $Device logcat |
  Select-String "com.kicktalk.timer|AndroidRuntime|ReactNativeJS"
```

### Reinstall quickly

```powershell
$Device = "emulator-5554"
& "$env:ANDROID_HOME\platform-tools\adb.exe" -s $Device install -r `
  "C:\shuiwaterRepo\timer\android\app\build\outputs\apk\release\app-release.apk"
```

## 6) Deploy to a real Android device

### Prepare the phone

On the Android phone:

1. Enable Developer Options.
2. Enable USB debugging.
3. Connect the phone over USB.
4. Accept the RSA trust prompt on the phone.

Confirm the device from PowerShell:

```powershell
& "$env:ANDROID_HOME\platform-tools\adb.exe" devices -l
```

Pick the real device serial from that list, for example:

```powershell
$Device = "R58XXXXXXXX"
```

### Install the release APK to the real device

```powershell
Set-Location C:\shuiwaterRepo\timer
$Device = "R58XXXXXXXX"

& "$env:ANDROID_HOME\platform-tools\adb.exe" -s $Device install -r `
  "C:\shuiwaterRepo\timer\android\app\build\outputs\apk\release\app-release.apk"
```

### Launch the app on the real device

```powershell
$Device = "R58XXXXXXXX"
& "$env:ANDROID_HOME\platform-tools\adb.exe" -s $Device shell am start `
  -n com.kicktalk.timer/com.kicktalk.timer.MainActivity
```

## 7) Fast command summary

### Package release APK

```powershell
Set-Location C:\shuiwaterRepo\timer
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "C:\Users\shui\AppData\Local\Android\Sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:EXPO_NO_TELEMETRY = "1"
$env:__UNSAFE_EXPO_HOME_DIRECTORY = "C:\shuiwaterRepo\timer\.expo-home"
$env:CI = "1"
$env:NODE_ENV = "production"
$env:GRADLE_USER_HOME = "C:\shuiwaterRepo\timer\.gradle-release"
Set-Location .\android
.\gradlew.bat --no-daemon assembleRelease
```

### Install to `TimerManual35`

```powershell
Set-Location C:\shuiwaterRepo\timer
$env:ANDROID_HOME = "C:\Users\shui\AppData\Local\Android\Sdk"
$Device = "emulator-5554"
& "$env:ANDROID_HOME\platform-tools\adb.exe" -s $Device install -r `
  "C:\shuiwaterRepo\timer\android\app\build\outputs\apk\release\app-release.apk"
```

### Open the app on `TimerManual35`

```powershell
$Device = "emulator-5554"
& "$env:ANDROID_HOME\platform-tools\adb.exe" -s $Device shell am start `
  -n com.kicktalk.timer/com.kicktalk.timer.MainActivity
```
