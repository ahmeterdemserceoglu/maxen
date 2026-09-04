import React from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { TVFocusable } from '@/components/TVFocusable';
import { type Profile } from '@/types/profile';

export interface PinVerifyModalProps {
  targetProfile: Profile;
  enteredPin: string;
  onChangeEnteredPin: (val: string) => void;
  onVerifyPin: (pin: string) => void;
  onCancel: () => void;
  errorMessage?: string | null;
  shakeAnim: Animated.Value;
}

export function PinVerifyModal({
  targetProfile,
  enteredPin,
  onChangeEnteredPin,
  onVerifyPin,
  onCancel,
  errorMessage,
  shakeAnim,
}: PinVerifyModalProps) {
  return (
    <View style={[styles.rootBackground, styles.centerAll]}>
      <View style={styles.profileGlassCard}>
        <Animated.View
          style={[
            styles.avatarLarge,
            {
              backgroundColor: targetProfile.color,
            },
            {
              transform: [
                {
                  translateX: shakeAnim,
                },
              ],
            },
          ]}
        >
          {targetProfile.avatarUrl ? (
            <Image
              source={{
                uri: targetProfile.avatarUrl,
              }}
              style={styles.avatarImageLarge}
            />
          ) : (
            <ThemedText style={styles.avatarTextLarge}>
              {targetProfile.letter}
            </ThemedText>
          )}

          <View style={styles.lockBadge}>
            <Ionicons
              name="lock-closed"
              size={16}
              color="#fff"
            />
          </View>
        </Animated.View>

        <ThemedText style={styles.cardTitle}>
          {targetProfile.name}
        </ThemedText>

        <ThemedText style={styles.cardSubtitle}>
          Bu profille devam etmek için 4 haneli PIN kodunu girin.
        </ThemedText>

        <TextInput
          style={styles.pinInput}
          placeholder="••••"
          placeholderTextColor="#555"
          value={enteredPin}
          onChangeText={(text) => {
            const val = text.replace(/[^0-9]/g, '').slice(0, 4);
            onChangeEnteredPin(val);

            if (val.length === 4) {
              onVerifyPin(val);
            }
          }}
          keyboardType="number-pad"
          maxLength={4}
          secureTextEntry
          autoFocus
        />

        {errorMessage && (
          <ThemedText style={styles.errorText}>
            {errorMessage}
          </ThemedText>
        )}

        <TVFocusable
          onPress={onCancel}
          style={styles.secondaryBtn}
          focusedStyle={{
            opacity: 0.8,
          }}
        >
          <ThemedText style={styles.secondaryBtnText}>
            Profil Seçimine Dön
          </ThemedText>
        </TVFocusable>
      </View>
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
  cardSubtitle: {
    fontSize: 14,
    color: '#9CA8B5',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 16,
    lineHeight: 21,
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
  pinInput: {
    fontSize: 28,
    letterSpacing: 12,
    textAlign: 'center',
    color: '#FFFFFF',
    backgroundColor: '#0A1119',
    borderWidth: 1,
    borderColor: '#AFC8DF',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 20,
    width: 180,
    marginVertical: 16,
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
});
