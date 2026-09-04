import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import YoutubePlayer from 'react-native-youtube-iframe';

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
  onChangeState,
  onError,
}: UniversalYouTubePlayerProps) {
  return (
    <View style={[styles.container, { width, height }]}>
      <YoutubePlayer
        baseUrl="https://www.youtube.com"
        height={height}
        width={width}
        play={play}
        mute={mute}
        videoId={videoId}
        forceAndroidAutoplay={true}
        onChangeState={onChangeState}
        onError={onError}
        initialPlayerParams={{
          controls,
          modestbranding: true,
          rel: false,
          loop,
          preventFullScreen,
          iv_load_policy: 3,
        }}
        webViewProps={{
          allowsInlineMediaPlayback: true,
          mediaPlaybackRequiresUserAction: false,
          scrollEnabled: false,
          bounces: false,
          overScrollMode: 'never',
          androidLayerType: 'hardware',
          androidHardwareAccelerationDisabled: false,
          originWhitelist: ['*'],
        }}
        webViewStyle={{
          backgroundColor: '#000000',
          opacity: 0.99,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default UniversalYouTubePlayer;
