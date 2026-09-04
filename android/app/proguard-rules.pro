# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# React Native core & JNI
-keep class com.facebook.react.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod
-dontwarn com.facebook.react.**

# Maxen Custom Modules
-keep class com.maxen.app.** { *; }

# React Native Reanimated
-keep class com.swmansion.reanimated.** { *; }

# React Native Screens
-keep class com.swmansion.rnscreens.** { *; }

# React Native SVG
-keep class com.horcrux.svg.** { *; }

# React Native WebView
-keep class com.reactnativecommunity.webview.** { *; }

# React Native Async Storage
-keep class com.reactnativecommunity.asyncstorage.** { *; }

# Expo Modules Core & Auto-linking
-keep class expo.modules.** { *; }
-keep class * extends expo.modules.core.interfaces.Package { *; }
-keep class * extends expo.modules.kotlin.modules.Module { *; }
-keepclassmembers class * extends expo.modules.kotlin.modules.Module { *; }
-dontwarn expo.modules.**

# Expo Video & AndroidX Media3 (ExoPlayer)
-keep class androidx.media3.** { *; }
-dontwarn androidx.media3.**
-keep class expo.modules.video.** { *; }

# Kotlin & Coroutines
-keep class kotlin.reflect.** { *; }
-keep class kotlinx.coroutines.** { *; }
-dontwarn kotlinx.coroutines.**

# Common AndroidX & Annotations
-dontwarn javax.annotation.**
-dontwarn org.checkerframework.**
-dontwarn com.google.errorprone.annotations.**
