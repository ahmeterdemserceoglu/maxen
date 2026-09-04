import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  BackHandler,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TVFocusable } from '@/components/TVFocusable';
import { listOnlineTvs, sendPlayToTv, subscribeToOnlineTvs, type TvDevice } from '@/services/tvRemotePlayService';
import { useAuth } from '@/contexts/AuthContext';
import { useUiStore } from '@/store/uiStore';

export interface PlayOnTvModalProps {
  visible: boolean;
  media: any | null;
  profileId: string;
  onClose: () => void;
  onSent?: () => void;
}

export function PlayOnTvModal({
  visible,
  media,
  profileId,
  onClose,
  onSent,
}: PlayOnTvModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [tvs, setTvs] = useState<TvDevice[]>([]);
  const [error, setError] = useState<string | null>(null);

  // TV / Android Back tuşu
  useEffect(() => {
    if (!visible) return;
    const onBack = () => {
      onClose();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [visible, onClose]);

  const refreshTvs = () => {
    if (!user?.uid) return;
    setLoading(true);
    setError(null);
    listOnlineTvs(user.uid)
      .then((list) => {
        setTvs(list);
      })
      .catch(() => {
        setError('Televizyonlar listelenemedi.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    if (!visible || !user?.uid) return;

    setLoading(true);
    setError(null);

    // İlk hızlı çekim
    listOnlineTvs(user.uid).then((list) => {
      setTvs(list);
      setLoading(false);
    }).catch(() => setLoading(false));

    // Canlı Firestore dinleyicisi (TV anında açıldığında yakalar)
    const unsub = subscribeToOnlineTvs(user.uid, (list) => {
      setTvs(list);
      setLoading(false);
    });

    return () => {
      unsub();
    };
  }, [visible, user?.uid]);

  const handleSelect = async (device: TvDevice) => {
    if (!media || sendingId) return;
    setSendingId(device.deviceId);
    setError(null);
    const res = await sendPlayToTv(device.deviceId, media, profileId);
    setSendingId(null);
    if (res.success) {
      onSent?.();
      onClose();
    } else {
      setError(res.error || 'TV\'ye gönderilemedi.');
    }
  };

  if (!visible) return null;

  const title = media?.title || media?.name || 'İçerik';

  return (
    <View style={styles.modalOverlay} pointerEvents="box-none">
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={styles.card}>
              <TVFocusable
                style={styles.closeBtn}
                focusedStyle={styles.closeBtnFocused}
                onPress={onClose}
                accessibilityLabel="Kapat"
              >
                <Ionicons name="close" size={22} color="#FFFFFF" />
              </TVFocusable>

              <View style={styles.iconCircle}>
                <Ionicons name="tv-outline" size={30} color="#E50914" />
              </View>
              <Text style={styles.title}>TV'de Oynat</Text>
              <Text style={styles.subtitle} numberOfLines={2}>
                {title} — aynı hesaba bağlı televizyonunu seç.
              </Text>

              {loading ? (
                <ActivityIndicator color="#E50914" style={{ marginVertical: 24 }} />
              ) : tvs.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>
                    Açık bir televizyon bulunamadı.
                  </Text>
                  <Text style={styles.emptySubText}>
                    • TV'nizde Maxen uygulamasını açın{'\n'}
                    • Aynı hesapla oturum açtığınızdan emin olun
                  </Text>
                  <TVFocusable
                    style={styles.refreshBtn}
                    focusedStyle={styles.openRemoteBtnFocused}
                    onPress={refreshTvs}
                  >
                    <Ionicons name="refresh" size={16} color="#E50914" style={{ marginRight: 6 }} />
                    <Text style={styles.refreshBtnText}>Yeniden Tara</Text>
                  </TVFocusable>
                </View>
              ) : (
                tvs.map((device, index) => (
                  <TVFocusable
                    key={device.deviceId}
                    hasTVPreferredFocus={index === 0}
                    onPress={() => handleSelect(device)}
                    disabled={!!sendingId}
                    style={styles.tvRow}
                    focusedStyle={styles.tvRowFocused}
                    accessibilityLabel={`${device.deviceName} üzerinde oynat`}
                  >
                    <Ionicons name="tv" size={20} color="#FFFFFF" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.tvName}>{device.deviceName}</Text>
                      <Text style={styles.tvMeta}>Çevrimiçi • Bağlanmaya hazır</Text>
                    </View>
                    {sendingId === device.deviceId ? (
                      <ActivityIndicator size="small" color="#E50914" />
                    ) : (
                      <Ionicons name="play-circle" size={22} color="#E50914" />
                    )}
                  </TVFocusable>
                ))
              )}

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              {/* Quick Remote Button */}
              <TVFocusable
                style={styles.openRemoteBtn}
                focusedStyle={styles.openRemoteBtnFocused}
                onPress={() => {
                  onClose();
                  useUiStore.getState().setShowVirtualRemoteModal(true);
                }}
              >
                <Ionicons name="game-controller-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.openRemoteBtnText}>Sanal TV Kumandasını Aç</Text>
              </TVFocusable>
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
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#0A1119',
    borderRadius: 22,
    padding: 24,
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: 'rgba(175, 204, 230, 0.15)',
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    padding: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    zIndex: 2,
  },
  closeBtnFocused: {
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderWidth: 2,
    transform: [{ scale: 1.1 }],
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(229, 9, 20, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    alignSelf: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(175, 204, 230, 0.75)',
    textAlign: 'center',
    marginBottom: 18,
    lineHeight: 18,
  },
  emptyBox: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  emptyText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  emptySubText: {
    color: '#8EA1B4',
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 16,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(229, 9, 20, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.35)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  refreshBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  tvRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  tvRowFocused: {
    borderWidth: 2,
    borderColor: '#E50914',
    transform: [{ scale: 1.02 }],
  },
  tvName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  tvMeta: {
    color: '#4ADE80',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  openRemoteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  openRemoteBtnFocused: {
    borderColor: '#FFFFFF',
    borderWidth: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    transform: [{ scale: 1.04 }],
  },
  openRemoteBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
});
