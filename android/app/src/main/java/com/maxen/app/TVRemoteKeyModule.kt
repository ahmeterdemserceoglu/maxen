package com.maxen.app

import android.view.KeyEvent
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class TVRemoteKeyModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "TVRemoteKey"

  @ReactMethod
  fun sendKey(action: String, promise: Promise) {
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.reject("E_ACTIVITY_NULL", "TV activity is not available")
      return
    }

    val keyCode = when (action) {
      "dpad_up" -> KeyEvent.KEYCODE_DPAD_UP
      "dpad_down" -> KeyEvent.KEYCODE_DPAD_DOWN
      "dpad_left" -> KeyEvent.KEYCODE_DPAD_LEFT
      "dpad_right" -> KeyEvent.KEYCODE_DPAD_RIGHT
      "dpad_center" -> KeyEvent.KEYCODE_DPAD_CENTER
      else -> null
    }
    if (keyCode == null) {
      promise.reject("E_UNSUPPORTED_KEY", "Unsupported TV key: $action")
      return
    }

    activity.runOnUiThread {
      val now = android.os.SystemClock.uptimeMillis()
      activity.dispatchKeyEvent(KeyEvent(now, now, KeyEvent.ACTION_DOWN, keyCode, 0))
      activity.dispatchKeyEvent(KeyEvent(now, now, KeyEvent.ACTION_UP, keyCode, 0))
      promise.resolve(true)
    }
  }
}
