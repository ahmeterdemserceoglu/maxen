import { TVTouchable } from '@/components/TVTouchable';
import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Platform,
  useWindowDimensions,
  Modal,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sendPasswordResetEmail } from 'firebase/auth';
import { ThemedText } from '@/components/themed-text';
import { TVFocusable } from '@/components/TVFocusable';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/contexts/AuthContext';
import { useUiStore } from '@/store/uiStore';
import { type Profile } from '@/types/profile';
import { MobileTvPairModal } from '@/views/login/MobileTvPairModal';
import { UsernameSetupModal } from '@/components/UsernameSetupModal';
import { getUserProfile } from '@/services/socialService';
import { auth } from '@/config/firebase';

type SettingsViewProps = {
  activeProfile: Profile;
  onChangeProfile: () => void;
};

export function SettingsView({ activeProfile, onChangeProfile }: SettingsViewProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width > 768;
  const { user, signOut } = useAuth();
  const setShowJoinPartyModal = useUiStore((state) => state.setShowJoinPartyModal);
  const [showTvPairModal, setShowTvPairModal] = useState(false);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [accountUsername, setAccountUsername] = useState<string>('');

  // Etkileşimli Ayarlar Durumları
  const [isOledMode, setIsOledMode] = useState(false);
  const [currentLang, setCurrentLang] = useState<'tr' | 'en'>('tr');
  const [showAppearanceModal, setShowAppearanceModal] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [sendingResetEmail, setSendingResetEmail] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('maxen_theme_oled').then((val) => {
      if (val === 'true') setIsOledMode(true);
    });
    AsyncStorage.getItem('maxen_app_language').then((val) => {
      if (val === 'en' || val === 'tr') setCurrentLang(val);
    });
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    getUserProfile(user.uid).then((profile) => {
      if (profile?.username) setAccountUsername(profile.username);
    });
  }, [user?.uid]);

  const handleToggleOled = async (oled: boolean) => {
    setIsOledMode(oled);
    await AsyncStorage.setItem('maxen_theme_oled', oled ? 'true' : 'false');
    setShowAppearanceModal(false);
  };

  const handleSelectLang = async (lang: 'tr' | 'en') => {
    setCurrentLang(lang);
    await AsyncStorage.setItem('maxen_app_language', lang);
    setShowLanguageModal(false);
  };

  const handleSendPasswordReset = async () => {
    if (!user?.email) return;
    try {
      setSendingResetEmail(true);
      await sendPasswordResetEmail(auth as any, user.email);
      Alert.alert(
        'Şifre Sıfırlama Bağlantısı Gönderildi',
        `"${user.email}" adresinize şifre sıfırlama bağlantısı gönderildi. Lütfen gelen kutunuzu kontrol edin.`
      );
      setShowAccountModal(false);
    } catch (e: any) {
      Alert.alert('Hata', e?.message || 'Şifre sıfırlama bağlantısı gönderilemedi.');
    } finally {
      setSendingResetEmail(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const setShowVirtualRemoteModal = useUiStore((state) => state.setShowVirtualRemoteModal);
  const openDownloads = useUiStore((state) => state.openDownloads);

  const SETTINGS_ITEMS = [
    {
      icon: 'cloud-download-outline' as const,
      label: 'İndirilenler',
      sub: 'Çevrimdışı izlenebilir dizi ve filmler',
      isDownloads: true,
    },
    ...(!Platform.isTV
      ? [
          {
            icon: 'game-controller-outline' as const,
            label: 'Sanal TV Kumandası',
            sub: 'Telefonu TV Kumandasına Dönüştür & Klavye Senkronu',
            isRemote: true,
          },
        ]
      : []),
    { icon: 'people-outline' as const, label: 'Birlikte İzle (Watch Party)', sub: 'Odaya Katıl & Birlikte İzle', isParty: true },
    {
      icon: 'at-outline' as const,
      label: 'Kullanıcı adı (hesap)',
      sub: accountUsername ? `@${accountUsername}` : 'Henüz belirlenmedi',
      isUsername: true,
    },
    { icon: 'person-outline' as const, label: 'Aktif Profil', sub: activeProfile.name, isProfile: true },
    { icon: 'mail-outline' as const, label: 'Hesap', sub: user?.email ?? '', isAccount: true },
    { icon: 'color-palette-outline' as const, label: 'Görünüm', sub: isOledMode ? 'OLED Saf Siyah (#000000)' : 'Koyu Tema (#141414)', isAppearance: true },
    { icon: 'language-outline' as const, label: 'Dil', sub: currentLang === 'en' ? 'English (İngilizce)' : 'Türkçe', isLanguage: true },
    { icon: 'information-circle-outline' as const, label: 'Uygulama Hakkında', sub: 'Maxen v10.5.0 • Bilgi & Lisans', isAbout: true },
  ];

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: isOledMode ? '#000000' : '#141414' }]}
      contentContainerStyle={[
        styles.scrollContent,
        Platform.isTV && { width: '100%', maxWidth: 960, alignSelf: 'center', paddingTop: 28, paddingHorizontal: 40 },
        isDesktopWeb && {
          maxWidth: 820,
          width: '100%',
          alignSelf: 'center',
          paddingTop: 40,
          paddingBottom: 80,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <ThemedText style={styles.pageTitle}>Ayarlar</ThemedText>

        {!Platform.isTV && (
          <TVFocusable
            onPress={() => setShowTvPairModal(true)}
            style={styles.qrHeaderBtn}
            focusedStyle={styles.qrHeaderBtnFocused}
            accessibilityLabel="TV'ye Bağlan QR"
          >
            <View style={styles.qrHeaderBtnInner}>
              <Ionicons name="qr-code-outline" size={19} color="#FFFFFF" />
              <ThemedText style={styles.qrHeaderBtnText}>TV'ye Bağlan</ThemedText>
            </View>
          </TVFocusable>
        )}
      </View>

      <View style={[styles.profileBadge, isOledMode && { backgroundColor: '#050505', borderColor: '#1a1a1a' }]}>
        <View style={[styles.profileAvatar, { backgroundColor: activeProfile.color }]}>
          {activeProfile.avatarUrl ? (
            <Image source={{ uri: activeProfile.avatarUrl }} style={{width: '100%', height: '100%', borderRadius: 28}} />
          ) : (
            <ThemedText style={styles.profileLetter}>{activeProfile.letter}</ThemedText>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.profileName}>{activeProfile.name}</ThemedText>
          <ThemedText style={[styles.profileEmail, { color: '#888888' }]} numberOfLines={1}>
            {accountUsername ? `@${accountUsername}` : user?.email}
          </ThemedText>
        </View>
      </View>

      <View style={[styles.section, isOledMode && { backgroundColor: '#050505', borderColor: '#1a1a1a' }]}>
        {SETTINGS_ITEMS.filter(item => !Platform.isTV || !(item as any).isUsername).map((item, idx) => (
          <TVFocusable
            key={idx}
            style={[styles.settingRow, { borderBottomColor: 'rgba(255,255,255,0.05)' }]}
            focusedStyle={{
              backgroundColor: Platform.isTV ? 'rgba(229,9,20,0.22)' : 'rgba(229,9,20,0.06)',
              borderWidth: Platform.isTV ? 2 : 0,
              borderColor: Platform.isTV ? '#E50914' : 'transparent',
              borderRadius: 12,
              transform: Platform.isTV ? [{ scale: 1.02 }] : undefined,
            }}
            onPress={() => {
              if ((item as any).isDownloads) {
                openDownloads();
              } else if ((item as any).isRemote) {
                setShowVirtualRemoteModal(true);
              } else if ((item as any).isParty) {
                setShowJoinPartyModal(true);
              } else if ((item as any).isUsername) {
                setShowUsernameModal(true);
              } else if ((item as any).isTvPair) {
                setShowTvPairModal(true);
              } else if ((item as any).isProfile) {
                setShowProfileModal(true);
              } else if ((item as any).isAccount) {
                setShowAccountModal(true);
              } else if ((item as any).isAppearance) {
                setShowAppearanceModal(true);
              } else if ((item as any).isLanguage) {
                setShowLanguageModal(true);
              } else if ((item as any).isAbout) {
                setShowAboutModal(true);
              }
            }}
          >
            <View style={[styles.iconBox, { backgroundColor: 'rgba(229,9,20,0.12)' }]}>
              <Ionicons name={item.icon} size={20} color="#E50914" />
            </View>
            <View style={styles.settingTextGroup}>
              <ThemedText style={styles.settingLabel}>{item.label}</ThemedText>
              <ThemedText style={[styles.settingSub, { color: '#888888' }]}>{item.sub}</ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#666666" />
          </TVFocusable>
        ))}
      </View>

      <TVFocusable
        style={styles.changeProfileBtn}
        focusedStyle={{
          transform: [{ scale: 1.02 }],
          backgroundColor: '#ff1f2f',
          borderWidth: Platform.isTV ? 2 : 0,
          borderColor: '#FFFFFF',
        }}
        onPress={onChangeProfile}
      >
        <Ionicons name="people-outline" size={20} color="#FFFFFF" />
        <ThemedText style={styles.btnText}>Profil Değiştir</ThemedText>
      </TVFocusable>

      <TVFocusable
        style={styles.signOutBtn}
        focusedStyle={{
          backgroundColor: 'rgba(229, 9, 20, 0.2)',
          transform: [{ scale: 1.02 }],
          borderWidth: Platform.isTV ? 2 : 0,
          borderColor: '#E50914',
        }}
        onPress={handleSignOut}
      >
        <Ionicons name="log-out-outline" size={20} color="#E50914" />
        <ThemedText style={styles.signOutText}>Oturumu Kapat</ThemedText>
      </TVFocusable>

      <MobileTvPairModal
        visible={showTvPairModal}
        onClose={() => setShowTvPairModal(false)}
      />

      <UsernameSetupModal
        visible={showUsernameModal}
        onComplete={() => {
          setShowUsernameModal(false);
          if (user?.uid) {
            getUserProfile(user.uid).then((p) => {
              if (p?.username) setAccountUsername(p.username);
            });
          }
        }}
      />

      {/* 1. GÖRÜNÜM (APPEARANCE / OLED) MODALI */}
      <Modal
        visible={showAppearanceModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAppearanceModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: isOledMode ? '#0A0A0C' : '#1e1e24' }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Tema & Görünüm</ThemedText>
              <TVTouchable onPress={() => setShowAppearanceModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#AAA" />
              </TVTouchable>
            </View>
            <ThemedText style={styles.modalDesc}>Ekran tercihinize uygun temayı seçin:</ThemedText>

            <TVTouchable
              style={[styles.modalOptionRow, !isOledMode && styles.modalOptionSelected]}
              onPress={() => handleToggleOled(false)}
            >
              <View style={[styles.colorPreview, { backgroundColor: '#141414' }]} />
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.modalOptionTitle}>Koyu Kömür Teması</ThemedText>
                <ThemedText style={styles.modalOptionSub}>Klasik Netflix stili koyu gri (#141414)</ThemedText>
              </View>
              {!isOledMode && <Ionicons name="checkmark-circle" size={22} color="#E50914" />}
            </TVTouchable>

            <TVTouchable
              style={[styles.modalOptionRow, isOledMode && styles.modalOptionSelected]}
              onPress={() => handleToggleOled(true)}
            >
              <View style={[styles.colorPreview, { backgroundColor: '#000000', borderWidth: 1, borderColor: '#333' }]} />
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.modalOptionTitle}>OLED Saf Siyah Modu</ThemedText>
                <ThemedText style={styles.modalOptionSub}>AMOLED ekranlar için sıfır güç tüketimi (#000000)</ThemedText>
              </View>
              {isOledMode && <Ionicons name="checkmark-circle" size={22} color="#E50914" />}
            </TVTouchable>
          </View>
        </View>
      </Modal>

      {/* 2. DİL (LANGUAGE) MODALI */}
      <Modal
        visible={showLanguageModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: isOledMode ? '#0A0A0C' : '#1e1e24' }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Uygulama Dili</ThemedText>
              <TVTouchable onPress={() => setShowLanguageModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#AAA" />
              </TVTouchable>
            </View>

            <TVTouchable
              style={[styles.modalOptionRow, currentLang === 'tr' && styles.modalOptionSelected]}
              onPress={() => handleSelectLang('tr')}
            >
              <ThemedText style={{ fontSize: 24, marginRight: 12 }}>🇹🇷</ThemedText>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.modalOptionTitle}>Türkçe</ThemedText>
                <ThemedText style={styles.modalOptionSub}>Varsayılan arayüz dili</ThemedText>
              </View>
              {currentLang === 'tr' && <Ionicons name="checkmark-circle" size={22} color="#E50914" />}
            </TVTouchable>

            <TVTouchable
              style={[styles.modalOptionRow, currentLang === 'en' && styles.modalOptionSelected]}
              onPress={() => handleSelectLang('en')}
            >
              <ThemedText style={{ fontSize: 24, marginRight: 12 }}>🇬🇧</ThemedText>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.modalOptionTitle}>English</ThemedText>
                <ThemedText style={styles.modalOptionSub}>English interface</ThemedText>
              </View>
              {currentLang === 'en' && <Ionicons name="checkmark-circle" size={22} color="#E50914" />}
            </TVTouchable>
          </View>
        </View>
      </Modal>

      {/* 3. HESAP (ACCOUNT) MODALI */}
      <Modal
        visible={showAccountModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAccountModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: isOledMode ? '#0A0A0C' : '#1e1e24' }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Hesap Bilgileri</ThemedText>
              <TVTouchable onPress={() => setShowAccountModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#AAA" />
              </TVTouchable>
            </View>

            <View style={styles.modalInfoBox}>
              <ThemedText style={styles.modalInfoLabel}>E-Posta Adresi</ThemedText>
              <ThemedText style={styles.modalInfoVal}>{user?.email || 'Bilinmiyor'}</ThemedText>
            </View>

            <View style={styles.modalInfoBox}>
              <ThemedText style={styles.modalInfoLabel}>Kullanıcı Kimliği (UID)</ThemedText>
              <ThemedText style={styles.modalInfoVal}>{user?.uid || 'Bilinmiyor'}</ThemedText>
            </View>

            <TVTouchable
              style={styles.modalActionBtn}
              onPress={handleSendPasswordReset}
              disabled={sendingResetEmail}
            >
              {sendingResetEmail ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="key-outline" size={18} color="#fff" />
                  <ThemedText style={styles.modalActionBtnText}>Şifre Sıfırlama Bağlantısı Gönder</ThemedText>
                </>
              )}
            </TVTouchable>
          </View>
        </View>
      </Modal>

      {/* 4. AKTİF PROFİL DETAY MODALI */}
      <Modal
        visible={showProfileModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowProfileModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: isOledMode ? '#0A0A0C' : '#1e1e24' }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Aktif Profil</ThemedText>
              <TVTouchable onPress={() => setShowProfileModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#AAA" />
              </TVTouchable>
            </View>

            <View style={{ alignItems: 'center', marginVertical: 16 }}>
              <View style={[styles.profileAvatar, { backgroundColor: activeProfile.color, width: 72, height: 72, borderRadius: 36 }]}>
                {activeProfile.avatarUrl ? (
                  <Image source={{ uri: activeProfile.avatarUrl }} style={{ width: '100%', height: '100%', borderRadius: 36 }} />
                ) : (
                  <ThemedText style={[styles.profileLetter, { fontSize: 32 }]}>{activeProfile.letter}</ThemedText>
                )}
              </View>
              <ThemedText style={[styles.profileName, { marginTop: 10, fontSize: 20 }]}>{activeProfile.name}</ThemedText>
              <ThemedText style={[styles.profileEmail, { color: '#888' }]}>
                {activeProfile.isKids ? 'Çocuk Profili 👶' : 'Yetişkin Profili'} • {activeProfile.pin ? 'PIN Korumalı 🔒' : 'PIN Yok'}
              </ThemedText>
            </View>

            <TVTouchable
              style={styles.modalActionBtn}
              onPress={() => {
                setShowProfileModal(false);
                onChangeProfile();
              }}
            >
              <Ionicons name="swap-horizontal" size={18} color="#fff" />
              <ThemedText style={styles.modalActionBtnText}>Profili Değiştir / Yönet</ThemedText>
            </TVTouchable>
          </View>
        </View>
      </Modal>

      {/* 5. UYGULAMA HAKKINDA MODALI */}
      <Modal
        visible={showAboutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAboutModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: isOledMode ? '#0A0A0C' : '#1e1e24' }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Maxen Hakkında</ThemedText>
              <TVTouchable onPress={() => setShowAboutModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#AAA" />
              </TVTouchable>
            </View>

            <View style={{ alignItems: 'center', marginVertical: 12 }}>
              <View style={{ width: 60, height: 60, borderRadius: 16, backgroundColor: '#E50914', justifyContent: 'center', alignItems: 'center', marginBottom: 10 }}>
                <Ionicons name="film" size={32} color="#fff" />
              </View>
              <ThemedText style={{ fontSize: 22, fontWeight: '900', color: '#fff' }}>Maxen v10.5.0</ThemedText>
              <ThemedText style={{ fontSize: Platform.isTV ? 16 : 13, color: '#aaa', marginTop: 4 }}>Sinema Deneyimini Her Ekrana Taşıyın</ThemedText>
            </View>

            <View style={styles.modalInfoBox}>
              <ThemedText style={styles.modalInfoLabel}>Özellikler</ThemedText>
              <ThemedText style={styles.modalInfoVal}>HLS 1080p Motor, Sistem PiP, Sanal TV Kumandası, Birlikte İzle, TV Handoff</ThemedText>
            </View>

            <View style={styles.modalInfoBox}>
              <ThemedText style={styles.modalInfoLabel}>Lisans & Katkıcılar</ThemedText>
              <ThemedText style={styles.modalInfoVal}>MIT Açık Kaynak Lisansı • Ahmet Erdem Serçeoğlu & Topluluk</ThemedText>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#141414',
  },
  scrollContent: {
    paddingTop: 52,
    paddingHorizontal: 20,
    paddingBottom: 90 + 32,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Platform.isTV ? 36 : 24,
  },
  pageTitle: {
    fontSize: Platform.isTV ? 32 : 32,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  qrHeaderBtn: {
    backgroundColor: 'rgba(229, 9, 20, 0.12)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.28)',
  },
  qrHeaderBtnFocused: {
    backgroundColor: '#E50914',
    borderColor: '#FFFFFF',
    borderWidth: 1.5,
    transform: [{ scale: 1.05 }],
  },
  qrHeaderBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 8,
    paddingHorizontal: 13,
  },
  qrHeaderBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  profileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 24,
    padding: 20,
    backgroundColor: '#1c1c1c',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileLetter: {
    fontSize: 24,
    fontWeight: '900',
    color: '#fff',
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  profileEmail: {
    fontSize: Platform.isTV ? 17 : 14,
    marginTop: 4,
  },
  section: {
    borderRadius: 16,
    backgroundColor: '#1c1c1c',
    marginBottom: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  settingTextGroup: {
    flex: 1,
  },
  settingLabel: {
    fontSize: Platform.isTV ? 20 : 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  settingSub: {
    fontSize: Platform.isTV ? 16 : 13,
    marginTop: 3,
  },
  changeProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#E50914',
    borderRadius: 12,
    paddingVertical: 15,
    marginTop: 8,
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: '#E50914',
    borderRadius: 12,
    paddingVertical: 15,
    marginTop: 16,
  },
  signOutText: {
    color: '#E50914',
    fontSize: 16,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 18,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalDesc: {
    fontSize: Platform.isTV ? 16 : 13,
    color: '#9E9EA7',
    marginBottom: 14,
  },
  modalOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  modalOptionSelected: {
    borderColor: '#E50914',
    backgroundColor: 'rgba(229, 9, 20, 0.08)',
  },
  colorPreview: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 12,
  },
  modalOptionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalOptionSub: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  modalInfoBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
  },
  modalInfoLabel: {
    fontSize: 11.5,
    color: '#8E8E93',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  modalInfoVal: {
    fontSize: Platform.isTV ? 17 : 14,
    color: '#FFFFFF',
    fontWeight: '600',
    marginTop: 3,
  },
  modalActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E50914',
    paddingVertical: 13,
    borderRadius: 12,
    gap: 8,
    marginTop: 14,
  },
  modalActionBtnText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '700',
  },
});
