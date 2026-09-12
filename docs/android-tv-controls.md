# Android TV remote navigation

Maxen uses `react-native` aliased to `react-native-tvos@0.81.5-2`, matching
Expo SDK 54 / React Native 0.81.5. This supplies native Pressable focus/blur
events, remote selection, TV focus commands and focus-aware virtualized lists.
The Android application continues to support phones; web keeps react-native-web.
`.npmrc` uses legacy peer resolution because npm does not consider TV fork
prerelease versions compatible with broad mobile peer ranges. Without this it
can install a second, incompatible mobile runtime under Firebase.

`TVFocusGroup` wraps `TVFocusGuideView` only on TV. Sidebar and content groups
remember the last focused child when navigation returns to them. Sidebar traps
up/down/left, but right remains an exit to content. Do not force every sidebar
button's right target to the hero, as this overrides content focus restoration.

Use `requestTVFocus(ref)` for imperative TV focus, not `View.focus()` (which is
a text-input command). Prefer native default directional search; use `nextFocus*`
only for layout-specific routes. Clear stored node handles when targets unmount.

## Verification

```sh
npx tsc --noEmit
npm run test:tv-focus
cd android
./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a
```

Install a newly built APK; the old APK and Expo Go do not contain the TV runtime.
Do not run `expo prebuild --clean` over the manually maintained Android project:
it contains custom remote-key and voice modules that must be preserved.

## Real-TV acceptance checks

- Open the home screen: an actionable control has a visible focus ring.
- Move down to cards, right past the viewport, and down across catalog rows.
  Focused cards should remain visible and navigation should not skip to the sidebar.
- From a row's first card, press left to enter the sidebar. Move up/down and press
  right: return to the remembered content item rather than always the hero.
- Switch between home/movies/series; make sure unloaded targets are not reused.
- Open details and change seasons: focus must land on an available episode.
- Open/dismiss search, filters and playback menus; test Back, OK and media keys.
- Repeat on a phone and web: touch layout and browser navigation remain unchanged.

References: [Expo TV integration](https://docs.expo.dev/guides/building-for-tv/),
[React Native TV focus APIs](https://github.com/react-native-tvos/react-native-tvos).
