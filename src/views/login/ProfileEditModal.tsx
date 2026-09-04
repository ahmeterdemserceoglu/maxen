import React from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
  TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { TVFocusable } from '@/components/TVFocusable';
import {
  type Profile,
  PROFILE_COLORS,
  profileLetter,
} from '@/types/profile';
import { AVATAR_PRESETS } from '@/constants/avatars';

export interface ProfileEditModalProps {
  editingProfile: Profile | null;
  editName: string;
  onChangeEditName: (val: string) => void;
  editColor: string;
  onChangeEditColor: (val: string) => void;
  editAvatarUrl: string | null;
  onChangeEditAvatarUrl: (val: string | null) => void;
  editIsKids: boolean;
  onChangeEditIsKids: (val: boolean) => void;
  editPin: string;
  onChangeEditPin: (val: string) => void;
  onSave: () => void;
  onCancel: () => void;
  loading: boolean;
  errorMessage?: string | null;
}

export function ProfileEditModal({
  editingProfile,
  editName,
  onChangeEditName,
  editColor,
  onChangeEditColor,
  editAvatarUrl,
  onChangeEditAvatarUrl,
  editIsKids,
  onChangeEditIsKids,
  editPin,
  onChangeEditPin,
  onSave,
  onCancel,
  loading,
  errorMessage,
}: ProfileEditModalProps) {
  if (!editingProfile) return null;

  return (
    <KeyboardAvoidingView
      style={styles.rootBackground}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollCenter}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileGlassCard}>
          <ThemedText style={styles.cardTitle}>Profili Düzenle</ThemedText>

          <View
            style={[
              styles.avatarLarge,
              {
                backgroundColor: editColor,
              },
            ]}
          >
            {editAvatarUrl ? (
              <Image
                source={{
                  uri: editAvatarUrl,
                }}
                style={styles.avatarImageLarge}
              />
            ) : (
              <ThemedText style={styles.avatarTextLarge}>
                {profileLetter(editName || editingProfile.name)}
              </ThemedText>
            )}
          </View>

          <View style={styles.inputWrapper}>
            <Ionicons
              name="person-outline"
              size={20}
              color="#8EA1B4"
              style={styles.inputIcon}
            />

            <TextInput
              style={styles.inputWithIcon}
              placeholder="Profil adı"
              placeholderTextColor="#666"
              value={editName}
              onChangeText={onChangeEditName}
              autoCapitalize="words"
            />
          </View>

          <ThemedText style={styles.sectionLabel}>
            Karakter Avatarları
          </ThemedText>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.avatarRow}
          >
            <TouchableOpacity
              onPress={() => onChangeEditAvatarUrl(null)}
              style={[
                styles.avatarPresetItem,
                !editAvatarUrl && styles.avatarPresetSelected,
                {
                  backgroundColor: editColor,
                },
              ]}
            >
              <ThemedText
                style={{
                  color: '#fff',
                  fontWeight: 'bold',
                  fontSize: 18,
                }}
              >
                {profileLetter(editName || editingProfile.name)}
              </ThemedText>
            </TouchableOpacity>

            {AVATAR_PRESETS.map((preset) => (
              <TouchableOpacity
                key={preset.id}
                onPress={() => onChangeEditAvatarUrl(preset.url)}
                style={[
                  styles.avatarPresetItem,
                  editAvatarUrl === preset.url &&
                    styles.avatarPresetSelected,
                ]}
              >
                <Image
                  source={{
                    uri: preset.url,
                  }}
                  style={styles.presetImage}
                />
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ThemedText style={styles.sectionLabel}>Profil Rengi</ThemedText>

          <View style={styles.colorGrid}>
            {PROFILE_COLORS.map((color) => (
              <TVFocusable
                key={color}
                onPress={() => onChangeEditColor(color)}
                style={[
                  styles.colorDot,
                  {
                    backgroundColor: color,
                  },
                  editColor === color && styles.colorDotSelected,
                ]}
                focusedStyle={{
                  transform: [
                    {
                      scale: 1.15,
                    },
                  ],
                }}
              >
                <View />
              </TVFocusable>
            ))}
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleLabelBox}>
              <Ionicons
                name="happy-outline"
                size={22}
                color="#AFC8E1"
              />

              <View>
                <ThemedText style={styles.toggleTitle}>
                  Çocuk Profili
                </ThemedText>

                <ThemedText style={styles.toggleSub}>
                  Yaş sınırı olan içerikleri filtreler
                </ThemedText>
              </View>
            </View>

            <Switch
              value={editIsKids}
              onValueChange={onChangeEditIsKids}
              trackColor={{
                false: '#333',
                true: '#718CA8',
              }}
              thumbColor="#fff"
            />
          </View>

          <ThemedText style={styles.sectionLabel}>Profil PIN Kodu</ThemedText>

          <View style={styles.inputWrapper}>
            <Ionicons
              name="key-outline"
              size={20}
              color="#8EA1B4"
              style={styles.inputIcon}
            />

            <TextInput
              style={styles.inputWithIcon}
              placeholder="4 haneli PIN"
              placeholderTextColor="#666"
              value={editPin}
              onChangeText={(text) =>
                onChangeEditPin(text.replace(/[^0-9]/g, '').slice(0, 4))
              }
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
            />
          </View>

          {errorMessage && (
            <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
          )}

          <TVFocusable
            onPress={onSave}
            style={[styles.primaryBtn, loading && styles.btnDisabled]}
            focusedStyle={{
              opacity: 0.88,
            }}
          >
            {loading ? (
              <ActivityIndicator color="#07111D" />
            ) : (
              <ThemedText style={styles.primaryBtnText}>Kaydet</ThemedText>
            )}
          </TVFocusable>

          <TVFocusable
            onPress={onCancel}
            style={styles.secondaryBtn}
            focusedStyle={{
              opacity: 0.8,
            }}
          >
            <ThemedText style={styles.secondaryBtnText}>İptal</ThemedText>
          </TVFocusable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  rootBackground: {
    flex: 1,
    backgroundColor: '#02060D',
  },
  scrollCenter: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  profileGlassCard: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: 'rgba(8, 14, 22, 0.90)',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(175, 204, 230, 0.12)',
  },
  cardTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  avatarLarge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  avatarImageLarge: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
  },
  avatarTextLarge: {
    fontSize: 46,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  sectionLabel: {
    fontSize: 14,
    color: '#9BAFC2',
    marginBottom: 12,
    alignSelf: 'flex-start',
    fontWeight: '600',
  },
  avatarRow: {
    flexDirection: 'row',
    marginBottom: 20,
    width: '100%',
  },
  avatarPresetItem: {
    width: 54,
    height: 54,
    borderRadius: 27,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  avatarPresetSelected: {
    borderColor: '#C6DCEF',
    borderWidth: 3,
  },
  presetImage: {
    width: '100%',
    height: '100%',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  colorDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  colorDotSelected: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A1119',
    borderWidth: 1,
    borderColor: 'rgba(175, 202, 228, 0.12)',
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
    width: '100%',
  },
  inputIcon: {
    marginRight: 10,
  },
  inputWithIcon: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: '#FFFFFF',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    backgroundColor: '#0A1119',
    padding: 14,
    borderRadius: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(175, 202, 228, 0.10)',
  },
  toggleLabelBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toggleTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  toggleSub: {
    fontSize: 12,
    color: '#737F8D',
  },
  primaryBtn: {
    width: '100%',
    backgroundColor: '#BBD3EA',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 6,
  },
  primaryBtnText: {
    color: '#07111D',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryBtn: {
    marginTop: 16,
    paddingVertical: 8,
  },
  secondaryBtnText: {
    color: '#9CA8B5',
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    color: '#FF8585',
    fontSize: 13,
    marginBottom: 14,
    textAlign: 'center',
  },
  btnDisabled: {
    opacity: 0.55,
  },
});
