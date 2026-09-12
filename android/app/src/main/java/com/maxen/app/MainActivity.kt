package com.maxen.app
import expo.modules.splashscreen.SplashScreenManager

import android.os.Build
import android.os.Bundle

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    // Set the theme to AppTheme BEFORE onCreate to support
    // coloring the background, status bar, and navigation bar.
    // This is required for expo-splash-screen.
    // setTheme(R.style.AppTheme);
    // @generated begin expo-splashscreen - expo prebuild (DO NOT MODIFY) sync-f3ff59a738c56c9a6119210cb55f0b613eb8b6af
    SplashScreenManager.registerOnActivity(this)
    // @generated end expo-splashscreen
    super.onCreate(null)
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "main"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
          this,
          BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
          object : DefaultReactActivityDelegate(
              this,
              mainComponentName,
              fabricEnabled
          ){})
  }

  /**
    * Align the back button behavior with Android S
    * where moving root activities to background instead of finishing activities.
    * @see <a href="https://developer.android.com/reference/android/app/Activity#onBackPressed()">onBackPressed</a>
    */
  override fun invokeDefaultOnBackPressed() {
      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
          if (!moveTaskToBack(false)) {
              // For non-root activities, use the default implementation to finish them.
              super.invokeDefaultOnBackPressed()
          }
          return
      }

      // Use the default back button implementation on Android S
      // because it's doing more than [Activity.moveTaskToBack] in fact.
      super.invokeDefaultOnBackPressed()
  }

  /**
   * Dispatches physical remote and media key events to React Native (DeviceEventEmitter 'TVKeyEvent')
   * to ensure media controls (Play/Pause, Rewind, Fast Forward, Channel Up/Down) work seamlessly on Android TV.
   */
  override fun dispatchKeyEvent(event: android.view.KeyEvent): Boolean {
    if (event.action == android.view.KeyEvent.ACTION_DOWN && event.repeatCount == 0) {
      val eventType = when (event.keyCode) {
        android.view.KeyEvent.KEYCODE_DPAD_UP -> "up"
        android.view.KeyEvent.KEYCODE_DPAD_DOWN -> "down"
        android.view.KeyEvent.KEYCODE_DPAD_LEFT -> "left"
        android.view.KeyEvent.KEYCODE_DPAD_RIGHT -> "right"
        android.view.KeyEvent.KEYCODE_DPAD_CENTER,
        android.view.KeyEvent.KEYCODE_ENTER,
        android.view.KeyEvent.KEYCODE_NUMPAD_ENTER -> "select"
        android.view.KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE,
        android.view.KeyEvent.KEYCODE_HEADSETHOOK -> "playPause"
        android.view.KeyEvent.KEYCODE_MEDIA_PLAY -> "play"
        android.view.KeyEvent.KEYCODE_MEDIA_PAUSE -> "pause"
        android.view.KeyEvent.KEYCODE_MEDIA_FAST_FORWARD,
        android.view.KeyEvent.KEYCODE_MEDIA_SKIP_FORWARD -> "fastForward"
        android.view.KeyEvent.KEYCODE_MEDIA_REWIND,
        android.view.KeyEvent.KEYCODE_MEDIA_SKIP_BACKWARD -> "rewind"
        android.view.KeyEvent.KEYCODE_MEDIA_NEXT,
        android.view.KeyEvent.KEYCODE_CHANNEL_UP -> "channelUp"
        android.view.KeyEvent.KEYCODE_MEDIA_PREVIOUS,
        android.view.KeyEvent.KEYCODE_CHANNEL_DOWN -> "channelDown"
        android.view.KeyEvent.KEYCODE_MENU -> "menu"
        android.view.KeyEvent.KEYCODE_INFO -> "info"
        else -> null
      }

      if (eventType != null) {
        emitTvKeyEvent(eventType, event.keyCode, event.action)
      }
    }

    val isMediaShortcut = when (event.keyCode) {
      android.view.KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE,
      android.view.KeyEvent.KEYCODE_HEADSETHOOK,
      android.view.KeyEvent.KEYCODE_MEDIA_PLAY,
      android.view.KeyEvent.KEYCODE_MEDIA_PAUSE,
      android.view.KeyEvent.KEYCODE_MEDIA_FAST_FORWARD,
      android.view.KeyEvent.KEYCODE_MEDIA_SKIP_FORWARD,
      android.view.KeyEvent.KEYCODE_MEDIA_REWIND,
      android.view.KeyEvent.KEYCODE_MEDIA_SKIP_BACKWARD,
      android.view.KeyEvent.KEYCODE_MEDIA_NEXT,
      android.view.KeyEvent.KEYCODE_MEDIA_PREVIOUS,
      android.view.KeyEvent.KEYCODE_CHANNEL_UP,
      android.view.KeyEvent.KEYCODE_CHANNEL_DOWN,
      android.view.KeyEvent.KEYCODE_MENU,
      android.view.KeyEvent.KEYCODE_INFO -> true
      else -> false
    }
    if (isMediaShortcut) return true
    return super.dispatchKeyEvent(event)
  }

  private fun emitTvKeyEvent(eventType: String, keyCode: Int, action: Int) {
    try {
      val reactContext = try {
        (application as? com.facebook.react.ReactApplication)?.reactHost?.currentReactContext
          ?: reactInstanceManager?.currentReactContext
      } catch (e: Throwable) {
        reactInstanceManager?.currentReactContext
      }

      if (reactContext != null && reactContext.hasActiveReactInstance()) {
        val params = com.facebook.react.bridge.Arguments.createMap().apply {
          putString("eventType", eventType)
          putInt("keyCode", keyCode)
          putInt("action", action)
        }
        reactContext
          .getJSModule(com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
          ?.emit("TVKeyEvent", params)
      }
    } catch (ignored: Throwable) {
      // Ignore key delivery if React context isn't ready
    }
  }
}
