import { TVFocusable } from '@/components/TVFocusable';
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  useWindowDimensions,
  StatusBar,
  Platform,
  BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  useReelsFeed,
  extractYouTubeKey,
  extractIMDbId,
  ReelItem,
} from './reels/useReelsFeed';
import { ReelItemCard } from './reels/ReelItemCard';

export { extractYouTubeKey, extractIMDbId };
export type { ReelItem };

export interface ReelsFeedViewProps {
  profileId?: string;
  initialIndex?: number;
  onActiveIndexChange?: (index: number) => void;
  onPlayMedia: (media: any) => void;
  onSelectMedia: (media: any) => void;
  onClose?: () => void;
}

export function ReelsFeedView({
  profileId,
  initialIndex = 0,
  onActiveIndexChange,
  onPlayMedia,
  onSelectMedia,
  onClose,
}: ReelsFeedViewProps) {
  const { width, height } = useWindowDimensions();
  const flatListRef = useRef<FlatList | null>(null);

  const {
    items,
    loading,
    activeIndex,
    setActiveIndex,
    favorites,
    isMuted,
    setIsMuted,
    failedVideoKeys,
    isFullscreen,
    setIsFullscreen,
    onViewableItemsChanged,
    viewabilityConfig,
    handleToggleFav,
    handleFailVideo,
  } = useReelsFeed({
    profileId,
    initialIndex,
    onActiveIndexChange,
  });

  // Restore scroll position when dimensions change or when exiting fullscreen
  useEffect(() => {
    if (!Platform.isTV && !isFullscreen && flatListRef.current && items.length > 0) {
      const timeoutId = setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: activeIndex,
          animated: false,
        });
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [width, height, isFullscreen, activeIndex, items.length]);

  useEffect(() => {
    if (!Platform.isTV || !onClose) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => sub.remove();
  }, [onClose]);

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <StatusBar hidden />
        <View style={styles.loadingIcon}>
          <LinearGradient
            colors={['#E50914', '#9E0008']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.loadingIconGradient}
          >
            <Ionicons name="play" size={25} color="#fff" />
          </LinearGradient>
        </View>

        <Text style={styles.loadingBrand}>MAXEN</Text>

        <View style={styles.loadingLine}>
          <View style={styles.loadingLineActive} />
        </View>

        <Text style={styles.loadingText}>Keşif akışı hazırlanıyor...</Text>
      </View>
    );
  }

  if (Platform.isTV) {
    const item = items[activeIndex];
    return <View style={styles.root}>
      {item && <ReelItemCard key={item.id} item={item} index={activeIndex} activeIndex={activeIndex} totalCount={items.length} isFav={favorites.includes(item.id)} isMuted={isMuted} isFullscreen={false} failedVideoKeys={failedVideoKeys} onToggleFav={handleToggleFav} onToggleMute={() => setIsMuted(prev => !prev)} onSelectMedia={onSelectMedia} onPlayMedia={onPlayMedia} onClose={onClose} onEnterFullscreen={() => {}} onExitFullscreen={() => {}} onVideoFail={handleFailVideo} />}
      <View style={{ position: 'absolute', bottom: 24, right: 40, flexDirection: 'row', gap: 12 }}>
        <TVFocusable disabled={activeIndex === 0} style={tvButton} onPress={() => { setActiveIndex(activeIndex - 1); onActiveIndexChange?.(activeIndex - 1); }}><Text style={tvText}>Önceki</Text></TVFocusable>
        <TVFocusable hasTVPreferredFocus disabled={!item} style={tvButton} onPress={() => item && onSelectMedia(item)}><Text style={tvText}>Detaylar</Text></TVFocusable>
        <TVFocusable disabled={activeIndex >= items.length - 1} style={tvButton} onPress={() => { setActiveIndex(activeIndex + 1); onActiveIndexChange?.(activeIndex + 1); }}><Text style={tvText}>Sonraki</Text></TVFocusable>
        {!item && onClose && <TVFocusable style={tvButton} onPress={onClose}><Text style={tvText}>Geri</Text></TVFocusable>}
      </View>
    </View>;
  }

  return (
    <View style={styles.root}>
      <StatusBar hidden />

      <FlatList
        ref={flatListRef}
        data={items}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item, index }) => (
          <ReelItemCard
            item={item}
            index={index}
            activeIndex={activeIndex}
            totalCount={items.length}
            isFav={favorites.includes(item.id)}
            isMuted={isMuted}
            isFullscreen={isFullscreen}
            failedVideoKeys={failedVideoKeys}
            onToggleFav={handleToggleFav}
            onToggleMute={() => setIsMuted((prev) => !prev)}
            onSelectMedia={onSelectMedia}
            onPlayMedia={onPlayMedia}
            onClose={onClose}
            onEnterFullscreen={() => setIsFullscreen(true)}
            onExitFullscreen={() => setIsFullscreen(false)}
            onVideoFail={handleFailVideo}
          />
        )}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={height}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        initialScrollIndex={initialIndex && initialIndex > 0 ? initialIndex : undefined}
        getItemLayout={(_, index) => ({
          length: height,
          offset: height * index,
          index,
        })}
        removeClippedSubviews={false}
        scrollEnabled={!isFullscreen}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        windowSize={3}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    zIndex: 99999,
    elevation: 100,
  },
  loadingScreen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#070709',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999999,
  },
  loadingIcon: {
    width: 68,
    height: 68,
    borderRadius: 21,
    overflow: 'hidden',
    marginBottom: 14,
  },
  loadingIconGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingBrand: {
    color: '#fff',
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: 5,
    marginBottom: 24,
  },
  loadingLine: {
    width: 110,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
    marginBottom: 12,
  },
  loadingLineActive: {
    width: '42%',
    height: '100%',
    backgroundColor: '#E50914',
  },
  loadingText: {
    color: '#626269',
    fontSize: 11,
    fontWeight: '600',
  },
});

const tvButton = { minHeight: 48, paddingHorizontal: 18, justifyContent: 'center' as const, backgroundColor: '#262626' };
const tvText = { color: '#fff', fontSize: 17 };
