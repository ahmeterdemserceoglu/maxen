import React from 'react';
import { View, StyleSheet } from 'react-native';

export interface UniversalYouTubePlayerProps {
  videoId: string;
  width: number;
  height: number;
  play?: boolean;
  mute?: boolean;
  controls?: boolean;
  loop?: boolean;
  preventFullScreen?: boolean;
  onChangeState?: (state: string) => void;
  onError?: (error: string) => void;
}

export function UniversalYouTubePlayer({
  videoId,
  width,
  height,
  play = true,
  mute = false,
  controls = true,
  loop = false,
  preventFullScreen = false,
}: UniversalYouTubePlayerProps) {
  const origin = typeof window !== 'undefined' ? encodeURIComponent(window.location.origin) : '';
  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=${play ? '1' : '0'}&mute=${mute ? '1' : '0'}&controls=${controls ? '1' : '0'}&loop=${loop ? '1' : '0'}&playlist=${loop ? videoId : ''}&rel=0&modestbranding=1&enablejsapi=1&fs=${preventFullScreen ? '0' : '1'}&origin=${origin}`;

  return (
    <View style={[styles.container, { width, height }]}>
      <iframe
        src={embedUrl}
        width={width}
        height={height}
        style={{
          border: 'none',
          width: '100%',
          height: '100%',
          backgroundColor: '#000000',
        }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen={!preventFullScreen}
        title="YouTube Player"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000000',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default UniversalYouTubePlayer;
