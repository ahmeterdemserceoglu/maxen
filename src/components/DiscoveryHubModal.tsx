import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  BackHandler,
  Platform,
  Animated,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { TVFocusable } from '@/components/TVFocusable';

interface DiscoveryHubModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectSearch: () => void;
  onSelectReels: () => void;
  onSelectComingSoon: () => void;
  onSelectDownloads?: () => void;
}

export function DiscoveryHubModal({
  visible,
  onClose,
  onSelectSearch,
  onSelectReels,
  onSelectComingSoon,
  onSelectDownloads,
}: DiscoveryHubModalProps) {
  const isTV = Platform.isTV;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  // TV / Android Geri Tuşu Yakalama
  useEffect(() => {
    if (!visible) return;
    const onBackPress = () => {
      onClose();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [visible, onClose]);

  // Giriş Animasyonu
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 65,
          friction: 9,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.95);
    }
  }, [visible, fadeAnim, scaleAnim]);

  if (!visible) return null;

  const handleSelect = (callback: () => void) => {
    onClose();
    setTimeout(() => {
      callback();
    }, 60);
  };

  return (
    <Animated.View
      style={[
        styles.modalOverlay,
        {
          opacity: fadeAnim,
        },
      ]}
      pointerEvents="box-none"
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <Animated.View
              style={[
                styles.modal,
                isTV && styles.modalTV,
                { transform: [{ scale: scaleAnim }] },
              ]}
            >
              {/* ÜST GRADYAN */}
              <LinearGradient
                pointerEvents="none"
                colors={[
                  'rgba(229, 9, 20, 0.16)',
                  'rgba(229, 9, 20, 0.03)',
                  'transparent',
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0.7 }}
                style={styles.topGlow}
              />

              {/* HEADER */}
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <View style={styles.logoMark}>
                    <LinearGradient
                      colors={['#FF2634', '#B8000C']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.logoMarkGradient}
                    >
                      <Ionicons
                        name="compass"
                        size={isTV ? 26 : 20}
                        color="#fff"
                      />
                    </LinearGradient>
                  </View>

                  <View style={styles.headerText}>
                    <Text style={styles.eyebrow}>MAXEN</Text>
                    <Text style={[styles.title, isTV && styles.titleTV]}>Keşfet & Bul</Text>
                  </View>
                </View>

                {/* Kapatma Butonu (Kumanda Odaklanabilir) */}
                <TVFocusable
                  onPress={onClose}
                  style={[styles.closeButton, isTV && styles.closeButtonTV]}
                  focusedStyle={styles.closeButtonFocused}
                  accessibilityLabel="Kapat"
                >
                  <Ionicons
                    name="close"
                    size={isTV ? 26 : 21}
                    color="#FFFFFF"
                  />
                </TVFocusable>
              </View>

              {/* SUBTITLE */}
              <Text style={[styles.subtitle, isTV && styles.subtitleTV]}>
                İzlemek istediğiniz içeriği bulun, trend fragmanları izleyin veya vizyon takvimini takip edin.
              </Text>

              {/* OPTIONS LIST */}
              <View style={[styles.options, isTV && styles.optionsTV]}>
                {/* 1. GELİŞMİŞ ARAMA (İlk TV Odağı) */}
                <TVFocusable
                  hasTVPreferredFocus={isTV}
                  style={[styles.option, isTV && styles.optionTV]}
                  focusedStyle={isTV ? StyleSheet.flatten([styles.optionFocused, styles.optionFocusedTV]) : undefined}
                  onPress={() => handleSelect(onSelectSearch)}
                  accessibilityLabel="Gelişmiş Arama"
                >
                  <View style={[styles.optionGlow, styles.searchGlow]} />

                  <View style={[styles.iconBox, styles.searchIconBox, isTV && styles.iconBoxTV]}>
                    <Ionicons
                      name="search"
                      size={isTV ? 32 : 25}
                      color="#E50914"
                    />
                  </View>

                  <View style={styles.optionContent}>
                    <Text style={[styles.optionNumber, isTV && styles.optionNumberTV]}>
                      01
                    </Text>

                    <Text style={[styles.optionTitle, isTV && styles.optionTitleTV]}>
                      Gelişmiş Arama
                    </Text>

                    <Text style={[styles.optionDescription, isTV && styles.optionDescriptionTV]}>
                      Tür, yıl, puan ve oyunculara göre filtreleyin.
                    </Text>
                  </View>

                  {!isTV && (
                    <View style={styles.arrow}>
                      <Ionicons name="arrow-forward" size={19} color="#77777D" />
                    </View>
                  )}
                </TVFocusable>

                {/* 2. REELS FRAGMANLAR */}
                <TVFocusable
                  style={[styles.option, isTV && styles.optionTV]}
                  focusedStyle={isTV ? StyleSheet.flatten([styles.optionFocused, styles.reelsFocused, styles.optionFocusedTV]) : undefined}
                  onPress={() => handleSelect(onSelectReels)}
                  accessibilityLabel="Shorts Fragmanlar"
                >
                  <View style={[styles.optionGlow, styles.reelsGlow]} />

                  <View style={[styles.iconBox, styles.reelsIconBox, isTV && styles.iconBoxTV]}>
                    <Ionicons
                      name="play"
                      size={isTV ? 30 : 23}
                      color="#FF7A18"
                    />
                  </View>

                  <View style={styles.optionContent}>
                    <View style={styles.titleLine}>
                      <Text style={[styles.optionNumber, isTV && styles.optionNumberTV]}>
                        02
                      </Text>

                      <View style={styles.trendBadge}>
                        <View style={styles.liveDot} />
                        <Text style={styles.trendText}>TREND</Text>
                      </View>
                    </View>

                    <Text style={[styles.optionTitle, isTV && styles.optionTitleTV]}>
                      Shorts Fragmanlar
                    </Text>

                    <Text style={[styles.optionDescription, isTV && styles.optionDescriptionTV]}>
                      Popüler dizi ve film fragmanlarını dikey izleyin.
                    </Text>
                  </View>

                  {!isTV && (
                    <View style={styles.arrow}>
                      <Ionicons name="arrow-forward" size={19} color="#77777D" />
                    </View>
                  )}
                </TVFocusable>

                {/* 3. VİZYON TAKVİMİ */}
                <TVFocusable
                  style={[styles.option, isTV && styles.optionTV]}
                  focusedStyle={isTV ? StyleSheet.flatten([styles.optionFocused, styles.calendarFocused, styles.optionFocusedTV]) : undefined}
                  onPress={() => handleSelect(onSelectComingSoon)}
                  accessibilityLabel="Vizyon Takvimi"
                >
                  <View style={[styles.optionGlow, styles.calendarGlow]} />

                  <View style={[styles.iconBox, styles.calendarIconBox, isTV && styles.iconBoxTV]}>
                    <Ionicons
                      name="calendar"
                      size={isTV ? 30 : 24}
                      color="#4D9EFF"
                    />
                  </View>

                  <View style={styles.optionContent}>
                    <Text style={[styles.optionNumber, isTV && styles.optionNumberTV]}>
                      03
                    </Text>

                    <Text style={[styles.optionTitle, isTV && styles.optionTitleTV]}>
                      Vizyon Takvimi
                    </Text>

                    <Text style={[styles.optionDescription, isTV && styles.optionDescriptionTV]}>
                      Yakında yayınlanacak yapımları takip edin.
                    </Text>
                  </View>

                  {!isTV && (
                    <View style={styles.arrow}>
                      <Ionicons name="arrow-forward" size={19} color="#77777D" />
                    </View>
                  )}
                </TVFocusable>

                {/* 4. İNDİRİLENLER */}
                {onSelectDownloads && (
                  <TVFocusable
                    style={[styles.option, isTV && styles.optionTV]}
                    focusedStyle={isTV ? StyleSheet.flatten([styles.optionFocused, styles.optionFocusedTV]) : undefined}
                    onPress={() => handleSelect(onSelectDownloads)}
                    accessibilityLabel="İndirilenler"
                  >
                    <View style={[styles.optionGlow, { backgroundColor: 'rgba(0, 229, 255, 0.25)' }]} />

                    <View style={[styles.iconBox, { backgroundColor: 'rgba(0, 229, 255, 0.12)', borderColor: 'rgba(0, 229, 255, 0.25)' }, isTV && styles.iconBoxTV]}>
                      <Ionicons
                        name="cloud-offline-outline"
                        size={isTV ? 30 : 24}
                        color="#00E5FF"
                      />
                    </View>

                    <View style={styles.optionContent}>
                      <Text style={[styles.optionNumber, isTV && styles.optionNumberTV]}>
                        04
                      </Text>

                      <Text style={[styles.optionTitle, isTV && styles.optionTitleTV]}>
                        İndirilenler
                      </Text>

                      <Text style={[styles.optionDescription, isTV && styles.optionDescriptionTV]}>
                        Çevrimdışı izlemek için indirdiğiniz içerikler.
                      </Text>
                    </View>

                    {!isTV && (
                      <View style={styles.arrow}>
                        <Ionicons name="arrow-forward" size={19} color="#77777D" />
                      </View>
                    )}
                  </TVFocusable>
                )}
              </View>

              {/* FOOTER */}
              <View style={styles.footer}>
                <View style={styles.footerLine} />

                <View style={styles.footerContent}>
                  <Ionicons
                    name={isTV ? 'game-controller-outline' : 'hand-left-outline'}
                    size={16}
                    color="#888890"
                  />

                  <Text style={[styles.footerText, isTV && styles.footerTextTV]}>
                    {isTV
                      ? 'Kumanda yön tuşlarıyla seçin, OK tuşu ile açın • Geri ile kapatın'
                      : 'Bir seçenek seçerek devam edin'}
                  </Text>
                </View>
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  /* ================================
     BACKDROP
  ================================= */

  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99999,
    elevation: 99999,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
  },
  modal: {
    width: '100%',
    maxWidth: 560,
    backgroundColor: '#111114',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 22,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.85,
    shadowRadius: 30,
    elevation: 25,
  },
  modalTV: {
    maxWidth: 960,
    padding: 34,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  topGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 220,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logoMark: {
    width: 44,
    height: 44,
    borderRadius: 14,
    overflow: 'hidden',
    marginRight: 14,
  },
  logoMarkGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    justifyContent: 'center',
  },
  eyebrow: {
    color: '#E50914',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2.5,
    marginBottom: 2,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  titleTV: {
    fontSize: 26,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  closeButtonTV: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  closeButtonFocused: {
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 2,
    transform: [{ scale: 1.08 }],
  },
  subtitle: {
    color: '#9E9EA6',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 10,
    marginBottom: 20,
  },
  subtitleTV: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
    marginBottom: 26,
  },
  options: {
    gap: 12,
  },
  optionsTV: {
    flexDirection: 'row',
    gap: 16,
  },
  option: {
    minHeight: 90,
    borderRadius: 18,
    backgroundColor: '#19191D',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    overflow: 'hidden',
  },
  optionTV: {
    flex: 1,
    minHeight: 220,
    borderRadius: 22,
    padding: 22,
    alignItems: 'flex-start',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  optionFocused: {
    backgroundColor: '#26262B',
    borderColor: '#E50914',
    borderWidth: 2.5,
    transform: [{ scale: 1.03 }],
    shadowColor: '#E50914',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  optionFocusedTV: {
    transform: [{ scale: 1.05 }],
    borderWidth: 3,
    borderColor: '#E50914',
  },
  reelsFocused: {
    borderColor: '#FF7A18',
    shadowColor: '#FF7A18',
  },
  calendarFocused: {
    borderColor: '#4D9EFF',
    shadowColor: '#4D9EFF',
  },
  optionGlow: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    left: -70,
    top: -70,
    opacity: 0.25,
  },
  searchGlow: {
    backgroundColor: '#E50914',
  },
  reelsGlow: {
    backgroundColor: '#FF7A18',
  },
  calendarGlow: {
    backgroundColor: '#4D9EFF',
  },
  iconBox: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconBoxTV: {
    width: 68,
    height: 68,
    borderRadius: 20,
    marginBottom: 16,
  },
  searchIconBox: {
    backgroundColor: 'rgba(229,9,20,0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(229,9,20,0.25)',
  },
  reelsIconBox: {
    backgroundColor: 'rgba(255,122,24,0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,122,24,0.25)',
  },
  calendarIconBox: {
    backgroundColor: 'rgba(77,158,255,0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(77,158,255,0.25)',
  },
  optionContent: {
    flex: 1,
    marginLeft: 14,
  },
  optionNumber: {
    color: '#6E6E76',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 3,
  },
  optionNumberTV: {
    fontSize: 11,
    marginBottom: 4,
  },
  optionTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.15,
  },
  optionTitleTV: {
    fontSize: 19,
    marginBottom: 6,
  },
  optionDescription: {
    color: '#8E8E96',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
    fontWeight: '500',
  },
  optionDescriptionTV: {
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 0,
  },
  arrow: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  titleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(229,9,20,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(229,9,20,0.22)',
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E50914',
    marginRight: 5,
  },
  trendText: {
    color: '#E50914',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  footer: {
    marginTop: 20,
  },
  footerLine: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginBottom: 12,
  },
  footerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: {
    color: '#7E7E88',
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 8,
  },
  footerTextTV: {
    fontSize: 13,
    color: '#9E9EA8',
  },
});