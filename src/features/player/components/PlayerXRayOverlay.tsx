import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { TMDB_BASE_URL, TMDB_IMAGE_BASE_URL } from '@/config/tmdb';
import { TVFocusable } from '@/components/TVFocusable';
import {
  fetchXRayData,
  getCurrentScene,
  type XRayData,
  type XRayScene,
  type XRayActor,
} from '@/services/xrayService';

interface PlayerXRayOverlayProps {
  tmdbId: number | string;
  mediaType: 'movie' | 'tv';
  seasonNumber?: number;
  episodeNumber?: number;
  currentTime: number;
  visible: boolean;
  onSelectActor?: (actorId: number, actorName: string) => void;
}

export function PlayerXRayOverlay({
  tmdbId,
  mediaType,
  seasonNumber,
  episodeNumber,
  currentTime,
  visible,
  onSelectActor,
}: PlayerXRayOverlayProps) {
  const [xrayData, setXrayData] = useState<XRayData | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedActor, setSelectedActor] = useState<XRayActor | null>(null);
  const [actorBio, setActorBio] = useState<string | null>(null);
  const [loadingBio, setLoadingBio] = useState(false);

  // 1. X-Ray Verisini Çek
  useEffect(() => {
    if (!tmdbId) return;

    let isMounted = true;
    fetchXRayData(tmdbId, mediaType, seasonNumber, episodeNumber)
      .then((data) => {
        if (isMounted) setXrayData(data);
      })
      .catch(() => {
        if (isMounted) setXrayData(null);
      });

    return () => {
      isMounted = false;
    };
  }, [tmdbId, mediaType, seasonNumber, episodeNumber]);

  // 2. O anki saniyeye denk gelen sahneyi bul
  const currentScene: XRayScene | null = useMemo(() => {
    return getCurrentScene(xrayData, currentTime);
  }, [xrayData, currentTime]);

  // 3. Oyuncu biyografisini çek
  useEffect(() => {
    if (!selectedActor) {
      setActorBio(null);
      return;
    }

    let isMounted = true;
    setLoadingBio(true);
    fetch(`${TMDB_BASE_URL}/person/${selectedActor.id}?language=tr-TR`)
      .then((res) => res.json())
      .then((data) => {
        if (isMounted) {
          setActorBio(data.biography || 'Bu oyuncu için biyografi bilgisi bulunmuyor.');
          setLoadingBio(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setActorBio('Biyografi yüklenemedi.');
          setLoadingBio(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedActor]);

  // X-Ray verisi yoksa veya oynatıcı oynatılıyorsa (visible değilse) HİÇBİR ŞEY GÖSTERME
  if (!visible || !xrayData || !xrayData.hasXRay || !currentScene) {
    return null;
  }

  const { actors = [], song, description } = currentScene;

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* ─── DURAKLATILDIĞINDA GÖRÜNEN ZARİF HAP (CHIP) BUTONU ─── */}
      {!isExpanded ? (
        <TouchableOpacity
          style={styles.chipPill}
          activeOpacity={0.8}
          onPress={() => setIsExpanded(true)}
        >
          <View style={styles.chipGlow} />
          <Ionicons name="sparkles" size={14} color="#00E5FF" style={{ marginRight: 6 }} />
          <Text style={styles.chipTitle}>X-RAY</Text>
          <View style={styles.chipDivider} />
          <Text style={styles.chipSub}>
            {actors.length > 0 ? `${actors.length} Oyuncu` : ''}
            {actors.length > 0 && song ? ' • ' : ''}
            {song ? '1 Şarkı 🎵' : ''}
          </Text>
          <Ionicons name="chevron-up" size={14} color="#CCC" style={{ marginLeft: 6 }} />
        </TouchableOpacity>
      ) : (
        /* ─── GENİŞLETİLMİŞ X-RAY PANELİ ─── */
        <View style={styles.glassPanel}>
          {/* Panel Başlık Barı */}
          <View style={styles.panelHeader}>
            <View style={styles.headerLeft}>
              <Ionicons name="sparkles" size={16} color="#00E5FF" />
              <Text style={styles.panelTitle}>X-RAY • Sahne Detayı</Text>
              {description ? (
                <Text style={styles.sceneDesc} numberOfLines={1}>
                  "{description}"
                </Text>
              ) : null}
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => {
                setIsExpanded(false);
                setSelectedActor(null);
              }}
            >
              <Ionicons name="close" size={18} color="#FFF" />
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* 🎵 Müzik Radarı (Varsa ilk sırada kart olarak çıkar) */}
            {song && (
              <View style={styles.musicCard}>
                {song.albumCover ? (
                  <Image source={{ uri: song.albumCover }} style={styles.albumCover} contentFit="cover" />
                ) : (
                  <View style={[styles.albumCover, styles.musicIconWrap]}>
                    <Ionicons name="musical-notes" size={24} color="#00E5FF" />
                  </View>
                )}
                <View style={styles.musicInfo}>
                  <View style={styles.musicBadge}>
                    <Ionicons name="radio" size={10} color="#00E5FF" />
                    <Text style={styles.musicBadgeText}>ÇALAN ŞARKI</Text>
                  </View>
                  <Text style={styles.songTitle} numberOfLines={1}>
                    {song.title}
                  </Text>
                  <Text style={styles.songArtist} numberOfLines={1}>
                    {song.artist}
                  </Text>
                  {song.spotifyUrl ? (
                    <TouchableOpacity
                      style={styles.spotifyBtn}
                      onPress={() => Linking.openURL(song.spotifyUrl!).catch(() => {})}
                    >
                      <Ionicons name="play-circle" size={12} color="#1DB954" style={{ marginRight: 4 }} />
                      <Text style={styles.spotifyBtnText}>Spotify'da Aç</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            )}

            {/* 🎭 Sahnedeki Oyuncular */}
            {actors.map((actor) => (
              <TVFocusable
                key={actor.id}
                style={styles.actorCard}
                focusedStyle={styles.actorCardFocused}
                onPress={() => {
                  if (onSelectActor) {
                    onSelectActor(actor.id, actor.name);
                  } else {
                    setSelectedActor(actor);
                  }
                }}
              >
                {({ focused }) => (
                  <>
                    <View style={[styles.avatarWrap, focused && styles.avatarWrapFocused]}>
                      {actor.profile_path ? (
                        <Image
                          source={{ uri: `${TMDB_IMAGE_BASE_URL}/w185${actor.profile_path}` }}
                          style={styles.avatar}
                          contentFit="cover"
                        />
                      ) : (
                        <View style={styles.avatarPlaceholder}>
                          <Ionicons name="person" size={16} color="#666" />
                        </View>
                      )}
                    </View>
                    <View style={styles.textWrap}>
                      <Text style={[styles.actorName, focused && styles.actorNameFocused]} numberOfLines={1}>
                        {actor.name}
                      </Text>
                      {actor.character ? (
                        <Text style={styles.characterName} numberOfLines={1}>
                          {actor.character}
                        </Text>
                      ) : null}
                    </View>
                  </>
                )}
              </TVFocusable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ─── OYUNCU DETAY MODALI ─── */}
      {selectedActor && (
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              {selectedActor.profile_path ? (
                <Image
                  source={{ uri: `${TMDB_IMAGE_BASE_URL}/w185${selectedActor.profile_path}` }}
                  style={styles.modalAvatar}
                  contentFit="cover"
                />
              ) : null}
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.modalActorName}>{selectedActor.name}</Text>
                {selectedActor.character ? (
                  <Text style={styles.modalCharName}>Rolü: {selectedActor.character}</Text>
                ) : null}
              </View>
              <TouchableOpacity onPress={() => setSelectedActor(null)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBioScroll}>
              <Text style={styles.modalBioText}>
                {loadingBio ? 'Biyografi yükleniyor...' : actorBio}
              </Text>
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 80,
    left: 20,
    right: 20,
    zIndex: 999,
  },
  chipPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 15, 20, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.35)',
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 14,
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  chipGlow: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00E5FF',
    top: 10,
    left: 8,
  },
  chipTitle: {
    color: '#00E5FF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginLeft: 6,
  },
  chipDivider: {
    width: 1,
    height: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 8,
  },
  chipSub: {
    color: '#E0E0E0',
    fontSize: 12,
    fontWeight: '500',
  },
  glassPanel: {
    backgroundColor: 'rgba(10, 10, 15, 0.92)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    padding: 12,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  panelTitle: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  sceneDesc: {
    color: '#888',
    fontSize: 11,
    fontStyle: 'italic',
    flex: 1,
    marginLeft: 6,
  },
  closeBtn: {
    padding: 4,
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  musicCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 10,
    padding: 8,
    marginRight: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.25)',
  },
  albumCover: {
    width: 50,
    height: 50,
    borderRadius: 6,
    backgroundColor: '#1E1E24',
  },
  musicIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  musicInfo: {
    marginLeft: 10,
    maxWidth: 160,
  },
  musicBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 2,
  },
  musicBadgeText: {
    color: '#00E5FF',
    fontSize: 9,
    fontWeight: '700',
  },
  songTitle: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  songArtist: {
    color: '#AAA',
    fontSize: 11,
  },
  spotifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  spotifyBtnText: {
    color: '#1DB954',
    fontSize: 10,
    fontWeight: '600',
  },
  actorCard: {
    alignItems: 'center',
    width: 76,
  },
  actorCardFocused: {
    transform: [{ scale: 1.08 }],
  },
  avatarWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: '#1A1A24',
  },
  avatarWrapFocused: {
    borderColor: '#00E5FF',
    borderWidth: 2,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    marginTop: 4,
    alignItems: 'center',
    width: '100%',
  },
  actorName: {
    color: '#EEE',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  actorNameFocused: {
    color: '#00E5FF',
  },
  characterName: {
    color: '#888',
    fontSize: 9,
    textAlign: 'center',
  },
  modalBackdrop: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderRadius: 16,
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#161622',
    borderRadius: 12,
    padding: 14,
    maxHeight: 220,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  modalActorName: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  modalCharName: {
    color: '#00E5FF',
    fontSize: 12,
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalBioScroll: {
    maxHeight: 120,
  },
  modalBioText: {
    color: '#CCC',
    fontSize: 12,
    lineHeight: 18,
  },
});
