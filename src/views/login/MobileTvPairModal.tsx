import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { confirmTvSessionFromMobile } from '@/services/tvAuthService';
import { useAuth } from '@/contexts/AuthContext';

interface MobileTvPairModalProps {
  visible: boolean;
  onClose: () => void;
  activeProfileId?: string;
}

export function MobileTvPairModal({
  visible,
  onClose,
  activeProfileId,
}: MobileTvPairModalProps) {
  const { user, profiles } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handlePair = async () => {
    if (!code || code.trim().length < 6) {
      setError('Lütfen TV ekranındaki 6 haneli kodu eksiksiz girin.');
      return;
    }
    if (!user) {
      setError('Önce telefonda oturum açmış olmalısınız.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await confirmTvSessionFromMobile(
        code.trim(),
        user.uid,
        user.email || undefined,
        activeProfileId,
        user.displayName || user.email?.split('@')[0] || undefined,
        profiles
      );

      if (res.success) {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          setCode('');
          onClose();
        }, 2000);
      } else {
        setError(res.error || 'Eşleşme başarısız oldu.');
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
    setSuccess(false);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalCard}>
          {/* Close Button */}
          <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.iconCircle}>
            <Ionicons name="tv" size={32} color="#E50914" />
          </View>

          <Text style={styles.modalTitle}>TV'ye Bağlan</Text>
          <Text style={styles.modalSubtitle}>
            TV ekranınızda görünen 6 haneli eşleşme kodunu girin.
          </Text>

          {success ? (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle" size={48} color="#4CAF50" />
              <Text style={styles.successTitle}>TV Başarıyla Bağlandı! 🎉</Text>
              <Text style={styles.successSubtitle}>
                TV ekranınız otomatik olarak açılıyor...
              </Text>
            </View>
          ) : (
            <View style={styles.form}>
              {/* 6 Haneli Kod Girişi */}
              <TextInput
                style={styles.codeInput}
                value={code}
                onChangeText={(val) => {
                  setCode(val.toUpperCase());
                  if (error) setError(null);
                }}
                placeholder="ÖRN: M7X9K2"
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

              {/* Onayla Butonu */}
              <TouchableOpacity
                style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
                onPress={handlePair}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="log-in-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.submitBtnText}>TV'de Oturum Aç</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
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
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.7,
    shadowRadius: 20,
    elevation: 20,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 6,
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
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
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
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  successBox: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 10,
  },
  successTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  successSubtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    textAlign: 'center',
  },
});
