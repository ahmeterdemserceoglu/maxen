import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { TVFocusable } from '@/components/TVFocusable';
import { getTVNodeHandle } from '@/utils/tvNodeHandle';
import type { DetailHeroProps } from './DetailHero';

export function TVDetailHero(p: DetailHeroProps) {
  const { height } = useWindowDimensions();
  const compact = height < 700;
  const playNode = getTVNodeHandle(p.playButtonRef);
  const trailerNode = getTVNodeHandle(p.trailerButtonRef);
  const favoriteNode = getTVNodeHandle(p.favoriteButtonRef);
  const watchLaterNode = getTVNodeHandle(p.watchLaterButtonRef);
  const closeNode = getTVNodeHandle(p.closeButtonRef);
  const firstContentNode = p.firstContentNodeId || getTVNodeHandle(
    p.isMovie ? p.actorRefs?.current?.[0] : p.firstEpisodeRef
  );
  const firstSecondaryNode = trailerNode || favoriteNode || watchLaterNode;
  return <View style={[s.root, p.isMovie && { maxWidth: 760 }]}>
    <ThemedText style={s.category}>{p.isMovie ? 'FİLM' : 'DİZİ'}</ThemedText>
    <ThemedText numberOfLines={2} style={[s.title, compact && { fontSize: 30, lineHeight: 36 }]}>{p.media.title || p.media.name}</ThemedText>
    <View style={s.meta}>
      {!!p.media.rating && <ThemedText style={s.rating}>★ {p.media.rating}</ThemedText>}
      {!!p.media.year && <ThemedText style={s.text}>{p.media.year}</ThemedText>}
      <ThemedText style={s.text}>{p.isMovie ? p.movieRuntime : `${p.seasonsCount} Sezon`}</ThemedText>
    </View>
    <ThemedText numberOfLines={1} style={s.muted}>{p.genreList.slice(0, 3).join(' • ')}</ThemedText>
    <ThemedText numberOfLines={compact ? 3 : 4} style={s.overview}>{p.media.overview}</ThemedText>
    <View style={s.actions}>
      <TVFocusable
        ref={p.playButtonRef}
        hasTVPreferredFocus
        style={s.play}
        focusedStyle={s.playFocused}
        onPress={p.onPlay}
        nextFocusUp={closeNode}
        nextFocusDown={firstContentNode}
        nextFocusRight={firstSecondaryNode}
        accessibilityLabel={p.movieProgress > 0 ? 'İzlemeye devam et' : 'Oynat'}
      >
        <Ionicons name="play" size={22} color="#000" />
        <ThemedText style={s.playText}>{p.movieProgress > 0 ? 'Devam Et' : 'Oynat'}</ThemedText>
      </TVFocusable>
      {!!p.trailerKey && <TVFocusable
        ref={p.trailerButtonRef}
        style={s.button}
        focusedStyle={s.buttonFocused}
        onPress={p.onOpenTrailer}
        nextFocusLeft={playNode}
        nextFocusUp={closeNode}
        nextFocusDown={firstContentNode}
        nextFocusRight={favoriteNode || watchLaterNode || firstContentNode}
      >
        <Ionicons name="film-outline" size={20} color="#fff" /><ThemedText style={s.text}>Fragman</ThemedText>
      </TVFocusable>}
      <TVFocusable
        ref={p.favoriteButtonRef}
        style={s.button}
        focusedStyle={s.buttonFocused}
        onPress={p.onToggleFavorite}
        nextFocusLeft={trailerNode || playNode}
        nextFocusUp={closeNode}
        nextFocusDown={firstContentNode}
        nextFocusRight={watchLaterNode || firstContentNode}
        accessibilityLabel={p.isFav ? 'Favorilerden çıkar' : 'Favorilere ekle'}
      >
        <Ionicons name={p.isFav ? 'heart' : 'heart-outline'} size={20} color={p.isFav ? '#E50914' : '#fff'} /><ThemedText style={s.text}>Favori</ThemedText>
      </TVFocusable>
      {p.onToggleWatchLater && <TVFocusable
        ref={p.watchLaterButtonRef}
        style={s.button}
        focusedStyle={s.buttonFocused}
        onPress={p.onToggleWatchLater}
        nextFocusLeft={favoriteNode || trailerNode || playNode}
        nextFocusUp={closeNode}
        nextFocusDown={firstContentNode}
        nextFocusRight={firstContentNode}
        accessibilityLabel={p.isWatchLater ? 'Listemden çıkar' : 'Listeme ekle'}
      >
        <Ionicons name={p.isWatchLater ? 'checkmark' : 'add'} size={20} color="#fff" /><ThemedText style={s.text}>Listem</ThemedText>
      </TVFocusable>}
    </View>
    {p.movieProgress > 0 && <View style={s.track}><View style={[s.fill, { width: `${Math.min(100, p.movieProgress * 100)}%` }]} /></View>}
  </View>;
}
const s = StyleSheet.create({
  root: { padding: 6 }, category: { color: '#E50914', fontSize: 15, fontWeight: '800', letterSpacing: 2 },
  title: { color: '#fff', fontSize: 42, lineHeight: 49, fontWeight: '800', marginVertical: 12 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 10 },
  text: { color: '#fff', fontSize: 16 }, rating: { color: '#F5C518', fontSize: 16 }, muted: { color: '#aaa', fontSize: 15 },
  overview: { color: '#ccc', fontSize: 16, lineHeight: 24, marginVertical: 16 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  button: { minHeight: 48, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.12)' },
  buttonFocused: { borderColor: '#fff', borderWidth: 3, backgroundColor: 'rgba(255,255,255,0.24)' },
  play: { minHeight: 50, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff' },
  playFocused: { borderColor: '#E50914', borderWidth: 3, backgroundColor: '#fff' },
  playText: { color: '#000', fontWeight: '800', fontSize: 17 },
  track: { height: 4, backgroundColor: '#333', marginVertical: 8 }, fill: { height: 4, backgroundColor: '#E50914' },
});
