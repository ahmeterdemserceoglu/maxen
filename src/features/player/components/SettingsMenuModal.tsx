import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableWithoutFeedback,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TVFocusable } from '@/components/TVFocusable';

export type SleepTimerValue = 'off' | 'end_of_episode' | 15 | 30 | 45 | 60;

interface SettingsMenuModalProps {
  visible: boolean;
  onClose: () => void;
  allowBackgroundAudio?: boolean;
  onToggleBackgroundAudio?: () => void;
  showStatsForNerds?: boolean;
  onToggleStatsForNerds?: () => void;
  onOpenSubtitleAppearance?: () => void;
  sleepTimer?: SleepTimerValue;
  onSelectSleepTimer?: (val: SleepTimerValue) => void;
  sleepRemainingSeconds?: number | null;
}

export function SettingsMenuModal({
  visible,
  onClose,
  allowBackgroundAudio = false,
  onToggleBackgroundAudio,
  showStatsForNerds = false,
  onToggleStatsForNerds,
  onOpenSubtitleAppearance,
  sleepTimer = 'off',
  onSelectSleepTimer,
  sleepRemainingSeconds,
}: SettingsMenuModalProps) {
  const [showSleepPicker, setShowSleepPicker] = React.useState(false);
  if (!visible) return null;

  return (
    <View style={styles.settingsOverlay}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.settingsCloseMask} />
      </TouchableWithoutFeedback>

      <View style={styles.settingsPanel}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIconBadge}>
              <Ionicons name="options-outline" size={18} color="#E50914" />
            </View>
            <View>
              <Text style={styles.headerTitle}>Gelişmiş Ayarlar</Text>
              <Text style={styles.headerSubtitle}>Oynatıcı ve sistem tercihleri</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={20} color="#8E8E93" />
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* 1. Arka Planda Ses Oynatma */}
          {onToggleBackgroundAudio && (
            <TVFocusable
              style={[styles.settingCard, allowBackgroundAudio && styles.settingCardActive]}
              focusedStyle={{
                borderColor: '#E50914',
                backgroundColor: 'rgba(255, 255, 255, 0.12)',
                transform: [{ scale: 1.02 }],
              }}
              onPress={onToggleBackgroundAudio}
            >
              <View style={[styles.cardIconBadge, { backgroundColor: allowBackgroundAudio ? 'rgba(229, 9, 20, 0.2)' : 'rgba(255, 255, 255, 0.06)' }]}>
                <Ionicons
                  name={allowBackgroundAudio ? 'headset' : 'headset-outline'}
                  size={22}
                  color={allowBackgroundAudio ? '#E50914' : '#A1A1AA'}
                />
              </View>

              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>Arka Planda Ses</Text>
                <Text style={styles.cardSubtitle}>
                  Ekran kilitliyken veya uygulama arkadayken ses çalmaya devam eder
                </Text>
              </View>

              {/* Status Switch Indicator */}
              <View style={[styles.switchTrack, allowBackgroundAudio && styles.switchTrackActive]}>
                <View style={[styles.switchThumb, allowBackgroundAudio && styles.switchThumbActive]} />
              </View>
            </TVFocusable>
          )}

          {/* 2. Stats for Nerds Telemetri Paneli */}
          {onToggleStatsForNerds && (
            <TVFocusable
              style={[styles.settingCard, showStatsForNerds && styles.settingCardActive]}
              focusedStyle={{
                borderColor: '#38BDF8',
                backgroundColor: 'rgba(255, 255, 255, 0.12)',
                transform: [{ scale: 1.02 }],
              }}
              onPress={onToggleStatsForNerds}
            >
              <View style={[styles.cardIconBadge, { backgroundColor: showStatsForNerds ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.06)' }]}>
                <Ionicons
                  name={showStatsForNerds ? 'stats-chart' : 'stats-chart-outline'}
                  size={22}
                  color={showStatsForNerds ? '#38BDF8' : '#A1A1AA'}
                />
              </View>

              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>Stats for Nerds</Text>
                <Text style={styles.cardSubtitle}>
                  Canlı çözünürlük, anlık bitrate, buffer tamponu ve fps göstergesi
                </Text>
              </View>

              {/* Status Switch Indicator */}
              <View style={[styles.switchTrack, showStatsForNerds && styles.switchTrackActiveCyan]}>
                <View style={[styles.switchThumb, showStatsForNerds && styles.switchThumbActive]} />
              </View>
            </TVFocusable>
          )}

          {/* 3. Altyazı Görünüm & Stil Ayarları */}
          {onOpenSubtitleAppearance && (
            <TVFocusable
              style={styles.settingCard}
              focusedStyle={{
                borderColor: '#A855F7',
                backgroundColor: 'rgba(255, 255, 255, 0.12)',
                transform: [{ scale: 1.02 }],
              }}
              onPress={() => {
                onClose();
                onOpenSubtitleAppearance();
              }}
            >
              <View style={[styles.cardIconBadge, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
                <Ionicons name="text-outline" size={22} color="#C084FC" />
              </View>

              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>Altyazı Stili & Boyutu</Text>
                <Text style={styles.cardSubtitle}>
                  Yazı boyutu, metin rengi, arka plan kutusu ve gölge seçenekleri
                </Text>
              </View>

              <View style={styles.chevronWrap}>
                <Ionicons name="chevron-forward" size={18} color="#71717A" />
              </View>
            </TVFocusable>
          )}

          {/* 4. Uyku Zamanlayıcısı (Sleep Timer) */}
          {onSelectSleepTimer && (
            <View style={{ marginTop: 4 }}>
              <TVFocusable
                style={[styles.settingCard, sleepTimer !== 'off' && styles.settingCardActiveAmber]}
                focusedStyle={{
                  borderColor: '#F59E0B',
                  backgroundColor: 'rgba(255, 255, 255, 0.12)',
                  transform: [{ scale: 1.02 }],
                }}
                onPress={() => setShowSleepPicker(!showSleepPicker)}
              >
                <View style={[styles.cardIconBadge, { backgroundColor: sleepTimer !== 'off' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.06)' }]}>
                  <Ionicons
                    name={sleepTimer !== 'off' ? 'moon' : 'moon-outline'}
                    size={22}
                    color={sleepTimer !== 'off' ? '#F59E0B' : '#A1A1AA'}
                  />
                </View>

                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>Uyku Zamanlayıcısı</Text>
                  <Text style={[styles.cardSubtitle, sleepTimer !== 'off' && { color: '#FCD34D' }]}>
                    {sleepTimer === 'off'
                      ? 'Kapalı (Kademeli ses sönümleme)'
                      : sleepTimer === 'end_of_episode'
                      ? '🎬 Bu bölüm bitince durdur'
                      : `⏱️ ${sleepTimer} dk ${sleepRemainingSeconds !== null && sleepRemainingSeconds !== undefined ? `(${Math.floor(sleepRemainingSeconds / 60)}:${(sleepRemainingSeconds % 60) < 10 ? '0' : ''}${sleepRemainingSeconds % 60})` : ''}`}
                  </Text>
                </View>

                <View style={styles.chevronWrap}>
                  <Ionicons name={showSleepPicker ? 'chevron-up' : 'chevron-down'} size={18} color="#71717A" />
                </View>
              </TVFocusable>

              {/* Sleep Timer Picker Options */}
              {showSleepPicker && (
                <View style={styles.sleepOptionsGrid}>
                  {[
                    { label: 'Kapalı', val: 'off' as SleepTimerValue },
                    { label: 'Bölüm Bitince', val: 'end_of_episode' as SleepTimerValue },
                    { label: '15 dk', val: 15 as SleepTimerValue },
                    { label: '30 dk', val: 30 as SleepTimerValue },
                    { label: '45 dk', val: 45 as SleepTimerValue },
                    { label: '60 dk', val: 60 as SleepTimerValue },
                  ].map((opt) => {
                    const isSelected = sleepTimer === opt.val;
                    return (
                      <TVFocusable
                        key={String(opt.val)}
                        style={[styles.sleepChip, isSelected && styles.sleepChipActive]}
                        focusedStyle={styles.sleepChipFocused}
                        onPress={() => {
                          onSelectSleepTimer(opt.val);
                          setShowSleepPicker(false);
                        }}
                      >
                        <Text style={[styles.sleepChipText, isSelected && styles.sleepChipTextActive]}>
                          {opt.label}
                        </Text>
                      </TVFocusable>
                    );
                  })}
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  settingsOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  settingsCloseMask: {
    ...StyleSheet.absoluteFillObject,
  },
  settingsPanel: {
    width: 350,
    backgroundColor: '#0D0E12',
    borderRadius: 22,
    marginRight: 24,
    paddingTop: 18,
    paddingBottom: 14,
    paddingHorizontal: 16,
    maxHeight: '88%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(229, 9, 20, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.25)',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    color: '#71717A',
    fontSize: 11,
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 12,
  },
  scrollContent: {
    gap: 10,
    paddingBottom: 6,
  },
  settingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  settingCardActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  cardIconBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardContent: {
    flex: 1,
    paddingRight: 10,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 3,
  },
  cardSubtitle: {
    color: '#A1A1AA',
    fontSize: 11,
    lineHeight: 15,
  },
  switchTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#27272A',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  switchTrackActive: {
    backgroundColor: '#E50914',
  },
  switchTrackActiveCyan: {
    backgroundColor: '#0284C7',
  },
  switchThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
  },
  chevronWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingCardActiveAmber: {
    borderColor: 'rgba(245, 158, 11, 0.6)',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
  },
  sleepOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sleepChip: {
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  sleepChipActive: {
    backgroundColor: '#F59E0B',
    borderColor: '#FCD34D',
  },
  sleepChipFocused: {
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.05 }],
  },
  sleepChipText: {
    fontSize: 12,
    color: '#A1A1AA',
    fontWeight: '600',
  },
  sleepChipTextActive: {
    color: '#000000',
    fontWeight: '800',
  },
});
