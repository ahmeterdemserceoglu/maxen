import { useEffect, useState, useRef } from 'react';
import { Platform, useColorScheme, StyleSheet, Animated, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as SplashScreen from 'expo-splash-screen';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent, useEventListener } from 'expo';
import { AuthProvider } from '@/contexts/AuthContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { setupGlobalErrorHandlers } from '@/utils/errorHandler';

// Global hata yakalayıcıları başlatıyoruz
setupGlobalErrorHandlers();

// Native splash screen'in hemen kapanmasını engelliyoruz
if (Platform.OS !== 'web') {
  SplashScreen.preventAutoHideAsync().catch(() => {});
}

const splashVideo = require('../../assets/splash/splash.mp4');

function VideoSplashScreen({ onFinish }: { onFinish: () => void }) {
  const fadeAnim = useRef(new Animated.Value(1)).current;
  
  const player = useVideoPlayer(splashVideo, (p) => {
    p.loop = false;
    p.muted = Platform.OS === 'web'; // Web'de autoplay engellenmesin diye muted
    p.play();
  });

  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const [hasFinished, setHasFinished] = useState(false);

  const finishSplash = () => {
    if (hasFinished) return;
    setHasFinished(true);
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start(() => {
      onFinish();
    });
  };

  useEffect(() => {
    if (status === 'readyToPlay') {
      SplashScreen.hideAsync().catch(() => {});
    } else if (status === 'error') {
      // Eğer videoda hata olursa direkt geç (örn. tabletlerde codec hatası)
      SplashScreen.hideAsync().catch(() => {});
      finishSplash();
    }
  }, [status]);

  useEventListener(player, 'playToEnd', () => {
    finishSplash();
  });

  // Failsafe: Video ne olursa olsun 5 saniye sonra geçsin (Siyah ekranda kalmayı önler)
  useEffect(() => {
    const timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
      finishSplash();
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'black', opacity: fadeAnim, zIndex: 9999 }]}>
      <VideoView
        style={StyleSheet.absoluteFillObject}
        player={player}
        nativeControls={false}
        contentFit="cover"
      />
    </Animated.View>
  );
}

import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/config/queryClient';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isTV = Platform.isTV;
  const [splashFinished, setSplashFinished] = useState(Platform.OS === 'web' || isTV);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      if (Platform.isTV) {
        SplashScreen.hideAsync().catch(() => {});
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
      } else {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      }
    } else if (typeof document !== 'undefined') {
      const styleId = 'maxen-web-global-styles';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
          html, body, #root {
            background-color: #000000 !important;
            margin: 0;
            padding: 0;
            overflow-x: hidden;
            -webkit-font-smoothing: antialiased;
          }
          ::-webkit-scrollbar {
            width: 7px;
            height: 7px;
          }
          ::-webkit-scrollbar-track {
            background: #09090b;
          }
          ::-webkit-scrollbar-thumb {
            background: #27272a;
            border-radius: 4px;
          }
          ::-webkit-scrollbar-thumb:hover {
            background: #e50914;
          }
        `;
        document.head.appendChild(style);
      }
    }
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: 'black' }}>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} hidden={Platform.isTV} />
            
            <Stack screenOptions={{ headerShown: false }} />
            
            {!splashFinished && !isTV && (
              <VideoSplashScreen onFinish={() => setSplashFinished(true)} />
            )}

          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </View>
  );
}

