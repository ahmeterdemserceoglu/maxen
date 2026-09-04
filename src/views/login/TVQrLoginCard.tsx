import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { TVFocusable } from '@/components/TVFocusable';
import {
  createTvSession,
  subscribeToTvSession,
  cleanupTvSession,
  TvSessionData,
} from '@/services/tvAuthService';

interface TVQrLoginCardProps {
  onAuthenticated: (data: TvSessionData) => void;
}

export function TVQrLoginCard({ onAuthenticated }: TVQrLoginCardProps) {
  const [session, setSession] = useState<TvSessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(300);

  const initSession = async () => {
    try {
      setLoading(true);
      setError(null);
      setIsSuccess(false);
      const newSession = await createTvSession();
      setSession(newSession);
      setSecondsRemaining(Math.max(0, Math.floor((newSession.expiresAt - Date.now()) / 1000)));
    } catch (e: any) {
      setError('Eşleşme kodu oluşturulamadı.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initSession();
  }, []);

  // Canlı oturum dinleyicisi
  useEffect(() => {
    if (!session?.code) return;

    const unsubscribe = subscribeToTvSession(
      session.code,
      (authData) => {
        setIsSuccess(true);
        onAuthenticated({
          ...authData,
          code: session.code,
        });
      },
      () => {
        setError('Kodun süresi doldu. Lütfen yenileyin.');
      }
    );

    return () => {
      unsubscribe();
    };
  }, [session?.code]);

  // Geri sayım sayacı
  useEffect(() => {
    if (!session?.expiresAt) return;

    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000));
      setSecondsRemaining(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [session?.expiresAt]);

  const qrValue = session?.code ? `maxen://tv-pair?code=${session.code}` : '';
  const qrImageUrl = qrValue
    ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=8&data=${encodeURIComponent(qrValue)}`
    : '';

  const formatCountdown = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <View style={styles.cardContainer}>
      <View style={styles.headerRow}>
        <Ionicons name="tv" size={24} color="#E50914" />
        <ThemedText style={styles.title}>QR ile Hızlı Giriş</ThemedText>
      </View>

      <Text style={styles.subtitle}>
        Telefondan Maxen uygulamasını açın ve bu kodu okutun.
      </Text>

      {isSuccess ? (
        <View style={styles.successContainer}>
          <Ionicons name="checkmark-circle" size={54} color="#4CAF50" style={{ marginBottom: 12 }} />
          <Text style={styles.successTitle}>Giriş Başarılı! 🎉</Text>
          <Text style={styles.successSubtitle}>TV oturumu açılıyor, lütfen bekleyin...</Text>
          <ActivityIndicator size="small" color="#4CAF50" style={{ marginTop: 16 }} />
        </View>
      ) : loading ? (
        <View style={styles.qrPlaceholder}>
          <ActivityIndicator size="large" color="#E50914" />
          <Text style={styles.loadingText}>QR Kod Oluşturuluyor...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={36} color="#E50914" />
          <Text style={styles.errorText}>{error}</Text>
          <TVFocusable onPress={initSession}>
            <View style={styles.retryBtn}>
              <Ionicons name="refresh" size={18} color="#FFFFFF" />
              <Text style={styles.retryBtnText}>Yeni Kod Al</Text>
            </View>
          </TVFocusable>
        </View>
      ) : (
        session && (
          <View style={styles.content}>
            {/* Beyaz zeminli yüksek kontrastlı QR Kod */}
            <View style={styles.qrWrapper}>
              <Image
                source={{ uri: qrImageUrl }}
                style={styles.qrImage}
                contentFit="contain"
                transition={150}
              />
            </View>

            {/* 6 Haneli Büyük Kod */}
            <View style={styles.codeContainer}>
              <Text style={styles.codeLabel}>VEYA 6 HANELİ KODU GİRİN</Text>
              <Text style={styles.codeText}>
                {session.code.slice(0, 3)} {session.code.slice(3)}
              </Text>
            </View>

            {/* Kalan Süre */}
            <View style={styles.timerRow}>
              <Ionicons name="time-outline" size={15} color="rgba(255,255,255,0.6)" />
              <Text style={styles.timerText}>
                Kalan süre: {formatCountdown(secondsRemaining)}
              </Text>
            </View>

            <TVFocusable onPress={initSession}>
              <View style={styles.refreshLink}>
                <Ionicons name="refresh" size={14} color="#E50914" />
                <Text style={styles.refreshLinkText}>Kodu Yenile</Text>
              </View>
            </TVFocusable>
          </View>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: 'rgba(15, 18, 26, 0.85)',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  content: {
    alignItems: 'center',
    width: '100%',
  },
  qrWrapper: {
    padding: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
    marginBottom: 16,
  },
  qrImage: {
    width: 160,
    height: 160,
    borderRadius: 8,
  },
  codeContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  codeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.5)',
    letterSpacing: 1,
    marginBottom: 4,
  },
  codeText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 6,
    fontVariant: ['tabular-nums'],
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  timerText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '600',
  },
  refreshLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(229, 9, 20, 0.1)',
  },
  refreshLinkText: {
    color: '#E50914',
    fontSize: 13,
    fontWeight: '700',
  },
  qrPlaceholder: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
  },
  errorBox: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 13,
    textAlign: 'center',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E50914',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
    marginTop: 6,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  successContainer: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  successTitle: {
    color: '#4CAF50',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
    textAlign: 'center',
  },
  successSubtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
});
