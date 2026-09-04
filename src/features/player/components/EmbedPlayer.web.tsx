import React from 'react';
import { View, StyleSheet } from 'react-native';

export interface EmbedPlayerProps {
  streamUrl: string;
  streamHeaders?: Record<string, string>;
  onLoadStart?: () => void;
  onLoadEnd?: () => void;
}

export function EmbedPlayer({
  streamUrl,
  onLoadEnd,
}: EmbedPlayerProps) {
  return (
    <View style={StyleSheet.absoluteFillObject}>
      <iframe
        src={streamUrl}
        style={{
          border: 'none',
          width: '100%',
          height: '100%',
          backgroundColor: '#000000',
        }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        onLoad={onLoadEnd}
        title="Embed Video Player"
      />
    </View>
  );
}

export default EmbedPlayer;
