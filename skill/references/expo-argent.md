# Capture Expo simulator evidence with Argent

Use this workflow for Expo apps on an iOS Simulator or Android Emulator. Argent owns device setup, app control, screenshots, and recordings. This skill only defines the evidence that the GitHub PR needs.

## Prepare the app

1. Confirm that Argent MCP tools and the matching Argent skills are available. If they are absent, tell the user to run `argent init` from the Expo project root and restart the agent. Continue without capture only when the required media already exists.
2. Read the project's configured start and build commands before running the app. Prefer project scripts. When the project has no custom command, use `bun expo run:ios`, `bun expo run:android`, or `bun expo start` for an existing development build or Expo Go.
3. Follow `argent-react-native-app-workflow` for Metro and app startup. Call `list-devices` before booting, running, or interacting with an app. Select the requested device, or prefer an already running device when the user did not name one.
4. Load the platform setup skill when the selected device is not ready. Use `argent-ios-simulator-setup` for iOS and `argent-android-emulator-setup` for Android.

The app is ready when Argent can launch it and the expected screen appears in `describe` or `debugger-component-tree`.

## Reach the evidence state

Follow `argent-device-interact` for app launch, discovery, gestures, typing, and waits. Use the accessibility or React component tree to select controls. Take tap coordinates from the returned element tree, never from screenshot pixels.

Before each capture, wait for the expected UI element and confirm that the screen is stable. Reject loading states, error screens, permission prompts, debug overlays, and stale bundles unless the PR is meant to show one of those states.

For a before/after pair, keep these conditions equal:

- simulator or emulator model and OS version;
- orientation, appearance, locale, and text scale;
- app route, scroll position, selected state, and input data;
- authentication, permissions, seeded data, and feature flags;
- animation start or end state.

After a JavaScript-only change, reload Metro before reaching the after state. After a native or configuration change, rebuild and reinstall with the project's normal command.

## Capture screenshots

Capture the final frame at native resolution with Argent `screenshot`:

```json
{ "udid": "<device-id>", "scale": 1.0, "includeImageInContext": false }
```

Use the returned artifact path and copy the file into the repository. Use explicit platform names such as `captures/ios-before.png`, `captures/ios-after.png`, `captures/android-before.png`, and `captures/android-after.png`.

Confirm that both files in a pair have the same pixel dimensions. If they differ, correct the simulator, orientation, or capture state and capture again. Do not pad native screenshots to hide a device mismatch.

## Capture recordings

Follow `argent-screen-recording`. Start a short recording with a time limit above the expected interaction, set the required stop reminder, run the interaction, then call `screen-recording-stop` with the same device id. Use `showTouches: false` for clean product evidence and `showTouches: true` when the touch path is part of the proof.

Copy the returned video path into the repository under `captures/`. Some MCP clients return it as `video`; clients that expose an artifact object return `video.hostPath`. Argent records supported iOS Simulators and Android Emulators as H.264 MP4 at 30 fps. Check any returned warning and verify that the file plays before formatting it.

## Label the evidence

Use `iOS` and `Android` as labels when both platforms appear. Use the device name when the exact form factor matters. Keep the strongest evidence first, then add the second platform or a recording only when it proves a separate behavior.
