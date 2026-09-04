import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  listOnlineTvs,
  sendTvRemoteAction,
  type TvDevice,
  type TvRemoteAction,
} from '@/services/tvRemotePlayService';
import { useAuth } from '@/contexts/AuthContext';

export interface VirtualTvRemoteModalProps {
  visible: boolean;
  onClose: () => void;
}

export function VirtualTvRemoteModal({ visible, onClose }: VirtualTvRemoteModalProps) {
  const { user } = useAuth();
  const [loadingTvs, setLoadingTvs] = useState(false);
  const [tvs, setTvs] = useState<TvDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<TvDevice | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [lastAction, setLastAction] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !user?.uid) return;

    let cancelled = false;
    setLoadingTvs(true);

    listOnlineTvs(user.uid)
      .then((list) => {
        if (cancelled) return;
        setTvs(list);
        if (list.length > 0) {
          setSelectedDevice(list[0]);
        }
      })
      .catch((e) => console.warn('Error listing TVs:', e))
      .finally(() => {
        if (!cancelled) setLoadingTvs(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visible, user?.uid]);

  const sendAction = async (type: TvRemoteAction['type'], payload?: any, label?: string) => {
    if (!selectedDevice) return;
    setLastAction(label || type);
    await sendTvRemoteAction(selectedDevice.deviceId, type, payload);
    setTimeout(() => {
      setLastAction(null);
    }, 400);
  };

  const handleSendSearch = () => {
    if (!searchQuery.trim()) return;
    sendAction('search_query', searchQuery.trim(), `🔍 "${searchQuery.trim()}"`);
    setSearchQuery('');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.remoteContainer}>
          {/* Top Bezel & Glow */}
          <LinearGradient
            colors={['#24242e', '#16161c', '#0f0f13']}
            style={styles.remoteGradient}
          >
            {/* Header: Title, TV Selector & Close */}
            <View style={styles.headerRow}>
              <View style={styles.headerTitleGroup}>
                <View style={styles.brandBadge}>
                  <Text style={styles.brandText}>MAXEN</Text>
                </View>
                <Text style={styles.headerTitle}>Sanal TV Kumandası</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color="#AAA" />
              </TouchableOpacity>
            </View>

            {/* TV Device Selector */}
            {loadingTvs ? (
              <ActivityIndicator color="#E50914" style={{ marginVertical: 8 }} />
            ) : tvs.length === 0 ? (
              <View style={styles.noTvWarning}>
                <Ionicons name="tv-outline" size={18} color="#FF9800" style={{ marginRight: 6 }} />
                <Text style={styles.noTvText}>
                  Açık TV bulunamadı. Maxen TV açık ve bağlı olmalıdır.
                </Text>
              </View>
            ) : (
              <View style={styles.deviceSelectorWrap}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.deviceList}>
                  {tvs.map((tv) => {
                    const isSelected = selectedDevice?.deviceId === tv.deviceId;
                    return (
                      <TouchableOpacity
                        key={tv.deviceId}
                        onPress={() => setSelectedDevice(tv)}
                        style={[styles.tvChip, isSelected && styles.tvChipSelected]}
                      >
                        <View style={[styles.onlineDot, isSelected && styles.onlineDotSelected]} />
                        <Text style={[styles.tvChipText, isSelected && styles.tvChipTextSelected]}>
                          {tv.deviceName}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Live Action Toast Indicator */}
            <View style={styles.actionIndicatorRow}>
              {lastAction ? (
                <View style={styles.actionPill}>
                  <Ionicons name="radio" size={11} color="#4ADE80" style={{ marginRight: 4 }} />
                  <Text style={styles.actionPillText}>{lastAction}</Text>
                </View>
              ) : (
                <Text style={styles.readyText}>
                  {selectedDevice ? `${selectedDevice.deviceName} Bağlı` : 'Cihaz bekleniyor'}
                </Text>
              )}
            </View>

            {/* 1. TV Keyboard & Search Bar Sync */}
            <View style={styles.searchBarRow}>
              <Ionicons name="search" size={16} color="#888" style={{ marginLeft: 10, marginRight: 6 }} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="TV'ye metin gönder / ara..."
                placeholderTextColor="#777"
                style={styles.searchInput}
                onSubmitEditing={handleSendSearch}
                returnKeyType="send"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={handleSendSearch} style={styles.sendSearchBtn}>
                  <Ionicons name="send" size={14} color="#FFF" />
                </TouchableOpacity>
              )}
            </View>

            {/* 2. Quick TV Tab Switcher */}
            <View style={styles.tabsRow}>
              <TouchableOpacity
                style={styles.tabBtn}
                onPress={() => sendAction('tab_switch', 'home', 'Ana Sayfa')}
              >
                <Ionicons name="home-outline" size={16} color="#FFF" />
                <Text style={styles.tabBtnText}>Ana Sayfa</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.tabBtn}
                onPress={() => sendAction('tab_switch', 'media', 'Medya')}
              >
                <Ionicons name="film-outline" size={16} color="#FFF" />
                <Text style={styles.tabBtnText}>Medya</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.tabBtn}
                onPress={() => sendAction('tab_switch', 'search', 'Keşfet')}
              >
                <Ionicons name="compass-outline" size={16} color="#FFF" />
                <Text style={styles.tabBtnText}>Keşfet</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.tabBtn}
                onPress={() => sendAction('tab_switch', 'social', 'Sosyal')}
              >
                <Ionicons name="people-outline" size={16} color="#FFF" />
                <Text style={styles.tabBtnText}>Sosyal</Text>
              </TouchableOpacity>
            </View>

            {/* 3. Ergonomic Tactile D-PAD */}
            <View style={styles.dpadContainer}>
              {/* UP */}
              <TouchableOpacity
                style={[styles.dpadBtn, styles.dpadUp]}
                onPress={() => sendAction('dpad_up', null, '▲ Yukarı')}
                activeOpacity={0.6}
              >
                <Ionicons name="chevron-up" size={26} color="#FFF" />
              </TouchableOpacity>

              {/* LEFT & CENTER (OK) & RIGHT */}
              <View style={styles.dpadMiddleRow}>
                <TouchableOpacity
                  style={[styles.dpadBtn, styles.dpadLeft]}
                  onPress={() => sendAction('dpad_left', null, '◀ Sol')}
                  activeOpacity={0.6}
                >
                  <Ionicons name="chevron-back" size={26} color="#FFF" />
                </TouchableOpacity>

                {/* CENTER OK BUTTON */}
                <TouchableOpacity
                  style={styles.dpadCenter}
                  onPress={() => sendAction('dpad_center', null, '● Seçim / OK')}
                  activeOpacity={0.7}
                >
                  <LinearGradient
                    colors={['#E50914', '#B8000C']}
                    style={styles.dpadCenterGradient}
                  >
                    <Text style={styles.okText}>OK</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.dpadBtn, styles.dpadRight]}
                  onPress={() => sendAction('dpad_right', null, '▶ Sağ')}
                  activeOpacity={0.6}
                >
                  <Ionicons name="chevron-forward" size={26} color="#FFF" />
                </TouchableOpacity>
              </View>

              {/* DOWN */}
              <TouchableOpacity
                style={[styles.dpadBtn, styles.dpadDown]}
                onPress={() => sendAction('dpad_down', null, '▼ Aşağı')}
                activeOpacity={0.6}
              >
                <Ionicons name="chevron-down" size={26} color="#FFF" />
              </TouchableOpacity>
            </View>

            {/* 4. Navigation Control Row: Back, Home */}
            <View style={styles.navControlRow}>
              <TouchableOpacity
                style={styles.navRoundBtn}
                onPress={() => sendAction('back', null, '↩ Geri')}
              >
                <Ionicons name="arrow-back" size={19} color="#FFF" />
                <Text style={styles.navBtnLabel}>Geri</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.navRoundBtn}
                onPress={() => sendAction('home', null, '🏠 Ana Menü')}
              >
                <Ionicons name="home" size={19} color="#FFF" />
                <Text style={styles.navBtnLabel}>Home</Text>
              </TouchableOpacity>
            </View>

            {/* 5. Media & Volume Controls (Bottom Bar) */}
            <View style={styles.mediaVolumeSection}>
              {/* Media Controls */}
              <View style={styles.mediaRow}>
                <TouchableOpacity
                  style={styles.mediaBtn}
                  onPress={() => sendAction('seek_backward', null, '⏪ -10s')}
                >
                  <Ionicons name="play-back" size={18} color="#FFF" />
                  <Text style={styles.mediaBtnSub}>-10s</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.mediaBtn, styles.playPauseBtn]}
                  onPress={() => sendAction('play_pause', null, '⏯ Oynat / Duraklat')}
                >
                  <Ionicons name="play" size={22} color="#FFF" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.mediaBtn}
                  onPress={() => sendAction('seek_forward', null, '⏩ +10s')}
                >
                  <Ionicons name="play-forward" size={18} color="#FFF" />
                  <Text style={styles.mediaBtnSub}>+10s</Text>
                </TouchableOpacity>
              </View>

              {/* Volume Controls */}
              <View style={styles.volumeRow}>
                <TouchableOpacity
                  style={styles.volBtn}
                  onPress={() => sendAction('volume_down', null, '🔉 Ses -')}
                >
                  <Ionicons name="volume-low" size={18} color="#FFF" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.volBtn}
                  onPress={() => sendAction('volume_mute', null, '🔇 Sessiz')}
                >
                  <Ionicons name="volume-mute" size={18} color="#E50914" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.volBtn}
                  onPress={() => sendAction('volume_up', null, '🔊 Ses +')}
                >
                  <Ionicons name="volume-high" size={18} color="#FFF" />
                </TouchableOpacity>
              </View>
            </View>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  remoteContainer: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.75,
    shadowRadius: 24,
    elevation: 25,
  },
  remoteGradient: {
    padding: 20,
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 12,
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandBadge: {
    backgroundColor: '#E50914',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  brandText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  noTvWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 152, 0, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 10,
    width: '100%',
  },
  noTvText: {
    color: '#FFB74D',
    fontSize: 11,
    flex: 1,
  },
  deviceSelectorWrap: {
    width: '100%',
    marginBottom: 8,
  },
  deviceList: {
    gap: 8,
  },
  tvChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  tvChipSelected: {
    backgroundColor: 'rgba(229, 9, 20, 0.18)',
    borderColor: '#E50914',
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#888',
    marginRight: 6,
  },
  onlineDotSelected: {
    backgroundColor: '#4ADE80',
  },
  tvChipText: {
    color: '#AAA',
    fontSize: 12,
    fontWeight: '600',
  },
  tvChipTextSelected: {
    color: '#FFF',
    fontWeight: '700',
  },
  actionIndicatorRow: {
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.3)',
  },
  actionPillText: {
    color: '#4ADE80',
    fontSize: 11,
    fontWeight: '700',
  },
  readyText: {
    color: '#666',
    fontSize: 11,
  },
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    width: '100%',
    marginBottom: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 13,
    paddingVertical: 0,
  },
  sendSearchBtn: {
    backgroundColor: '#E50914',
    paddingHorizontal: 10,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  tabsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 16,
    gap: 6,
  },
  tabBtn: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabBtnText: {
    color: '#CCC',
    fontSize: 9.5,
    fontWeight: '600',
  },
  dpadContainer: {
    width: 190,
    height: 190,
    backgroundColor: '#1b1b22',
    borderRadius: 95,
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 6,
    marginVertical: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  dpadBtn: {
    width: 52,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  dpadUp: {
    marginTop: 4,
  },
  dpadDown: {
    marginBottom: 4,
  },
  dpadMiddleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 4,
  },
  dpadLeft: {},
  dpadRight: {},
  dpadCenter: {
    width: 66,
    height: 66,
    borderRadius: 33,
    overflow: 'hidden',
    shadowColor: '#E50914',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
  },
  dpadCenterGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  okText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
  },
  navControlRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 40,
    width: '100%',
    marginVertical: 10,
  },
  navRoundBtn: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 2,
  },
  navBtnLabel: {
    color: '#AAA',
    fontSize: 10,
    fontWeight: '600',
  },
  mediaVolumeSection: {
    width: '100%',
    marginTop: 8,
    gap: 10,
  },
  mediaRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  mediaBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playPauseBtn: {
    backgroundColor: '#E50914',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 14,
  },
  mediaBtnSub: {
    color: '#AAA',
    fontSize: 8.5,
    fontWeight: '700',
    marginTop: 1,
  },
  volumeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  volBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
});
