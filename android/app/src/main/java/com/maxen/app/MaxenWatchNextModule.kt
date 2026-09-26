package com.maxen.app

import android.content.ContentUris
import android.net.Uri
import android.os.Build
import android.provider.BaseColumns
import androidx.tvprovider.media.tv.TvContractCompat
import androidx.tvprovider.media.tv.WatchNextProgram
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap

class MaxenWatchNextModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "MaxenWatchNext"

  @ReactMethod
  fun publish(program: ReadableMap, promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      promise.resolve(false)
      return
    }

    try {
      val providerId = requiredString(program, "id")
      val title = requiredString(program, "title")
      val posterUrl = requiredString(program, "posterUrl")
      val deepLink = requiredString(program, "deepLink")
      val type = program.getStringOrNull("type") ?: "movie"
      val positionMillis = (program.getDoubleOrZero("playbackPositionSeconds") * 1000).toInt()
      val durationMillis = (program.getDoubleOrZero("durationSeconds") * 1000).toInt()

      if (durationMillis <= 0 || positionMillis < 60_000) {
        promise.resolve(false)
        return
      }

      val builder = WatchNextProgram.Builder()
        .setWatchNextType(TvContractCompat.WatchNextPrograms.WATCH_NEXT_TYPE_CONTINUE)
        .setLastEngagementTimeUtcMillis(System.currentTimeMillis())
        .setInternalProviderId(providerId)
        .setContentId(program.getStringOrNull("tmdbId") ?: providerId)
        .setTitle(title)
        .setDescription(program.getStringOrNull("overview") ?: "")
        .setPosterArtUri(Uri.parse(posterUrl))
        .setPosterArtAspectRatio(TvContractCompat.PreviewProgramColumns.ASPECT_RATIO_16_9)
        .setIntentUri(Uri.parse(deepLink))
        .setDurationMillis(durationMillis)
        .setLastPlaybackPositionMillis(positionMillis)
        .setType(
          if (type == "tv") TvContractCompat.PreviewProgramColumns.TYPE_TV_EPISODE
          else TvContractCompat.PreviewProgramColumns.TYPE_MOVIE
        )

      if (type == "tv") {
        program.getStringOrNull("episodeTitle")?.let(builder::setEpisodeTitle)
        program.getIntOrNull("seasonNumber")?.let(builder::setSeasonNumber)
        program.getIntOrNull("episodeNumber")?.let(builder::setEpisodeNumber)
        builder.setTvSeriesItemType(TvContractCompat.PreviewProgramColumns.TV_SERIES_ITEM_TYPE_EPISODE)
      }

      val values = builder.build().toContentValues()
      val existingId = findProgramId(providerId)
      val changed = if (existingId == null) {
        reactContext.contentResolver.insert(TvContractCompat.WatchNextPrograms.CONTENT_URI, values) != null
      } else {
        val itemUri = ContentUris.withAppendedId(TvContractCompat.WatchNextPrograms.CONTENT_URI, existingId)
        reactContext.contentResolver.update(itemUri, values, null, null) > 0
      }

      promise.resolve(changed)
    } catch (error: Exception) {
      promise.reject("E_WATCH_NEXT_PUBLISH", "Watch Next kaydı yayınlanamadı", error)
    }
  }

  @ReactMethod
  fun remove(providerId: String, promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      promise.resolve(false)
      return
    }

    try {
      val existingId = findProgramId(providerId)
      if (existingId == null) {
        promise.resolve(true)
        return
      }
      val itemUri = ContentUris.withAppendedId(TvContractCompat.WatchNextPrograms.CONTENT_URI, existingId)
      promise.resolve(reactContext.contentResolver.delete(itemUri, null, null) > 0)
    } catch (error: Exception) {
      promise.reject("E_WATCH_NEXT_REMOVE", "Watch Next kaydı silinemedi", error)
    }
  }

  private fun findProgramId(providerId: String): Long? {
    val projection = arrayOf(
      BaseColumns._ID,
      TvContractCompat.PreviewProgramColumns.COLUMN_INTERNAL_PROVIDER_ID
    )
    reactContext.contentResolver.query(
      TvContractCompat.WatchNextPrograms.CONTENT_URI,
      projection,
      null,
      null,
      null
    )?.use { cursor ->
      while (cursor.moveToNext()) {
        if (cursor.getString(1) == providerId) return cursor.getLong(0)
      }
    }
    return null
  }

  private fun requiredString(map: ReadableMap, key: String): String =
    map.getStringOrNull(key)?.takeIf { it.isNotBlank() }
      ?: throw IllegalArgumentException("$key is required")

  private fun ReadableMap.getStringOrNull(key: String): String? =
    if (hasKey(key) && !isNull(key)) getString(key) else null

  private fun ReadableMap.getDoubleOrZero(key: String): Double =
    if (hasKey(key) && !isNull(key)) getDouble(key) else 0.0

  private fun ReadableMap.getIntOrNull(key: String): Int? =
    if (hasKey(key) && !isNull(key)) getDouble(key).toInt() else null
}
