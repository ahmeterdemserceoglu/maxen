import React from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

export interface EmbedPlayerProps {
  streamUrl: string;
  streamHeaders?: Record<string, string>;
  onLoadStart?: () => void;
  onLoadEnd?: () => void;
}

export function EmbedPlayer({
  streamUrl,
  streamHeaders,
  onLoadStart,
  onLoadEnd,
}: EmbedPlayerProps) {
  return (
    <WebView
      source={{ uri: streamUrl, headers: streamHeaders }}
      style={StyleSheet.absoluteFillObject}
      javaScriptEnabled={true}
      domStorageEnabled={true}
      mediaPlaybackRequiresUserAction={false}
      allowsFullscreenVideo={true}
      userAgent="Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
      onLoadStart={onLoadStart}
      onLoadEnd={onLoadEnd}
      onShouldStartLoadWithRequest={(req) => {
        const u = req.url.toLowerCase();
        return !u.startsWith('data:') && !u.startsWith('intent:') && !u.startsWith('market:');
      }}
    />
  );
}

export default EmbedPlayer;
