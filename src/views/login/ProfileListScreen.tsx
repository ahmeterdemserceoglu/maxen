import { TVTextInput, TVSwitch } from '@/components/TVFormControls';
import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Switch,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { TVFocusable } from '@/components/TVFocusable';
import { type Profile, MAX_PROFILES } from '@/types/profile';
import { MobileTvPairModal } from './MobileTvPairModal';

export interface ProfileListScreenProps {
  profiles: Profile[];
  profilesLoading?: boolean;
  isManageMode?: boolean;
  onSelectProfile: (profile: Profile) => void;
  onStartEditProfile: (profile: Profile) => void;
  onDeleteProfile: (profile: Profile) => void;
  onToggleManageMode: (manage: boolean) => void;
  newProfileName: string;
  onChangeNewProfileName: (val: string) => void;
  newIsKids: boolean;
  onChangeNewIsKids: (val: boolean) => void;
  newPin: string;
  onChangeNewPin: (val: string) => void;
  onCreateProfile: () => void;
  errorMessage?: string | null;
}

export function ProfileListScreen({
  profiles,
  profilesLoading = false,
  isManageMode = false,
  onSelectProfile,
  onStartEditProfile,
  onDeleteProfile,
  onToggleManageMode,
  newProfileName,
  onChangeNewProfileName,
  newIsKids,
  onChangeNewIsKids,
  newPin,
  onChangeNewPin,
  onCreateProfile,
  errorMessage,
}: ProfileListScreenProps) {
  const [showTvPairModal, setShowTvPairModal] = useState(false);
  if (isManageMode) {
    return (
      <ScrollView
        style={styles.rootBackground}
        contentContainerStyle={styles.scrollCenter}
        showsVerticalScrollIndicator={false}
      >
        <ThemedText style={styles.cardTitle}>Profilleri Yönet</ThemedText>

        <View style={styles.gridContainer}>
          {profiles.map((profile, index) => (
            <View
              key={profile.id}
              style={styles.profileWrapper}
            >
              <TVFocusable
                onPress={() => onStartEditProfile(profile)}
                style={styles.focusable}
                focusedStyle={{
                  transform: [
                    {
                      scale: 1.08,
                    },
                  ],
                  borderColor: '#C4DCF2',
                  borderWidth: 3,
                  borderRadius: 999,
                }}
              >
                <View
                  style={[
                    styles.avatar,
                    {
                      backgroundColor: profile.color,
                    },
                  ]}
                >
                  {profile.avatarUrl ? (
                    <Image
                      source={{
                        uri: profile.avatarUrl,
                      }}
                      style={styles.avatarImage}
                    />
                  ) : (
                    <ThemedText style={styles.avatarText}>
                      {profile.letter}
                    </ThemedText>
                  )}

                  {profile.isKids && (
                    <View style={styles.kidsBadge}>
                      <ThemedText style={styles.kidsBadgeText}>
                        ÇOCUK
                      </ThemedText>
                    </View>
                  )}

                  {profile.pin && (
                    <View style={styles.lockBadge}>
                      <Ionicons
                        name="lock-closed"
                        size={14}
                        color="#fff"
                      />
                    </View>
                  )}
                </View>
              </TVFocusable>

              <ThemedText style={styles.profileName}>
                {profile.name}
              </ThemedText>

              {profiles.length > 1 && (
                <TVFocusable
                  onPress={() => onDeleteProfile(profile)}
                  style={styles.deleteBtn}
                  focusedStyle={{
                    opacity: 0.7,
                  }}
                >
                  <Ionicons
                    name="trash-outline"
                    size={18}
                    color="#B7C7D8"
                  />
                </TVFocusable>
              )}
            </View>
          ))}

          {profiles.length < MAX_PROFILES && (
            <View style={styles.profileWrapper}>
              <View style={[styles.avatar, styles.addAvatar]}>
                <Ionicons
                  name="add"
                  size={36}
                  color="#8A9BAC"
                />
              </View>

              <TVTextInput
                style={styles.addInput}
                placeholder="Profil adı"
                placeholderTextColor="#666"
                value={newProfileName}
                onChangeText={onChangeNewProfileName}
              />

              <View style={styles.kidsToggleMini}>
                <ThemedText style={styles.kidsToggleText}>
                  Çocuk?
                </ThemedText>

                <TVSwitch
                  value={newIsKids}
                  onValueChange={onChangeNewIsKids}
                  trackColor={{
                    false: '#333',
                    true: '#718CA8',
                  }}
                  thumbColor="#fff"
                />
              </View>

              <TVTextInput
                style={styles.pinInputMini}
                placeholder="PIN"
                placeholderTextColor="#666"
                value={newPin}
                onChangeText={(text) =>
                  onChangeNewPin(
                    text.replace(/[^0-9]/g, '').slice(0, 4),
                  )
                }
                keyboardType="number-pad"
                maxLength={4}
                secureTextEntry
              />

              {newProfileName.trim().length > 0 && (
                <TVFocusable
                  onPress={onCreateProfile}
                  style={styles.addConfirmBtn}
                  focusedStyle={{
                    opacity: 0.8,
                  }}
                >
                  <ThemedText style={styles.addConfirmText}>
                    Ekle
                  </ThemedText>
                </TVFocusable>
              )}
            </View>
          )}
        </View>

        {errorMessage && (
          <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
        )}

        <TVFocusable
          onPress={() => onToggleManageMode(false)}
          style={styles.manageButton}
          focusedStyle={{
            borderColor: '#C4DCF2',
            borderWidth: 2,
          }}
        >
          <ThemedText style={styles.manageButtonText}>Tamam</ThemedText>
        </TVFocusable>
      </ScrollView>
    );
  }

  return (
    <View style={[styles.rootBackground, styles.centerAll]}>
      <ThemedText
        type="title"
        style={styles.cardTitle}
      >
        Kim İzliyor?
      </ThemedText>

      {profilesLoading ? (
        <ActivityIndicator
          size="large"
          color="#BFD7EE"
        />
      ) : (
        <View style={styles.gridContainer}>
          {profiles.map((profile, index) => (
            <View
              key={profile.id}
              style={styles.profileWrapper}
            >
              <TVFocusable
                hasTVPreferredFocus={Platform.isTV && index === 0}
                onPress={() => onSelectProfile(profile)}
                style={styles.focusable}
                focusedStyle={{
                  transform: [
                    {
                      scale: 1.1,
                    },
                  ],
                  borderColor: '#C4DCF2',
                  borderWidth: 3,
                  borderRadius: 999,
                }}
              >
                <View
                  style={[
                    styles.avatar,
                    {
                      backgroundColor: profile.color,
                    },
                  ]}
                >
                  {profile.avatarUrl ? (
                    <Image
                      source={{
                        uri: profile.avatarUrl,
                      }}
                      style={styles.avatarImage}
                    />
                  ) : (
                    <ThemedText style={styles.avatarText}>
                      {profile.letter}
                    </ThemedText>
                  )}

                  {profile.isKids && (
                    <View style={styles.kidsBadge}>
                      <ThemedText style={styles.kidsBadgeText}>
                        ÇOCUK
                      </ThemedText>
                    </View>
                  )}

                  {profile.pin && (
                    <View style={styles.lockBadge}>
                      <Ionicons
                        name="lock-closed"
                        size={14}
                        color="#fff"
                      />
                    </View>
                  )}
                </View>
              </TVFocusable>

              <ThemedText style={styles.profileName}>
                {profile.name}
              </ThemedText>
            </View>
          ))}
        </View>
      )}

      <View style={styles.actionButtonsRow}>
        <TVFocusable
          onPress={() => onToggleManageMode(true)}
          style={styles.manageButton}
          focusedStyle={{
            borderColor: '#C4DCF2',
            borderWidth: 2,
          }}
        >
          <ThemedText style={styles.manageButtonText}>
            Profilleri Yönet
          </ThemedText>
        </TVFocusable>

        {!Platform.isTV && (
          <TVFocusable
            onPress={() => setShowTvPairModal(true)}
            style={styles.tvPairButton}
            focusedStyle={{
              borderColor: '#E50914',
              borderWidth: 2,
            }}
          >
            <View style={styles.tvPairButtonContent}>
              <Ionicons name="tv-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <ThemedText style={styles.tvPairButtonText}>
                TV'ye Bağlan
              </ThemedText>
            </View>
          </TVFocusable>
        )}
      </View>

      <MobileTvPairModal
        visible={showTvPairModal}
        onClose={() => setShowTvPairModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  rootBackground: {
    flex: 1,
    backgroundColor: '#02060D',
  },
  centerAll: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  scrollCenter: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  cardTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    maxWidth: 650,
    marginVertical: 24,
  },
  profileWrapper: {
    alignItems: 'center',
    margin: 16,
    width: 105,
  },
  focusable: {
    borderRadius: 999,
  },
  avatar: {
    width: 86,
    height: 86,
    borderRadius: 43,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 43,
  },
  avatarText: {
    fontSize: 38,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  profileName: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  kidsBadge: {
    position: 'absolute',
    bottom: -2,
    backgroundColor: '#D8E4EF',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#000',
  },
  kidsBadgeText: {
    color: '#08111A',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  lockBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(220, 235, 250, 0.2)',
  },
  manageButton: {
    borderWidth: 1,
    borderColor: 'rgba(190, 215, 240, 0.22)',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 24,
  },
  manageButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9BAFC2',
  },
  addAvatar: {
    backgroundColor: '#0A1119',
    borderWidth: 2,
    borderColor: 'rgba(190, 215, 240, 0.18)',
    borderStyle: 'dashed',
  },
  addInput: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    fontSize: 13,
    width: 95,
    textAlign: 'center',
    backgroundColor: '#0A1119',
    color: '#FFFFFF',
    borderColor: 'rgba(190, 215, 240, 0.12)',
  },
  kidsToggleMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  kidsToggleText: {
    fontSize: 11,
    color: '#737F8D',
  },
  pinInputMini: {
    marginTop: 4,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    fontSize: 11,
    width: 85,
    textAlign: 'center',
    backgroundColor: '#0A1119',
    color: '#FFFFFF',
    borderColor: 'rgba(190, 215, 240, 0.12)',
  },
  addConfirmBtn: {
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 14,
    backgroundColor: '#AFC8DF',
    borderRadius: 8,
  },
  addConfirmText: {
    color: '#07111D',
    fontSize: 12,
    fontWeight: '700',
  },
  deleteBtn: {
    marginTop: 8,
    padding: 6,
  },
  errorText: {
    color: '#FF8585',
    fontSize: 13,
    marginBottom: 14,
    textAlign: 'center',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
  },
  tvPairButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderWidth: 1.5,
    borderColor: '#E50914',
    borderRadius: 999,
    backgroundColor: 'rgba(229, 9, 20, 0.15)',
  },
  tvPairButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tvPairButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
