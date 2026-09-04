import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { confirmTvSessionFromMobile } from '@/services/tvAuthService';

export default function TvPairScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string }>();
  const { user, activeProfile, profiles } = useAuth();

  const rawCode = (params?.code || '').trim().toUpperCase();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetProfileId = activeProfile?.id || (profiles.length > 0 ? profiles[0].id : undefined);

  const handleConfirmPair = async (codeToPair: string) => {
    if (!codeToPair || codeToPair.length < 6) {
      setError('Geçersiz eşleşme kodu.');
      return;
    }

    if (!user?.uid) {
      setError('TV eşleşmesini onaylamak için önce telefonunuzda oturum açmış olmalısınız.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await confirmTvSessionFromMobile(
        codeToPair,
        user.uid,
        user.email || undefined,
        targetProfileId,
        user.displayName || user.email?.split('@')[0] || undefined,
        profiles
      );

      if (res.success) {
        setSuccess(true);
        setTimeout(() => {
          router.replace('/');
        }, 2000);
      } else {
        setError(res.error || 'TV eşleşmesi onaylanamadı.');
      }
    } catch (e: any) {
      setError(e?.message || 'Bağlantı sırasında beklenmeyen bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.uid && rawCode && rawCode.length === 6 && !success && !error && !loading) {
      handleConfirmPair(rawCode);
    }
  }, [user?.uid, rawCode]);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Ionicons name="tv" size={44} color="#E50914" />
        </View>

        <Text style={styles.title}>Televizyona Bağlan</Text>
        <Text style={styles.subtitle}>
          TV ekranınızda oturum açma isteği alındı.
        </Text>

        {rawCode ? (
          <View style={styles.codeBadge}>
            <Text style={styles.codeLabel}>EŞLEŞME KODU</Text>
            <Text style={styles.codeValue}>
              {rawCode.slice(0, 3)} {rawCode.slice(3)}
            </Text>
          </View>
        ) : null}

        {success ? (
          <View style={styles.statusBox}>
            <Ionicons name="checkmark-circle" size={56} color="#4CAF50" />
            <Text style={styles.successTitle}>TV'de Oturum Açıldı! 🎉</Text>
            <Text style={styles.statusSubtitle}>
              Televizyonunuz otomatik olarak ana sayfaya yönlendiriliyor. Keyifli seyirler!
            </Text>
            <ActivityIndicator size="small" color="#4CAF50" style={{ marginTop: 16 }} />
          </View>
        ) : loading ? (
          <View style={styles.statusBox}>
            <ActivityIndicator size="large" color="#E50914" />
            <Text style={styles.loadingText}>TV Oturumu Onaylanıyor...</Text>
          </View>
        ) : error ? (
          <View style={styles.statusBox}>
            <Ionicons name="alert-circle" size={50} color="#FF6B6B" />
            <Text style={styles.errorTitle}>Bağlantı Kurulamadı</Text>
            <Text style={styles.errorText}>{error}</Text>

            {!user ? (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => router.replace('/')}
              >
                <Ionicons name="log-in-outline" size={20} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>Giriş Yapın</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => handleConfirmPair(rawCode)}
              >
                <Ionicons name="refresh" size={20} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>Tekrar Dene</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => router.replace('/')}
            >
              <Text style={styles.cancelBtnText}>Ana Sayfaya Dön</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.actionBox}>
            <View style={styles.infoRow}>
              <Ionicons name="person-circle-outline" size={22} color="rgba(255,255,255,0.7)" />
              <Text style={styles.infoText}>
                {user?.email || 'Giriş Yapılmış Hesap'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => handleConfirmPair(rawCode)}
            >
              <Ionicons name="checkmark" size={22} color="#FFFFFF" />
              <Text style={styles.primaryBtnText}>TV'de Oturumu Onayla</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => router.replace('/')}
            >
              <Text style={styles.cancelBtnText}>İptal Et</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090B0E',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: 'rgba(20, 24, 34, 0.95)',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 12,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(229, 9, 20, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.3)',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.65)',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  codeBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  codeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.5)',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  codeValue: {
    fontSize: 30,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 6,
  },
  statusBox: {
    alignItems: 'center',
    width: '100%',
    paddingVertical: 12,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#4CAF50',
    marginTop: 12,
    textAlign: 'center',
  },
  statusSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
  loadingText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 14,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FF6B6B',
    marginTop: 10,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 16,
    lineHeight: 18,
  },
  actionBox: {
    width: '100%',
    alignItems: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 20,
    width: '100%',
    justifyContent: 'center',
  },
  infoText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '600',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#E50914',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 14,
    marginBottom: 10,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    fontWeight: '600',
  },
});
