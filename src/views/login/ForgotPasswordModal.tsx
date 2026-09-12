import { TVTextInput, TVSwitch } from '@/components/TVFormControls';
import React from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { TVFocusable } from '@/components/TVFocusable';

const MAXEN_AUTH_BACKGROUND = require('../../../assets/images/maxen-auth-bg.jpg');

export interface ForgotPasswordModalProps {
  resetEmail: string;
  onChangeResetEmail: (val: string) => void;
  resetSent: boolean;
  onResetSentChange: (val: boolean) => void;
  onSubmit: () => void;
  onBackToAuth: () => void;
  loading: boolean;
  errorMessage: string | null;
  floatAnim: Animated.Value;
  shakeAnim: Animated.Value;
}

export function ForgotPasswordModal({
  resetEmail,
  onChangeResetEmail,
  resetSent,
  onResetSentChange,
  onSubmit,
  onBackToAuth,
  loading,
  errorMessage,
  floatAnim,
  shakeAnim,
}: ForgotPasswordModalProps) {
  return (
    <View style={styles.authRoot}>
      <Image
        source={MAXEN_AUTH_BACKGROUND}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
      />

      <LinearGradient
        colors={[
          'rgba(1,5,11,0.35)',
          'rgba(1,6,14,0.72)',
          'rgba(1,3,8,0.97)',
        ]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      <View
        pointerEvents="none"
        style={styles.backgroundGlowContainer}
      >
        <View style={styles.backgroundGlow} />
      </View>

      <KeyboardAvoidingView
        style={styles.authKeyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.authScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[
              styles.forgotContent,
              {
                transform: [
                  {
                    translateY: floatAnim,
                  },
                ],
              },
            ]}
          >
            <View style={styles.logoAreaSmall}>
              <ThemedText style={styles.maxenLogoSmall}>MAXEN</ThemedText>

              <View style={styles.logoLine}>
                <View style={styles.logoLineSide} />
                <View style={styles.logoDiamond} />
                <View style={styles.logoLineSide} />
              </View>
            </View>

            <Ionicons
              name="key-outline"
              size={30}
              color="#BFD7EE"
              style={styles.forgotIcon}
            />

            <ThemedText style={styles.forgotTitle}>
              Şifrenizi mi unuttunuz?
            </ThemedText>

            <ThemedText style={styles.forgotSubtitle}>
              Hesabınıza bağlı e-posta adresini girin. Size şifre sıfırlama
              bağlantısı gönderelim.
            </ThemedText>

            {resetSent ? (
              <View style={styles.successBoxPremium}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={46}
                  color="#BBD8F2"
                />

                <ThemedText style={styles.successTextPremium}>
                  Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.
                </ThemedText>

                <TVFocusable
                  onPress={() => {
                    onResetSentChange(false);
                    onBackToAuth();
                  }}
                  style={styles.secondaryPremiumButton}
                  focusedStyle={styles.secondaryButtonFocused}
                >
                  <ThemedText style={styles.secondaryPremiumButtonText}>
                    Giriş ekranına dön
                  </ThemedText>
                </TVFocusable>
              </View>
            ) : (
              <>
                <Animated.View
                  style={{
                    width: '100%',
                    transform: [
                      {
                        translateX: shakeAnim,
                      },
                    ],
                  }}
                >
                  <View style={styles.premiumInput}>
                    <Ionicons
                      name="mail-outline"
                      size={18}
                      color="#A5B6C8"
                    />

                    <TVTextInput
                      style={styles.premiumInputText}
                      placeholder="E-posta adresiniz"
                      placeholderTextColor="#647080"
                      value={resetEmail}
                      onChangeText={onChangeResetEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </Animated.View>

                {errorMessage && (
                  <ThemedText style={styles.premiumError}>
                    {errorMessage}
                  </ThemedText>
                )}

                <TVFocusable
                  onPress={onSubmit}
                  style={[
                    styles.maxenButton,
                    loading && styles.btnDisabled,
                  ]}
                  focusedStyle={styles.maxenButtonFocused}
                >
                  <LinearGradient
                    colors={['#E4F1FF', '#A5BED8']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.maxenButtonGradient}
                  >
                    {loading ? (
                      <ActivityIndicator color="#07111D" />
                    ) : (
                      <>
                        <ThemedText style={styles.maxenButtonText}>
                          BAĞLANTI GÖNDER
                        </ThemedText>

                        <Ionicons
                          name="arrow-forward"
                          size={18}
                          color="#07111D"
                        />
                      </>
                    )}
                  </LinearGradient>
                </TVFocusable>

                <TVFocusable
                  onPress={onBackToAuth}
                  style={styles.secondaryPremiumButton}
                  focusedStyle={styles.secondaryButtonFocused}
                >
                  <ThemedText style={styles.secondaryPremiumButtonText}>
                    Geri dön
                  </ThemedText>
                </TVFocusable>
              </>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  authRoot: {
    flex: 1,
    backgroundColor: '#02060D',
  },
  authKeyboard: {
    flex: 1,
  },
  authScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 70,
  },
  forgotContent: {
    width: '100%',
    maxWidth: 460,
    alignItems: 'center',
    overflow: 'visible',
  },
  backgroundGlowContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  backgroundGlow: {
    position: 'absolute',
    width: 520,
    height: 520,
    borderRadius: 260,
    backgroundColor: 'rgba(91, 137, 181, 0.08)',
    top: '25%',
    left: '50%',
    marginLeft: -260,
  },
  logoAreaSmall: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingTop: 12,
    paddingBottom: 18,
  },
  maxenLogoSmall: {
    fontSize: 42,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 7,
    lineHeight: 56,
    includeFontPadding: true,
    textAlign: 'center',
    paddingTop: 4,
    paddingBottom: 4,
  },
  logoLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 13,
    width: 190,
  },
  logoLineSide: {
    height: 1,
    flex: 1,
    backgroundColor: 'rgba(190, 215, 240, 0.34)',
  },
  logoDiamond: {
    width: 5,
    height: 5,
    marginHorizontal: 10,
    backgroundColor: '#C9DCF0',
    transform: [
      {
        rotate: '45deg',
      },
    ],
  },
  forgotIcon: {
    marginBottom: 18,
  },
  forgotTitle: {
    color: '#FFFFFF',
    fontSize: 27,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 9,
  },
  forgotSubtitle: {
    color: '#8997A7',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 26,
    maxWidth: 380,
  },
  successBoxPremium: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 18,
  },
  successTextPremium: {
    color: '#BBD8F2',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginVertical: 18,
  },
  secondaryPremiumButton: {
    paddingVertical: 9,
    paddingHorizontal: 15,
    marginTop: 8,
  },
  secondaryPremiumButtonText: {
    color: '#8FA4B9',
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryButtonFocused: {
    opacity: 0.7,
    transform: [
      {
        scale: 1.03,
      },
    ],
  },
  premiumInput: {
    width: '100%',
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 17,
    backgroundColor: 'rgba(7, 15, 24, 0.70)',
    borderWidth: 1,
    borderColor: 'rgba(164, 190, 216, 0.17)',
    borderRadius: 9,
  },
  premiumInputText: {
    flex: 1,
    color: '#F3F7FB',
    fontSize: 15,
    marginLeft: 12,
    paddingVertical: 15,
  },
  premiumError: {
    width: '100%',
    color: '#FF9D9D',
    fontSize: 13,
    marginTop: -4,
    marginBottom: 14,
  },
  maxenButton: {
    width: '100%',
    height: 58,
    borderRadius: 9,
    overflow: 'hidden',
    marginTop: 8,
    shadowColor: '#8FB6D9',
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 5,
  },
  maxenButtonGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  maxenButtonText: {
    color: '#07111D',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  maxenButtonFocused: {
    transform: [
      {
        scale: 1.025,
      },
    ],
    borderWidth: 2,
    borderColor: '#E8F5FF',
    shadowColor: '#B9D9F5',
    shadowOpacity: 0.65,
    shadowRadius: 18,
  },
  btnDisabled: {
    opacity: 0.55,
  },
});
