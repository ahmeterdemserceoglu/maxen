import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  useWindowDimensions,
  ActivityIndicator,
  BackHandler,
  TouchableWithoutFeedback,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { TVFocusable } from '@/components/TVFocusable';
import { resolveYouTubeCleanStream } from '@/utils/youtubeResolver';
import { UniversalYouTubePlayer } from '@/components/UniversalYouTubePlayer';

const isTV = Platform.isTV;

export interface TrailerModalProps {
  visible: boolean;
  onClose: () => void;
  youtubeKey: string | null;
  title?: string;
}

function NativeTrailerPlayer({
  streamUrl,
  width,
  height,
}: {
  streamUrl: string;
  width: number;
  height: number;
}) {
  const player = useVideoPlayer(streamUrl, (p) => {
    p.loop = false;
    p.play();
  });

  return (
    <VideoView
      player={player}
      style={{ width, height }}
      contentFit="contain"
      nativeControls={true}
    />
  );
}

export function TrailerModal({
  visible,
  onClose,
  youtubeKey,
  title,
}: TrailerModalProps) {
  const { width } = useWindowDimensions();
  const [directStreamUrl, setDirectStreamUrl] = useState<string | null>(null);
  const [resolving, setResolving] = useState(true);
  const [playing, setPlaying] = useState(true);

  // TV / Android Back tuşu
  useEffect(() => {
    if (!visible) return;
    const onBack = () => {
      onClose();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [visible, onClose]);

  // 16:9 Ekran hesaplaması
  const isTablet = width > 600;
  const videoWidth = isTV
    ? Math.min(width * 0.85, 1200)
    : isTablet
    ? Math.min(width * 0.9, 900)
    : width - 32;
  const videoHeight = (videoWidth * 9) / 16;

  useEffect(() => {
    if (!visible || !youtubeKey) {
      setDirectStreamUrl(null);
      setResolving(true);
      setPlaying(false);
      return;
    }

    let isMounted = true;
    setResolving(true);
    setPlaying(true);

    resolveYouTubeCleanStream(youtubeKey).then((cleanUrl) => {
      if (isMounted) {
        if (cleanUrl) {
          setDirectStreamUrl(cleanUrl);
        }
        setResolving(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [visible, youtubeKey]);

  if (!visible || !youtubeKey) return null;

  return (
    <View style={styles.modalOverlay} pointerEvents="box-none">
      {/* 1. Backdrop tıklandığında kapat (Dış alana dokunma) */}
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      {/* 2. Video Modal Kartı (Tıklamalar doğrudan video oynatıcıya ve butonlara gider) */}
      <View style={[styles.container, { width: videoWidth }]} pointerEvents="auto">
        {/* Üst Başlık & Kapat Butonu */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="film-outline" size={20} color="#E50914" />
            <ThemedText style={styles.title} numberOfLines={1}>
              {title ? `${title} - Fragman` : 'Fragman'}
            </ThemedText>
          </View>

          <TVFocusable
            hasTVPreferredFocus={isTV}
            onPress={onClose}
            style={styles.closeButton}
            focusedStyle={styles.closeButtonFocused}
            accessibilityLabel="Kapat"
          >
            <Ionicons name="close" size={24} color="#fff" />
          </TVFocusable>
        </View>

        {/* Video Oynatıcı */}
        <View style={[styles.playerWrapper, { height: videoHeight }]}>
          {resolving ? (
            <View style={[styles.loadingContainer, { height: videoHeight }]}>
              <ActivityIndicator size="large" color="#E50914" />
              <ThemedText style={styles.loadingText}>Fragman Yükleniyor...</ThemedText>
            </View>
          ) : directStreamUrl ? (
            /* %100 Reklamsız Doğrudan Native MP4/HLS Akışı */
            <NativeTrailerPlayer
              streamUrl={directStreamUrl}
              width={videoWidth}
              height={videoHeight}
            />
          ) : (
            /* Fallback YouTube Embed Player */
            <UniversalYouTubePlayer
              videoId={youtubeKey}
              width={videoWidth}
              height={videoHeight}
              play={playing}
            />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99999,
    elevation: 99999,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  container: {
    backgroundColor: '#111',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 25,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#18181b',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    flex: 1,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonFocused: {
    backgroundColor: '#E50914',
    transform: [{ scale: 1.1 }],
  },
  playerWrapper: {
    backgroundColor: '#000',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    zIndex: 10,
  },
  loadingText: {
    color: '#aaa',
    fontSize: 13,
  },
});
