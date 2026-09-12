import React, { useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  StatusBar,
  StyleSheet,
  View,
  ActivityIndicator,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as NavigationBar from 'expo-navigation-bar';
import { Ionicons } from '@expo/vector-icons';
import { TVFocusable } from './TVFocusable';

interface TrailerModalProps {
  visible: boolean;
  videoKey?: string | null;
  youtubeKey?: string | null;
  title: string;
  onClose: () => void;
}

interface StreamResponse {
  success: boolean;
  provider?: string;
  streamUrl?: string;
  isEmbed?: boolean;
  headers?: {
    Referer?: string;
    'User-Agent'?: string;
  };
  error?: string;
}

const STREAM_API =
  'https://SENIN-DOMAININ.com/api/stream';

export function TrailerModal({
  visible,
  videoKey: rawVideoKey,
  youtubeKey,
  onClose,
}: TrailerModalProps) {
  const isTV = Platform.isTV;
  const videoKey = rawVideoKey || youtubeKey || null;

  const [streamUrl, setStreamUrl] = useState<string | null>(
    null
  );

  const [loading, setLoading] = useState(false);

  const player = useVideoPlayer(
    streamUrl
      ? {
        uri: streamUrl,
        headers: {
          Referer: 'https://vixsrc.to/',
        },
      }
      : null,
    (player) => {
      player.loop = false;
      player.muted = false;
      player.play();
    }
  );

  // ============================================================
  // FULLSCREEN
  // ============================================================

  useEffect(() => {
    if (isTV) return;

    const fullscreen = async () => {
      try {
        if (visible) {
          await ScreenOrientation.lockAsync(
            ScreenOrientation.OrientationLock.LANDSCAPE
          );

          await NavigationBar.setVisibilityAsync('hidden');

          await NavigationBar.setBehaviorAsync(
            'overlay-swipe'
          );

          StatusBar.setHidden(true);
        } else {
          await ScreenOrientation.lockAsync(
            ScreenOrientation.OrientationLock.PORTRAIT_UP
          );

          await NavigationBar.setVisibilityAsync('visible');

          StatusBar.setHidden(false);
        }
      } catch (error: unknown) {
        console.warn(
          '[TrailerModal] Fullscreen error:',
          error
        );
      }
    };

    fullscreen();
  }, [visible, isTV]);

  // ============================================================
  // STREAM AL
  // ============================================================

  useEffect(() => {
    if (!visible || !videoKey) {
      setStreamUrl(null);
      return;
    }

    let cancelled = false;

    const resolve = async () => {
      try {
        setLoading(true);
        setStreamUrl(null);

        /*
         * ÖNEMLİ:
         *
         * videoKey burada kullanılmıyor.
         * stream.js TMDB ID bekliyor.
         *
         * Bu nedenle TrailerModal'a gerçek TMDB ID
         * vermen gerekiyor.
         */

        // Burayı mevcut film TMDB ID'n ile değiştir.
        const tmdbId = videoKey;

        const url =
          `${STREAM_API}` +
          `?tmdbId=${encodeURIComponent(tmdbId)}` +
          `&type=movie`;

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(
            `HTTP ${response.status}`
          );
        }

        const data =
          (await response.json()) as StreamResponse;

        if (cancelled) return;

        if (!data.success || !data.streamUrl) {
          throw new Error(
            data.error ||
            'Stream URL bulunamadı'
          );
        }

        /*
         * Sadece gerçek HLS/MP4 stream kullan.
         */
        if (
          data.streamUrl.includes('.m3u8') ||
          data.streamUrl.includes('.mp4')
        ) {
          setStreamUrl(data.streamUrl);
        } else {
          throw new Error(
            'Resolver embed URL döndürdü'
          );
        }
      } catch (error: unknown) {
        console.error(
          '[TrailerModal] Stream resolve error:',
          error
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    resolve();

    return () => {
      cancelled = true;
    };
  }, [visible, videoKey]);

  // ============================================================
  // CLOSE
  // ============================================================

  const handleClose = async () => {
    try {
      player.pause();
    } catch { }

    try {
      if (!isTV) {
        await ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.PORTRAIT_UP
        );

        await NavigationBar.setVisibilityAsync(
          'visible'
        );

        StatusBar.setHidden(false);
      }
    } catch { }

    setStreamUrl(null);

    onClose();
  };

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="none"
      presentationStyle="fullScreen"
      transparent={false}
      statusBarTranslucent
      navigationBarTranslucent
      supportedOrientations={[
        'landscape',
        'portrait',
      ]}
      onRequestClose={handleClose}
    >
      <View style={styles.root}>
        <StatusBar hidden />

        {/* ====================================================
            NATIVE VIDEO
        ===================================================== */}

        {streamUrl ? (
          <VideoView
            player={player}
            style={styles.video}
            contentFit="cover"
            nativeControls={false}
            allowsFullscreen={false}
            playsInline={true}
          />
        ) : (
          <View style={styles.loading}>
            {loading && (
              <ActivityIndicator
                size="large"
              />
            )}
          </View>
        )}

        {/* ====================================================
            CLOSE
        ===================================================== */}

        <View style={styles.closeWrapper}>
          <TVFocusable
            onPress={handleClose}
            hasTVPreferredFocus
            style={[
              styles.closeButton,
              isTV &&
              styles.closeButtonTV,
            ]}
            focusedStyle={
              styles.closeButtonFocused
            }
          >
            <Ionicons
              name="close"
              size={
                isTV ? 30 : 28
              }
              color="#FFFFFF"
            />
          </TVFocusable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
  },

  video: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
  },

  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
  },

  closeWrapper: {
    position: 'absolute',
    top: 18,
    right: 18,
    zIndex: 999999,
    elevation: 999999,
  },

  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor:
      'rgba(0,0,0,0.7)',

    borderWidth: 1,
    borderColor:
      'rgba(255,255,255,0.25)',
  },

  closeButtonTV: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },

  closeButtonFocused: {
    backgroundColor:
      'rgba(255,255,255,0.2)',

    borderColor: '#FFFFFF',

    transform: [
      {
        scale: 1.1,
      },
    ],
  },
});