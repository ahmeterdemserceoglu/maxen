import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { resolveIMDbStream } from '../utils/imdbResolver';

interface IMDbNativePlayerProps {
  imdbId: string;
  isCurrent: boolean;
  isMuted: boolean;
  onFail?: () => void;
  width: number;
  height: number;
  isVertical?: boolean;
  showControls?: boolean;
  onExitFullscreen?: () => void;
}

export default function IMDbNativePlayer({
  imdbId,
  isCurrent,
  isMuted,
  onFail,
  width,
  height,
  isVertical,
  showControls = false,
  onExitFullscreen
}: IMDbNativePlayerProps) {
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [hasFailed, setHasFailed] = useState(false);
  const videoViewRef = useRef<VideoView>(null);

  useEffect(() => {
    if (showControls && videoViewRef.current) {
      videoViewRef.current.enterFullscreen();
    }
  }, [showControls]);

  useEffect(() => {
    let isMounted = true;
    async function loadStream() {
      const url = await resolveIMDbStream(imdbId);
      if (!isMounted) return;
      if (url) {
        setStreamUrl(url);
      } else {
        setHasFailed(true);
        onFail?.();
      }
    }
    loadStream();
    return () => {
      isMounted = false;
    };
  }, [imdbId]);

  const player = useVideoPlayer(streamUrl, (p) => {
    p.loop = true;
    p.muted = isMuted;
    if (isCurrent) {
      p.play();
    }
  });

  // Handle current/inactive lifecycle
  useEffect(() => {
    if (player) {
      if (isCurrent) {
        player.play();
      } else {
        player.pause();
      }
    }
  }, [isCurrent, player]);

  // Handle mute lifecycle
  useEffect(() => {
    if (player) {
      player.muted = isMuted;
    }
  }, [isMuted, player]);

  // Handle errors emitted by the player status
  useEffect(() => {
    if (player && player.status === 'error') {
      if (!hasFailed) {
        console.warn(`[IMDbNativePlayer] Player error for ${imdbId}`);
        setHasFailed(true);
        onFail?.();
      }
    }
  }, [player?.status, hasFailed, imdbId]);

  if (hasFailed) {
    return null; // Will fallback to YouTube or Backdrop in the parent
  }

  const isPortrait = height > width;
  const playerWidth = (isVertical && isPortrait) ? Math.ceil(height * (16 / 9)) : width;
  
  // Show a loading indicator (or keep black) while the stream is being resolved or video is preparing
  const isReady = player && player.status === 'readyToPlay';

  return (
    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' }]}>
      {streamUrl ? (
        <VideoView
          ref={videoViewRef}
          style={{ width: playerWidth, height: height }}
          player={player}
          playsInline={true}
          allowsPictureInPicture={showControls}
          nativeControls={showControls}
          fullscreenOptions={{ enable: showControls, orientation: 'landscape' }}
          contentFit={isVertical ? "cover" : "contain"}
          onFullscreenExit={onExitFullscreen}
        />
      ) : null}
      
      {!isReady && (
        <View style={StyleSheet.absoluteFillObject} /> // Fallback overlay until ready (ReelsFeedView shows backdrop underneath)
      )}
    </View>
  );
}
