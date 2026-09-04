import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Platform,
  BackHandler,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { joinWatchPartyRoom, WatchPartyRoom } from '@/services/watchPartyService';
import { useAuth } from '@/contexts/AuthContext';
import { TVFocusable } from '@/components/TVFocusable';

interface JoinWatchPartyModalProps {
  visible: boolean;
  onClose: () => void;
  onJoined: (room: WatchPartyRoom) => void;
}

export function JoinWatchPartyModal({
  visible,
  onClose,
  onJoined,
}: JoinWatchPartyModalProps) {
  const isTV = Platform.isTV;
  const { user, activeProfile } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // TV / Android Back tuşu
  useEffect(() => {
    if (!visible) return;
    const onBack = () => {
      handleClose();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [visible]);

  const handleJoin = async () => {
    if (!code || code.trim().length < 6) {
      setError('Lütfen 6 haneli oda kodunu eksiksiz girin.');
      return;
    }
    if (!user) {
      setError('Odaya katılmak için oturum açmış olmalısınız.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await joinWatchPartyRoom(code.trim(), user, activeProfile);

      if (res.success && res.room) {
        setCode('');
        onClose();
        onJoined(res.room);
      } else {
        setError(res.error || 'Odaya katılınamadı.');
      }
    } catch (e: any) {
      setError(e?.message || 'Bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCode('');
    setError(null);
    onClose();
  };

  if (!visible) return null;

  return (
    <View style={styles.modalOverlay} pointerEvents="box-none">
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={[styles.modalCard, isTV && styles.modalCardTV]}>
              <TVFocusable
                style={styles.closeBtn}
                focusedStyle={styles.closeBtnFocused}
                onPress={handleClose}
                accessibilityLabel="Kapat"
              >
                <Ionicons name="close" size={isTV ? 26 : 22} color="#FFFFFF" />
              </TVFocusable>

              <View style={[styles.iconCircle, isTV && styles.iconCircleTV]}>
                <Ionicons name="people" size={isTV ? 38 : 32} color="#E50914" />
              </View>

              <Text style={[styles.modalTitle, isTV && styles.modalTitleTV]}>
                Birlikte İzle Odasına Katıl
              </Text>
              <Text style={[styles.modalSubtitle, isTV && styles.modalSubtitleTV]}>
                Arkadaşınızın paylaştığı 6 haneli oda kodunu girin.
              </Text>

              <View style={styles.form}>
                <TextInput
                  style={[styles.codeInput, isTV && styles.codeInputTV]}
                  value={code}
                  onChangeText={(val) => {
                    setCode(val.toUpperCase());
                    if (error) setError(null);
                  }}
                  placeholder="ÖRN: 8K4X2P"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  autoCapitalize="characters"
                  maxLength={6}
                  autoCorrect={false}
                  textAlign="center"
                />

                {error && (
                  <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={16} color="#FF6B6B" />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <TVFocusable
                  hasTVPreferredFocus={true}
                  style={[styles.submitBtn, isTV && styles.submitBtnTV, loading && styles.submitBtnDisabled]}
                  focusedStyle={styles.submitBtnFocused}
                  onPress={handleJoin}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="play" size={isTV ? 22 : 18} color="#FFFFFF" />
                      <Text style={[styles.submitBtnText, isTV && styles.submitBtnTextTV]}>
                        Odaya Katıl & İzle
                      </Text>
                    </>
                  )}
                </TVFocusable>
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
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#121620',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.7,
    shadowRadius: 20,
    elevation: 20,
  },
  modalCardTV: {
    maxWidth: 480,
    padding: 36,
    borderRadius: 28,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  closeBtnFocused: {
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 2,
    transform: [{ scale: 1.1 }],
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(229, 9, 20, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.3)',
  },
  iconCircleTV: {
    width: 76,
    height: 76,
    borderRadius: 38,
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalTitleTV: {
    fontSize: 24,
    marginBottom: 10,
  },
  modalSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  modalSubtitleTV: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 28,
  },
  form: {
    width: '100%',
    alignItems: 'center',
  },
  codeInput: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    marginBottom: 14,
  },
  codeInputTV: {
    paddingVertical: 18,
    fontSize: 28,
    borderRadius: 18,
    marginBottom: 20,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  submitBtn: {
    width: '100%',
    backgroundColor: '#E50914',
    borderRadius: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#E50914',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  submitBtnTV: {
    paddingVertical: 18,
    borderRadius: 18,
  },
  submitBtnFocused: {
    borderColor: '#FFFFFF',
    borderWidth: 2.5,
    transform: [{ scale: 1.04 }],
    backgroundColor: '#f40612',
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  submitBtnTextTV: {
    fontSize: 18,
  },
});
