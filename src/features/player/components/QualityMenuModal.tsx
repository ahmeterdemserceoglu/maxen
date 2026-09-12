import { TVModalSurface } from '@/components/TVModalSurface';
import { TVTouchable } from '@/components/TVTouchable';
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

const isTV = Platform.isTV;

export interface QualityOption {
  id: string;
  label: string;
  badge: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const QUALITY_OPTIONS: QualityOption[] = [
  {
    id: 'auto',
    label: 'Otomatik (Önerilen)',
    badge: 'ABR',
    description: 'İnternet hızınıza göre dinamik optimize edilir',
    icon: 'sparkles-outline',
  },
  {
    id: '1080p',
    label: '1080p Full HD',
    badge: 'FHD',
    description: 'En yüksek netlik, keskinlik ve detay',
    icon: 'film-outline',
  },
  {
    id: '720p',
    label: '720p HD',
    badge: 'HD',
    description: 'Dengeli veri tüketimi ve yüksek kalite',
    icon: 'tv-outline',
  },
  {
    id: '480p',
    label: '480p SD',
    badge: 'SD',
    description: 'Akıcı oynatma ve standart veri tasarrufu',
    icon: 'cellular-outline',
  },
  {
    id: '360p',
    label: '360p Düşük Veri',
    badge: 'ECO',
    description: 'Düşük bağlantı hızları için maksimum tasarruf',
    icon: 'leaf-outline',
  },
];

interface QualityMenuModalProps {
  visible: boolean;
  onClose: () => void;
  selectedQuality: string;
  onSelectQuality: (qualityId: string) => void;
  availableQualities?: string[];
}

export function QualityMenuModal({
  visible,
  onClose,
  selectedQuality,
  onSelectQuality,
  availableQualities,
}: QualityMenuModalProps) {
  if (!visible) return null;

  const displayOptions = QUALITY_OPTIONS.filter((opt) => {
    if (opt.id === 'auto') return true;
    if (!availableQualities || availableQualities.length === 0) return true;
    return availableQualities.includes(opt.id);
  });

  return (
    <TVModalSurface onClose={onClose} style={styles.overlay}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.closeMask} />
      </TouchableWithoutFeedback>

      <View style={[styles.panel, isTV && { width: 420 }]}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIconBadge}>
              <Ionicons name="sparkles" size={18} color="#38BDF8" />
            </View>
            <View>
              <Text style={styles.headerTitle}>Görüntü Kalitesi</Text>
              <Text style={styles.headerSubtitle}>Akış çözünürlük tercihi</Text>
            </View>
          </View>
          <TVTouchable
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={20} color="#8E8E93" />
          </TVTouchable>
        </View>

        <View style={styles.divider} />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {displayOptions.map((opt) => {
            const isSelected = selectedQuality === opt.id;
            return (
              <TVFocusable
                key={opt.id}
                hasTVPreferredFocus={isTV && isSelected}
                style={[
                  styles.qualityCard, 
                  isSelected && styles.qualityCardActive,
                  isTV && { minHeight: 64, paddingVertical: 16 }
                ]}
                focusedStyle={{
                  borderColor: '#E50914',
                  borderWidth: 2,
                  backgroundColor: 'rgba(255, 255, 255, 0.12)',
                  transform: [{ scale: 1.02 }],
                }}
                onPress={() => {
                  onSelectQuality(opt.id);
                  onClose();
                }}
              >
                <View style={[styles.cardIconBadge, isSelected && styles.cardIconBadgeActive, isTV && { width: 48, height: 48 }]}>
                  <Ionicons
                    name={opt.icon}
                    size={isTV ? 28 : 20}
                    color={isSelected ? '#38BDF8' : '#A1A1AA'}
                  />
                </View>

                <View style={styles.cardContent}>
                  <View style={styles.cardTitleRow}>
                    <Text style={[styles.cardTitle, isTV && { fontSize: 18 }, isSelected && styles.cardTitleActive]}>
                      {opt.label}
                    </Text>
                    <View style={[styles.badgePill, isSelected && styles.badgePillActive, isTV && { paddingHorizontal: 10, paddingVertical: 4 }]}>
                      <Text style={[styles.badgeTxt, isTV && { fontSize: 14 }, isSelected && styles.badgeTxtActive]}>
                        {opt.badge}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.cardSubtitle, isTV && { fontSize: 13, lineHeight: 18 }]}>{opt.description}</Text>
                </View>

                {isSelected ? (
                  <View style={styles.checkWrap}>
                    <Ionicons name="checkmark-circle" size={isTV ? 28 : 22} color="#38BDF8" />
                  </View>
                ) : (
                  <View style={[styles.uncheckWrap, isTV && { width: 28, height: 28, borderRadius: 14 }]} />
                )}
              </TVFocusable>
            );
          })}
        </ScrollView>
      </View>
    </TVModalSurface>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  closeMask: {
    ...StyleSheet.absoluteFillObject,
  },
  panel: {
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
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    color: '#71717A',
    fontSize: Platform.isTV ? 15 : 11,
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
  qualityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  qualityCardActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  cardIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardIconBadgeActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
  },
  cardContent: {
    flex: 1,
    paddingRight: 8,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: Platform.isTV ? 17 : 14,
    fontWeight: '600',
  },
  cardTitleActive: {
    color: '#38BDF8',
    fontWeight: '700',
  },
  badgePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgePillActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
  },
  badgeTxt: {
    color: '#A1A1AA',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  badgeTxtActive: {
    color: '#38BDF8',
  },
  cardSubtitle: {
    color: '#A1A1AA',
    fontSize: 11,
    lineHeight: 15,
  },
  checkWrap: {
    marginLeft: 6,
  },
  uncheckWrap: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    marginLeft: 6,
  },
});
