import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  BackHandler,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TVFocusable } from '@/components/TVFocusable';
import {
  validateUsernameFormat,
  checkUsernameAvailable,
  registerUsername,
} from '@/services/socialService';
import { useAuth } from '@/contexts/AuthContext';

export interface UsernameSetupModalProps {
  visible: boolean;
  onComplete: (username: string) => void;
  onCancel?: () => void;
  initialUsername?: string;
  allowCancel?: boolean;
}

type CheckStatus = 'idle' | 'checking' | 'available' | 'unavailable' | 'invalid';

export function UsernameSetupModal({
  visible,
  onComplete,
  onCancel,
  initialUsername = '',
  allowCancel = false,
}: UsernameSetupModalProps) {
  const { user } = useAuth();
  const [username, setUsername] = useState(initialUsername);
  const [status, setStatus] = useState<CheckStatus>('idle');
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const debounceTimerRef = useRef<any>(null);
  const inputRef = useRef<TextInput>(null);

  // Sync initial username when modal opens
  useEffect(() => {
    if (visible) {
      const clean = (initialUsername || '').trim().toLowerCase().replace(/^@+/, '');
      setUsername(clean);
      setStatus('idle');
      setFeedbackMessage(null);
      setServerError(null);
      setIsSaving(false);
    }
  }, [visible, initialUsername]);

  // Live debounce availability check
  useEffect(() => {
    if (!visible) return;

    const trimmed = username.trim().toLowerCase().replace(/^@+/, '');

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!trimmed) {
      setStatus('idle');
      setFeedbackMessage(null);
      return;
    }

    // First validate format
    const formatResult = validateUsernameFormat(trimmed);
    if (!formatResult.valid) {
      setStatus('invalid');
      setFeedbackMessage(formatResult.error || 'Geçersiz kullanıcı adı formatı.');
      return;
    }

    // If format is valid, start debounce check
    setStatus('checking');
    setFeedbackMessage('Kullanıcı adı kontrol ediliyor...');

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const isAvailable = await checkUsernameAvailable(trimmed, user?.uid);
        if (isAvailable) {
          setStatus('available');
          setFeedbackMessage('Bu kullanıcı adı kullanılabilir!');
        } else {
          setStatus('unavailable');
          setFeedbackMessage('Bu kullanıcı adı zaten alınmış.');
        }
      } catch (err) {
        setStatus('idle');
        setFeedbackMessage('Kullanılabilirlik kontrol edilirken bir hata oluştu.');
      }
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [username, visible, user?.uid]);

  const handleSave = async () => {
    const cleanUsername = username.trim().toLowerCase().replace(/^@+/, '');
    if (status !== 'available' || isSaving || !cleanUsername) {
      return;
    }

    if (!user) {
      setServerError('Oturum bilgisi bulunamadı. Lütfen tekrar giriş yapın.');
      return;
    }

    try {
      setIsSaving(true);
      setServerError(null);

      const res = await registerUsername(
        user.uid,
        cleanUsername,
        user.displayName || cleanUsername,
        user.email || ''
      );

      if (res.success) {
        onComplete(cleanUsername);
      } else {
        setServerError(res.error || 'Kullanıcı adı kaydedilemedi.');
      }
    } catch (e: any) {
      setServerError(e?.message || 'Bir hata oluştu.');
    } finally {
      setIsSaving(false);
    }
  };

  // TV / Android Back tuşu
  useEffect(() => {
    if (!visible) return;
    const onBack = () => {
      if (allowCancel && onCancel) {
        onCancel();
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [visible, allowCancel, onCancel]);

  if (!visible) return null;

  const getBorderColor = () => {
    if (status === 'available') return '#4ADE80';
    if (status === 'unavailable' || status === 'invalid') return '#FF6B6B';
    if (status === 'checking') return '#718CA8';
    return 'rgba(255, 255, 255, 0.15)';
  };

  return (
    <View style={styles.modalOverlay} pointerEvents="box-none">
      <TouchableWithoutFeedback onPress={allowCancel && onCancel ? onCancel : undefined}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={styles.card}>
              {allowCancel && onCancel && (
                <TVFocusable
                  style={styles.closeBtn}
                  focusedStyle={styles.closeBtnFocused}
                  onPress={onCancel}
                  accessibilityLabel="Kapat"
                >
                  <Ionicons name="close" size={24} color="#FFFFFF" />
                </TVFocusable>
              )}

              <View style={styles.iconCircle}>
                <Ionicons name="at" size={34} color="#E50914" />
              </View>

              <Text style={styles.title}>Kullanıcı Adı Belirle</Text>
              <Text style={styles.subtitle}>
                Bu @kullanıcıadı hesaba aittir; profiller ayrı kullanıcı adı almaz. Arkadaşların seni
                bu handle ile bulur.
              </Text>

          <View style={styles.form}>
            <View style={[styles.inputContainer, { borderColor: getBorderColor() }]}>
              <Text style={styles.atSymbol}>@</Text>
              <TextInput
                ref={inputRef}
                style={styles.textInput}
                value={username}
                onChangeText={(val) => {
                  setUsername(val.toLowerCase().replace(/[^a-z0-9_]/g, ''));
                  if (serverError) setServerError(null);
                }}
                placeholder="kullanici_adi"
                placeholderTextColor="rgba(255, 255, 255, 0.3)"
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus={true}
                maxLength={15}
                returnKeyType="done"
                onSubmitEditing={handleSave}
              />
              <View style={styles.statusIndicator}>
                {status === 'checking' && (
                  <ActivityIndicator size="small" color="#718CA8" />
                )}
                {status === 'available' && (
                  <Ionicons name="checkmark-circle" size={22} color="#4ADE80" />
                )}
                {(status === 'unavailable' || status === 'invalid') && (
                  <Ionicons name="close-circle" size={22} color="#FF6B6B" />
                )}
              </View>
            </View>

            {feedbackMessage && (
              <View style={styles.feedbackContainer}>
                <Ionicons
                  name={
                    status === 'available'
                      ? 'checkmark-circle-outline'
                      : status === 'checking'
                      ? 'information-circle-outline'
                      : 'alert-circle-outline'
                  }
                  size={15}
                  color={
                    status === 'available'
                      ? '#4ADE80'
                      : status === 'checking'
                      ? '#718CA8'
                      : '#FF6B6B'
                  }
                />
                <Text
                  style={[
                    styles.feedbackText,
                    {
                      color:
                        status === 'available'
                          ? '#4ADE80'
                          : status === 'checking'
                          ? '#8EA1B4'
                          : '#FF6B6B',
                    },
                  ]}
                >
                  {feedbackMessage}
                </Text>
              </View>
            )}

            {serverError && (
              <View style={styles.serverErrorContainer}>
                <Ionicons name="warning-outline" size={16} color="#FF6B6B" />
                <Text style={styles.serverErrorText}>{serverError}</Text>
              </View>
            )}

            <TVFocusable
              onPress={handleSave}
              disabled={status !== 'available' || isSaving}
              style={[
                styles.saveButton,
                (status !== 'available' || isSaving) && styles.saveButtonDisabled,
              ]}
              focusedStyle={styles.saveButtonFocused}
              accessibilityLabel="Kaydet ve Devam Et"
              accessibilityRole="button"
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#07111D" />
              ) : (
                <>
                  <Ionicons name="checkmark-sharp" size={20} color="#07111D" />
                  <Text style={styles.saveButtonText}>Kaydet ve Devam Et</Text>
                </>
              )}
            </TVFocusable>

            {allowCancel && onCancel && (
              <TVFocusable
                onPress={onCancel}
                style={styles.cancelButton}
                focusedStyle={styles.cancelButtonFocused}
                accessibilityLabel="Daha Sonra"
                accessibilityRole="button"
              >
                <Text style={styles.cancelButtonText}>Daha Sonra</Text>
              </TVFocusable>
            )}
          </View>
        </View>
      </TouchableWithoutFeedback>
    </View>
  </TouchableWithoutFeedback>
</View>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99999,
    elevation: 99999,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  closeBtnFocused: {
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 2,
    transform: [{ scale: 1.1 }],
  },
  card: {
    backgroundColor: '#0A1119',
    borderRadius: 24,
    padding: 32,
    width: '100%',
    maxWidth: 440,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(175, 204, 230, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.8,
    shadowRadius: 24,
    elevation: 24,
  },
  closeBtn: {
    position: 'absolute',
    top: 18,
    right: 18,
    padding: 6,
    zIndex: 10,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(229, 9, 20, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.3)',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(175, 204, 230, 0.75)',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 24,
  },
  form: {
    width: '100%',
    alignItems: 'center',
  },
  inputContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 14 : 6,
    marginBottom: 8,
  },
  atSymbol: {
    fontSize: 18,
    fontWeight: '700',
    color: '#718CA8',
    marginRight: 6,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    paddingVertical: 8,
  },
  statusIndicator: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  feedbackContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  feedbackText: {
    fontSize: 12,
    fontWeight: '600',
  },
  serverErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    width: '100%',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.3)',
  },
  serverErrorText: {
    color: '#FF6B6B',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  saveButton: {
    width: '100%',
    backgroundColor: '#BBD3EA',
    borderRadius: 14,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  saveButtonFocused: {
    borderColor: '#FFFFFF',
    borderWidth: 2,
    transform: [{ scale: 1.03 }],
    shadowColor: '#BBD3EA',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 8,
  },
  saveButtonDisabled: {
    opacity: 0.45,
  },
  saveButtonText: {
    color: '#07111D',
    fontSize: 15,
    fontWeight: '800',
  },
  cancelButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  cancelButtonFocused: {
    borderColor: '#718CA8',
    borderWidth: 1,
    borderRadius: 8,
  },
  cancelButtonText: {
    color: '#8EA1B4',
    fontSize: 13,
    fontWeight: '600',
  },
});
