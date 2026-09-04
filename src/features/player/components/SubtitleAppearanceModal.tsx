import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableWithoutFeedback,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { TVFocusable } from '@/components/TVFocusable';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SubtitleSettings {
  fontSize: number;
  color: string;
  backgroundColor: string;
  textShadowRadius: number;
  textShadowColor: string;
}

export const DEFAULT_SUBTITLE_SETTINGS: SubtitleSettings = {
  fontSize: 24,
  color: '#ffffff',
  backgroundColor: 'transparent',
  textShadowRadius: 4,
  textShadowColor: 'rgba(0,0,0,1)',
};

interface SubtitleAppearanceModalProps {
  visible: boolean;
  onClose: () => void;
  settings: SubtitleSettings;
  onSettingsChange: (settings: SubtitleSettings) => void;
}

export function SubtitleAppearanceModal({
  visible,
  onClose,
  settings,
  onSettingsChange,
}: SubtitleAppearanceModalProps) {
  const { width, height } = useWindowDimensions();

  const isLandscape = width > height;
  const isSmallScreen = width < 600;
  const isTablet = width >= 600 && width < 1000;

  const [localSettings, setLocalSettings] =
    useState<SubtitleSettings>(settings);

  useEffect(() => {
    if (visible) {
      setLocalSettings(settings);
    }
  }, [visible, settings]);

  const updateSetting = (
    key: keyof SubtitleSettings,
    value: any
  ) => {
    const newSettings = {
      ...localSettings,
      [key]: value,
    };

    setLocalSettings(newSettings);
    onSettingsChange(newSettings);

    AsyncStorage.setItem(
      'subtitle_appearance_settings',
      JSON.stringify(newSettings)
    ).catch(() => { });
  };

  if (!visible) return null;

  const verticalLayout = !isLandscape || isSmallScreen;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        <View
          style={[
            styles.panel,
            verticalLayout
              ? styles.panelVertical
              : styles.panelLandscape,
            isTablet && styles.panelTablet,
          ]}
        >
          {/* HEADER */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIcon}>
                <Ionicons
                  name="text-outline"
                  size={19}
                  color="#fff"
                />
              </View>

              <View>
                <Text style={styles.headerTitle}>
                  Altyazı Görünümü
                </Text>

                <Text style={styles.headerSubtitle}>
                  Yazı stilini özelleştir
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              activeOpacity={0.7}
            >
              <Ionicons
                name="close"
                size={22}
                color="#fff"
              />
            </TouchableOpacity>
          </View>

          {/* CONTENT */}
          <View
            style={[
              styles.content,
              verticalLayout
                ? styles.contentVertical
                : styles.contentLandscape,
            ]}
          >
            {/* PREVIEW */}
            <View
              style={[
                styles.previewContainer,
                verticalLayout
                  ? styles.previewContainerVertical
                  : styles.previewContainerLandscape,
              ]}
            >
              <View style={styles.previewHeader}>
                <Text style={styles.previewHint}>
                  ÖNİZLEME
                </Text>

                <View style={styles.liveIndicator}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>
                    CANLI
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.previewBox,
                  verticalLayout
                    ? styles.previewBoxVertical
                    : styles.previewBoxLandscape,
                ]}
              >
                <View style={styles.previewScene}>
                  <View style={styles.sceneGlow} />

                  <View style={styles.sceneLines}>
                    <View style={styles.sceneLineOne} />
                    <View style={styles.sceneLineTwo} />
                    <View style={styles.sceneLineThree} />
                  </View>

                  <Text
                    style={[
                      styles.previewText,
                      {
                        fontSize: localSettings.fontSize,
                        color: localSettings.color,
                        backgroundColor:
                          localSettings.backgroundColor,
                        textShadowRadius:
                          localSettings.textShadowRadius,
                        textShadowColor:
                          localSettings.textShadowColor,
                      },
                    ]}
                  >
                    Bu örnek bir altyazı metnidir.
                  </Text>
                </View>
              </View>
            </View>

            {/* SETTINGS */}
            <ScrollView
              style={[
                styles.scrollView,
                verticalLayout
                  ? styles.scrollViewVertical
                  : styles.scrollViewLandscape,
              ]}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {/* SIZE */}
              <Text style={styles.sectionTitle}>
                METİN BOYUTU
              </Text>

              <View style={styles.optionsGrid}>
                {[
                  { label: 'Küçük', value: 18 },
                  { label: 'Normal', value: 24 },
                  { label: 'Büyük', value: 30 },
                  { label: 'Ekstra', value: 36 },
                ].map((opt) => {
                  const active =
                    localSettings.fontSize === opt.value;

                  return (
                    <TVFocusable
                      key={`size-${opt.value}`}
                      style={[
                        styles.optionChip,
                        active && styles.optionChipActive,
                        verticalLayout &&
                        styles.optionChipMobile,
                      ]}
                      focusedStyle={styles.focusedChip}
                      onPress={() =>
                        updateSetting(
                          'fontSize',
                          opt.value
                        )
                      }
                    >
                      <Text
                        style={[
                          styles.optionText,
                          active &&
                          styles.optionTextActive,
                        ]}
                      >
                        {opt.label}
                      </Text>

                      {active && (
                        <Ionicons
                          name="checkmark"
                          size={16}
                          color="#fff"
                          style={styles.checkIcon}
                        />
                      )}
                    </TVFocusable>
                  );
                })}
              </View>

              {/* COLOR */}
              <Text style={styles.sectionTitle}>
                METİN RENGİ
              </Text>

              <View style={styles.optionsGrid}>
                {[
                  {
                    label: 'Beyaz',
                    value: '#ffffff',
                  },
                  {
                    label: 'Sarı',
                    value: '#ffd500',
                  },
                  {
                    label: 'Yeşil',
                    value: '#00ff40',
                  },
                  {
                    label: 'Camgöbeği',
                    value: '#00e5ff',
                  },
                ].map((opt) => {
                  const active =
                    localSettings.color === opt.value;

                  return (
                    <TVFocusable
                      key={`color-${opt.value}`}
                      style={[
                        styles.optionChip,
                        active && styles.optionChipActive,
                        verticalLayout &&
                        styles.optionChipMobile,
                      ]}
                      focusedStyle={styles.focusedChip}
                      onPress={() =>
                        updateSetting(
                          'color',
                          opt.value
                        )
                      }
                    >
                      <View
                        style={[
                          styles.colorDot,
                          {
                            backgroundColor:
                              opt.value,
                          },
                        ]}
                      />

                      <Text
                        style={[
                          styles.optionText,
                          active &&
                          styles.optionTextActive,
                        ]}
                      >
                        {opt.label}
                      </Text>

                      {active && (
                        <Ionicons
                          name="checkmark"
                          size={16}
                          color="#fff"
                          style={styles.checkIcon}
                        />
                      )}
                    </TVFocusable>
                  );
                })}
              </View>

              {/* BACKGROUND */}
              <Text style={styles.sectionTitle}>
                ARKA PLAN
              </Text>

              <View style={styles.optionsGrid}>
                {[
                  {
                    label: 'Yok',
                    value: 'transparent',
                  },
                  {
                    label: 'Yarı Saydam',
                    value: 'rgba(0,0,0,0.5)',
                  },
                  {
                    label: 'Koyu',
                    value: 'rgba(0,0,0,0.85)',
                  },
                ].map((opt) => {
                  const active =
                    localSettings.backgroundColor ===
                    opt.value;

                  return (
                    <TVFocusable
                      key={`bg-${opt.label}`}
                      style={[
                        styles.optionChip,
                        active && styles.optionChipActive,
                        verticalLayout &&
                        styles.optionChipMobile,
                      ]}
                      focusedStyle={styles.focusedChip}
                      onPress={() =>
                        updateSetting(
                          'backgroundColor',
                          opt.value
                        )
                      }
                    >
                      <Text
                        style={[
                          styles.optionText,
                          active &&
                          styles.optionTextActive,
                        ]}
                      >
                        {opt.label}
                      </Text>

                      {active && (
                        <Ionicons
                          name="checkmark"
                          size={16}
                          color="#fff"
                          style={styles.checkIcon}
                        />
                      )}
                    </TVFocusable>
                  );
                })}
              </View>

              {/* SHADOW */}
              <Text style={styles.sectionTitle}>
                GÖLGE / KENARLIK
              </Text>

              <View style={styles.optionsGrid}>
                {[
                  {
                    label: 'Yok',
                    r: 0,
                    c: 'transparent',
                  },
                  {
                    label: 'Hafif',
                    r: 2,
                    c: 'rgba(0,0,0,0.8)',
                  },
                  {
                    label: 'Belirgin',
                    r: 5,
                    c: 'rgba(0,0,0,1)',
                  },
                ].map((opt) => {
                  const active =
                    localSettings.textShadowRadius ===
                    opt.r;

                  return (
                    <TVFocusable
                      key={`shadow-${opt.label}`}
                      style={[
                        styles.optionChip,
                        active && styles.optionChipActive,
                        verticalLayout &&
                        styles.optionChipMobile,
                      ]}
                      focusedStyle={styles.focusedChip}
                      onPress={() => {
                        const newSettings = {
                          ...localSettings,
                          textShadowRadius: opt.r,
                          textShadowColor: opt.c,
                        };

                        setLocalSettings(
                          newSettings
                        );
                        onSettingsChange(
                          newSettings
                        );

                        AsyncStorage.setItem(
                          'subtitle_appearance_settings',
                          JSON.stringify(
                            newSettings
                          )
                        ).catch(() => { });
                      }}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          active &&
                          styles.optionTextActive,
                        ]}
                      >
                        {opt.label}
                      </Text>

                      {active && (
                        <Ionicons
                          name="checkmark"
                          size={16}
                          color="#fff"
                          style={styles.checkIcon}
                        />
                      )}
                    </TVFocusable>
                  );
                })}
              </View>

              {/* RESET */}
              <TVFocusable
                style={styles.resetBtn}
                focusedStyle={styles.focusedResetBtn}
                onPress={() => {
                  setLocalSettings(
                    DEFAULT_SUBTITLE_SETTINGS
                  );

                  onSettingsChange(
                    DEFAULT_SUBTITLE_SETTINGS
                  );

                  AsyncStorage.setItem(
                    'subtitle_appearance_settings',
                    JSON.stringify(
                      DEFAULT_SUBTITLE_SETTINGS
                    )
                  ).catch(() => { });
                }}
              >
                <Ionicons
                  name="refresh-outline"
                  size={17}
                  color="#ff5b61"
                />

                <Text style={styles.resetBtnTxt}>
                  Varsayılana Dön
                </Text>
              </TVFocusable>

              <View style={styles.bottomSpace} />
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },

  /* =========================
     PANEL
  ========================= */

  panel: {
    backgroundColor: '#111214',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    overflow: 'hidden',
    elevation: 24,

    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 24,
    shadowOffset: {
      width: 0,
      height: 12,
    },
  },

  panelVertical: {
    width: '92%',
    height: '88%',
    maxHeight: 720,
  },

  panelLandscape: {
    width: '88%',
    height: '78%',
    maxWidth: 1050,
    maxHeight: 650,
  },

  panelTablet: {
    width: '84%',
  },

  /* =========================
     HEADER
  ========================= */

  header: {
    minHeight: 68,
    paddingHorizontal: 18,
    paddingVertical: 12,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',

    backgroundColor: '#0d0e10',

    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },

  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },

  headerSubtitle: {
    color: '#85858c',
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },

  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: 'rgba(255,255,255,0.07)',
  },

  /* =========================
     CONTENT
  ========================= */

  content: {
    flex: 1,
  },

  contentLandscape: {
    flexDirection: 'row',
  },

  contentVertical: {
    flexDirection: 'column',
  },

  /* =========================
     PREVIEW
  ========================= */

  previewContainer: {
    backgroundColor: '#0b0c0e',
  },

  previewContainerLandscape: {
    width: '45%',
    padding: 20,

    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.06)',

    justifyContent: 'center',
  },

  previewContainerVertical: {
    width: '100%',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,

    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },

  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',

    marginBottom: 10,
  },

  previewHint: {
    color: '#7f8087',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.8,
  },

  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },

  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#48e083',
  },

  liveText: {
    color: '#85868d',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },

  previewBox: {
    width: '100%',
    overflow: 'hidden',

    borderRadius: 14,
    backgroundColor: '#191a1d',

    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },

  previewBoxLandscape: {
    aspectRatio: 16 / 9,
  },

  previewBoxVertical: {
    height: 150,
  },

  previewScene: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',

    paddingHorizontal: 12,
    paddingBottom: 22,

    backgroundColor: '#17181b',
    overflow: 'hidden',
  },

  sceneGlow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,

    backgroundColor: 'rgba(90,90,110,0.10)',

    top: -80,
    right: -60,
  },

  sceneLines: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.5,
  },

  sceneLineOne: {
    position: 'absolute',
    width: '130%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    transform: [{ rotate: '-8deg' }],
    top: '35%',
  },

  sceneLineTwo: {
    position: 'absolute',
    width: '120%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.035)',
    transform: [{ rotate: '12deg' }],
    top: '55%',
  },

  sceneLineThree: {
    position: 'absolute',
    width: '140%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.025)',
    transform: [{ rotate: '-4deg' }],
    top: '72%',
  },

  previewText: {
    fontWeight: '800',
    textAlign: 'center',

    textShadowOffset: {
      width: 1,
      height: 1,
    },

    paddingHorizontal: 10,
    paddingVertical: 3,

    borderRadius: 5,
  },

  /* =========================
     SETTINGS
  ========================= */

  scrollView: {
    flex: 1,
  },

  scrollViewLandscape: {
    width: '55%',
  },

  scrollViewVertical: {
    width: '100%',
  },

  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 30,
  },

  sectionTitle: {
    color: '#85868d',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,

    marginTop: 18,
    marginBottom: 9,
  },

  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  optionChip: {
    minHeight: 43,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',

    paddingHorizontal: 14,

    borderRadius: 11,

    backgroundColor: 'rgba(255,255,255,0.055)',

    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.035)',
  },

  optionChipMobile: {
    flexGrow: 1,
    minWidth: '30%',
  },

  optionChipActive: {
    backgroundColor: 'rgba(40,110,220,0.18)',
    borderColor: 'rgba(64,135,240,0.8)',
  },

  focusedChip: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    transform: [{ scale: 1.025 }],
  },

  colorDot: {
    width: 13,
    height: 13,
    borderRadius: 7,

    marginRight: 8,

    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.5)',
  },

  optionText: {
    color: '#d9d9de',
    fontSize: 13,
    fontWeight: '600',
  },

  optionTextActive: {
    color: '#fff',
    fontWeight: '800',
  },

  checkIcon: {
    marginLeft: 7,
  },

  /* =========================
     RESET
  ========================= */

  resetBtn: {
    marginTop: 25,

    minHeight: 45,

    paddingHorizontal: 18,

    borderRadius: 11,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',

    gap: 8,

    backgroundColor: 'rgba(229,9,20,0.08)',

    borderWidth: 1,
    borderColor: 'rgba(229,9,20,0.25)',
  },

  focusedResetBtn: {
    backgroundColor: 'rgba(229,9,20,0.20)',
    transform: [{ scale: 1.015 }],
  },

  resetBtnTxt: {
    color: '#ff646a',
    fontWeight: '800',
    fontSize: 13,
  },

  bottomSpace: {
    height: 10,
  },
});
