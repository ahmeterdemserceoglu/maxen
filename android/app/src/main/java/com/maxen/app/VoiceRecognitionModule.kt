package com.maxen.app

import android.app.Activity
import android.content.Intent
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class VoiceRecognitionModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), ActivityEventListener {

    private var pendingPromise: Promise? = null
    private val SPEECH_REQUEST_CODE = 4123

    init {
        reactContext.addActivityEventListener(this)
    }

    override fun getName(): String {
        return "VoiceRecognition"
    }

    @ReactMethod
    fun startSpeechRecognition(promise: Promise) {
        val currentActivity = reactApplicationContext.currentActivity
        if (currentActivity == null) {
            promise.reject("E_ACTIVITY_NULL", "Mevcut Activity bulunamadi")
            return
        }

        if (!SpeechRecognizer.isRecognitionAvailable(reactApplicationContext)) {
            promise.reject("E_NOT_AVAILABLE", "Bu cihazda ses tanima servisi bulunamadi")
            return
        }

        pendingPromise = promise

        try {
            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, "tr-TR")
                putExtra(RecognizerIntent.EXTRA_PROMPT, "Film veya dizi adi soyleyin...")
                putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
            }
            currentActivity.startActivityForResult(intent, SPEECH_REQUEST_CODE)
        } catch (e: Exception) {
            pendingPromise?.reject("E_SPEECH_ERROR", e.message, e)
            pendingPromise = null
        }
    }

    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == SPEECH_REQUEST_CODE) {
            if (resultCode == Activity.RESULT_OK && data != null) {
                val results = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
                if (!results.isNullOrEmpty()) {
                    pendingPromise?.resolve(results[0])
                } else {
                    pendingPromise?.reject("E_NO_MATCH", "Ses anlasilamadi")
                }
            } else if (resultCode == Activity.RESULT_CANCELED) {
                pendingPromise?.reject("E_CANCELLED", "Sesli arama iptal edildi")
            } else {
                pendingPromise?.reject("E_FAILED", "Sesli arama basarisiz oldu (kod: $resultCode)")
            }
            pendingPromise = null
        }
    }

    override fun onNewIntent(intent: Intent) {}
}
