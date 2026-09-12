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
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { TVFocusable } from '@/components/TVFocusable';
import { TVQrLoginCard } from './TVQrLoginCard';

const MAXEN_AUTH_BACKGROUND = require('../../../assets/images/maxen-auth-bg.jpg');

export interface AuthFormProps {
  isRegister: boolean;
  onToggleRegister: () => void;
  displayName: string;
  onChangeDisplayName: (val: string) => void;
  email: string;
  onChangeEmail: (val: string) => void;
  password: string;
  onChangePassword: (val: string) => void;
  onSubmit: () => void;
  onForgotPassword: () => void;
  loading: boolean;
  errorMessage: string | null;
  floatAnim: Animated.Value;
  pulseAnim: Animated.Value;
  shakeAnim: Animated.Value;
  logoGlowAnim: Animated.Value;
  onTvAuthenticated?: (data: any) => void;
}

export function AuthForm({
  isRegister,
  onToggleRegister,
  displayName,
  onChangeDisplayName,
  email,
  onChangeEmail,
  password,
  onChangePassword,
  onSubmit,
  onForgotPassword,
  loading,
  errorMessage,
  floatAnim,
  pulseAnim,
  shakeAnim,
  logoGlowAnim,
  onTvAuthenticated,
}: AuthFormProps) {
  const { width, height } = useWindowDimensions();

  const isLandscape = width > height;
  const isTVLayout = width >= 900;

  const renderFormContent = () => (
    <View style={styles.formWrapper}>
      <View style={styles.authTitleArea}>
        <ThemedText style={styles.authTitle}>
          {isRegister ? 'Hesap Oluştur' : 'Hoş Geldiniz'}
        </ThemedText>

        <ThemedText style={styles.authSubtitle}>
          {isRegister
            ? 'MAXEN dünyasına katılın.'
            : 'İzlemeye devam etmek için giriş yapın.'}
        </ThemedText>
      </View>

      <View style={styles.authForm}>
        {isRegister && (
          <View style={styles.inputGroup}>
            <ThemedText style={styles.inputLabel}>AD SOYAD</ThemedText>

            <View style={styles.premiumInput}>
              <Ionicons
                name="person-outline"
                size={18}
                color="#9BA9BA"
              />

              <TVTextInput
                style={styles.premiumInputText}
                placeholder="Adınız Soyadınız"
                placeholderTextColor="#647080"
                value={displayName}
                onChangeText={onChangeDisplayName}
                autoCapitalize="words"
              />
            </View>
          </View>
        )}

        <View style={styles.inputGroup}>
          <ThemedText style={styles.inputLabel}>E-POSTA</ThemedText>

          <View style={styles.premiumInput}>
            <Ionicons
              name="mail-outline"
              size={18}
              color="#9BA9BA"
            />

            <TVTextInput
              style={styles.premiumInputText}
              placeholder="E-posta adresiniz"
              placeholderTextColor="#647080"
              value={email}
              onChangeText={onChangeEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <View style={styles.labelRow}>
            <ThemedText style={styles.inputLabel}>ŞİFRE</ThemedText>

            {!isRegister && (
              <TVFocusable
                onPress={onForgotPassword}
                style={styles.forgotInline}
                focusedStyle={{
                  opacity: 0.7,
                }}
              >
                <ThemedText style={styles.forgotInlineText}>
                  Şifremi unuttum
                </ThemedText>
              </TVFocusable>
            )}
          </View>

          <View style={styles.premiumInput}>
            <Ionicons
              name="lock-closed-outline"
              size={18}
              color="#9BA9BA"
            />

            <TVTextInput
              style={styles.premiumInputText}
              placeholder="Şifreniz"
              placeholderTextColor="#647080"
              value={password}
              onChangeText={onChangePassword}
              secureTextEntry
            />
          </View>
        </View>

        {errorMessage && (
          <ThemedText style={styles.premiumError}>
            {errorMessage}
          </ThemedText>
        )}

        {/* PRIMARY BUTTON */}
        <TVFocusable
          onPress={onSubmit}
          style={[
            styles.maxenButton,
            loading && styles.btnDisabled,
          ]}
          focusedStyle={styles.maxenButtonFocused}
        >
          <LinearGradient
            colors={['#E5F2FF', '#B0C8DF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.maxenButtonGradient}
          >
            {loading ? (
              <ActivityIndicator color="#07111D" />
            ) : (
              <>
                <ThemedText style={styles.maxenButtonText}>
                  {isRegister ? 'HESAP OLUŞTUR' : 'OTURUM AÇ'}
                </ThemedText>

                <Ionicons
                  name="arrow-forward"
                  size={19}
                  color="#07111D"
                />
              </>
            )}
          </LinearGradient>
        </TVFocusable>

        {/* REGISTER / LOGIN SWITCH */}
        <View style={styles.switchAuth}>
          <ThemedText style={styles.switchAuthText}>
            {isRegister
              ? 'Zaten hesabınız var mı?'
              : "MAXEN'e yeni misiniz?"}
          </ThemedText>

          <TVFocusable
            onPress={onToggleRegister}
            style={styles.switchAuthButton}
            focusedStyle={{
              opacity: 0.7,
            }}
          >
            <ThemedText style={styles.switchAuthLink}>
              {isRegister ? 'Giriş yapın' : 'Kayıt olun'}
            </ThemedText>
          </TVFocusable>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.authRoot}>
      {/* MAXEN SPACE BACKGROUND */}
      <Image
        source={MAXEN_AUTH_BACKGROUND}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
      />

      {/* Cinematic darkness */}
      <LinearGradient
        colors={
          isLandscape
            ? [
                'rgba(1,5,11,0.25)',
                'rgba(1,5,12,0.56)',
                'rgba(1,3,8,0.92)',
              ]
            : [
                'rgba(1,5,11,0.20)',
                'rgba(1,5,12,0.64)',
                'rgba(1,3,8,0.97)',
              ]
        }
        locations={[0, 0.48, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Atmospheric glow */}
      <View
        pointerEvents="none"
        style={styles.backgroundGlowContainer}
      >
        <Animated.View
          style={[
            styles.backgroundGlow,
            {
              opacity: logoGlowAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.35, 0.7],
              }),
            },
          ]}
        />
      </View>

      <KeyboardAvoidingView
        style={styles.authKeyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.authScroll,
            isLandscape && styles.authScrollLandscape,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[
              styles.authContent,
              isTVLayout && styles.authContentTV,
              isLandscape && styles.authContentLandscape,
              {
                transform: [
                  {
                    translateX: shakeAnim,
                  },
                ],
              },
            ]}
          >
            {/* MAXEN BRAND */}
            <Animated.View
              style={[
                styles.logoArea,
                {
                  transform: [
                    {
                      translateY: floatAnim,
                    },
                    {
                      scale: pulseAnim,
                    },
                  ],
                },
              ]}
            >
              <ThemedText style={styles.maxenLogo}>MAXEN</ThemedText>

              <View style={styles.logoLine}>
                <View style={styles.logoLineSide} />
                <View style={styles.logoDiamond} />
                <View style={styles.logoLineSide} />
              </View>
            </Animated.View>

            {/* DUAL LAYOUT FOR TV / LANDSCAPE */}
            {!isRegister && (isTVLayout || isLandscape || Platform.isTV) ? (
              <View style={styles.tvDualLayout}>
                <View style={styles.tvDualLeft}>
                  <TVQrLoginCard onAuthenticated={onTvAuthenticated || (() => {})} />
                </View>

                <View style={styles.tvDualDivider}>
                  <View style={styles.tvDualDividerLine} />
                  <ThemedText style={styles.tvDualOrText}>VEYA</ThemedText>
                  <View style={styles.tvDualDividerLine} />
                </View>

                <View style={styles.tvDualRight}>
                  {renderFormContent()}
                </View>
              </View>
            ) : (
              renderFormContent()
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* FIXED BOTTOM MAXEN BRAND */}
      <View
        pointerEvents="none"
        style={styles.brandFooter}
      >
        <View style={styles.footerLine} />
        <ThemedText style={styles.footerText}>MAXEN</ThemedText>
        <View style={styles.footerLine} />
      </View>
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
  authScrollLandscape: {
    paddingHorizontal: 40,
    paddingTop: 20,
    paddingBottom: 20,
  },
  authContent: {
    width: '100%',
    maxWidth: 450,
    alignItems: 'center',
    overflow: 'visible',
    paddingTop: 5,
  },
  authContentTV: {
    maxWidth: 880,
  },
  authContentLandscape: {
    maxWidth: 880,
    paddingTop: 0,
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
  logoArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 14,
    paddingBottom: 8,
    marginBottom: 28,
    overflow: 'visible',
    minHeight: 70,
  },
  maxenLogo: {
    fontSize: 43,
    lineHeight: 58,
    fontWeight: '300',
    letterSpacing: 8,
    color: '#E8F0F8',
    includeFontPadding: true,
    textAlign: 'center',
    textShadowColor: 'rgba(160, 199, 235, 0.75)',
    textShadowOffset: {
      width: 0,
      height: 0,
    },
    textShadowRadius: 18,
  },
  logoLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
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
  tvDualLayout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    gap: 32,
  },
  tvDualLeft: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 380,
  },
  tvDualDivider: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  tvDualDividerLine: {
    width: 1,
    height: 140,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  tvDualOrText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  tvDualRight: {
    flex: 1,
    maxWidth: 380,
    width: '100%',
  },
  formWrapper: {
    width: '100%',
  },
  authTitleArea: {
    width: '100%',
    marginBottom: 24,
  },
  authTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  authSubtitle: {
    color: '#8997A7',
    fontSize: 14,
    lineHeight: 20,
  },
  authForm: {
    width: '100%',
  },
  inputGroup: {
    width: '100%',
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inputLabel: {
    color: '#AEBAC8',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  premiumInput: {
    width: '100%',
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
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
    paddingVertical: 12,
  },
  forgotInline: {
    marginBottom: 8,
  },
  forgotInlineText: {
    color: '#B7D0E8',
    fontSize: 12,
    fontWeight: '600',
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
    height: 54,
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
  switchAuth: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  switchAuthText: {
    color: '#687585',
    fontSize: 13,
  },
  switchAuthButton: {
    marginLeft: 6,
    paddingVertical: 5,
  },
  switchAuthLink: {
    color: '#D4E5F5',
    fontSize: 13,
    fontWeight: '700',
  },
  brandFooter: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    opacity: 0.55,
    zIndex: 20,
    elevation: 20,
  },
  footerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(174, 198, 221, 0.18)',
  },
  footerText: {
    color: '#9FB3C7',
    fontSize: 8,
    letterSpacing: 4,
    marginHorizontal: 12,
  },
});
