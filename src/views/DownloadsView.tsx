import { TVTouchable } from '@/components/TVTouchable';
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  BackHandler,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  subscribeToDownloads,
  deleteDownload,
  pauseDownload,
  resumeDownload,
  verifyDownloadIntegrity,
  type DownloadItem,
} from '@/services/downloadService';

interface DownloadsViewProps {
  onBack?: () => void;
  onPlayMedia: (media: any) => void;
  isOfflineMode?: boolean;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 MB';
  const k = 1024;
  const sizes = ['Bayt', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function DownloadsView({ onBack, onPlayMedia, isOfflineMode }: DownloadsViewProps) {
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);

  useEffect(() => {
    const unsub = subscribeToDownloads((items) => {
      setDownloads(items);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isOfflineMode) {
        Alert.alert(
          'Maxen',
          'Uygulamadan çıkmak istiyor musunuz?',
          [
            { text: 'İptal', style: 'cancel' },
            { text: 'Çıkış', style: 'destructive', onPress: () => BackHandler.exitApp() },
          ]
        );
        return true;
      }
      if (onBack) {
        onBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [onBack, isOfflineMode]);

  const totalSize = downloads.reduce((acc, d) => acc + (d.downloadedBytes || 0), 0);

  const handlePlay = async (item: DownloadItem) => {
    if (item.status !== 'completed' || !item.localUri) {
      Alert.alert('Uyarı', 'Bu içerik henüz tamamen indirilmedi.');
      return;
    }

    const isValid = await verifyDownloadIntegrity(item);
    if (!isValid) {
      Alert.alert(
        'Bütünlük Hatası',
        'İndirilen medya dosyası bozulmuş veya eksik. Lütfen içeriği silip tekrar indirin.'
      );
      return;
    }

    onPlayMedia({
      id: item.id,
      tmdbId: item.tmdbId,
      title: item.title,
      type: item.type,
      season_number: item.season_number,
      episode_number: item.episode_number,
      posterUrl: item.posterUrl,
      backdropUrl: item.backdropUrl,
      savedStreamUrl: item.localUri,
      isOfflinePlayback: true,
    });
  };

  const handleDelete = (item: DownloadItem) => {
    Alert.alert(
      'İndirmeyi Sil',
      `"${item.title}" cihazınızdan silinsin mi?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: () => deleteDownload(item.id),
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: DownloadItem }) => {
    const isCompleted = item.status === 'completed';
    const isDownloading = item.status === 'downloading';
    const isPaused = item.status === 'paused';
    const isError = item.status === 'error';
    const isQueued = item.status === 'queued';
    const retryCount = item.retryCount || 0;

    return (
      <View style={styles.card}>
        <TVTouchable
          style={styles.cardLeft}
          disabled={Platform.isTV && !isCompleted}
          activeOpacity={0.8}
          onPress={() => isCompleted && handlePlay(item)}
        >
          {item.posterUrl ? (
            <Image source={{ uri: item.posterUrl }} style={styles.poster} contentFit="cover" />
          ) : (
            <View style={[styles.poster, styles.posterPlaceholder]}>
              <Ionicons name="film" size={24} color="#666" />
            </View>
          )}

          <View style={styles.infoCol}>
            <Text style={styles.title} numberOfLines={1}>
              {item.title}
            </Text>
            {item.type === 'tv' && item.season_number && item.episode_number ? (
              <Text style={styles.subText}>
                Sezon {item.season_number} • Bölüm {item.episode_number}
              </Text>
            ) : (
              <Text style={styles.subText}>Film</Text>
            )}

            {/* Boyut ve Durum */}
            <View style={styles.statusRow}>
              {isCompleted && (
                <View style={styles.badgeSuccess}>
                  <Ionicons name="checkmark-circle" size={13} color="#00E676" />
                  <Text style={styles.badgeSuccessText}>İndirildi • {formatBytes(item.downloadedBytes)}</Text>
                </View>
              )}

              {isDownloading && (
                <View style={styles.badgeLoading}>
                  <ActivityIndicator size={12} color="#00E5FF" style={{ marginRight: 2 }} />
                  <Text style={styles.badgeLoadingText}>
                    %{Math.round((item.progress || 0) * 100)} • {formatBytes(item.downloadedBytes)}
                  </Text>
                </View>
              )}

              {isQueued && (
                <View style={styles.badgePaused}>
                  <Ionicons name="time-outline" size={13} color="#FFA000" />
                  <Text style={styles.badgePausedText}>Kuyrukta Bekliyor</Text>
                </View>
              )}

              {isPaused && (
                <View style={styles.badgePaused}>
                  <Ionicons name="pause-circle" size={13} color="#FFA000" />
                  <Text style={styles.badgePausedText}>
                    Duraklatıldı (%{Math.round((item.progress || 0) * 100)})
                  </Text>
                </View>
              )}

              {isError && (
                <View style={styles.badgeError}>
                  <Ionicons name="alert-circle" size={13} color="#FF5252" />
                  <Text style={styles.badgeErrorText}>
                    {retryCount >= 2
                      ? 'Başarısız Oldu (Sıfırdan İndir)'
                      : `İndirme Kesildi (${retryCount}/2)`}
                  </Text>
                </View>
              )}
            </View>

            {/* İlerleme Çubuğu */}
            {(isDownloading || isPaused || isError) && (
              <View style={styles.progressBarBg}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${Math.round((item.progress || 0) * 100)}%`,
                      backgroundColor: isError ? '#FF5252' : isPaused ? '#FFA000' : '#00E5FF',
                    },
                  ]}
                />
              </View>
            )}
          </View>
        </TVTouchable>

        {/* Butonlar */}
        <View style={styles.actionsCol}>
          {isCompleted && (
            <TVTouchable style={styles.playBtn} accessibilityLabel="Oynat" onPress={() => handlePlay(item)}>
              <Ionicons name="play" size={18} color="#FFF" />
            </TVTouchable>
          )}

          {isDownloading && (
            <TVTouchable style={styles.actionBtn} accessibilityLabel="İndirmeyi duraklat" onPress={() => pauseDownload(item.id)}>
              <Ionicons name="pause" size={18} color="#FFA000" />
            </TVTouchable>
          )}

          {isPaused && (
            <TVTouchable style={styles.actionBtn} accessibilityLabel="İndirmeye devam et" onPress={() => resumeDownload(item.id)}>
              <Ionicons name="play" size={18} color="#00E5FF" />
            </TVTouchable>
          )}

          {isError && (
            <TVTouchable
              style={[
                styles.actionBtn,
                { backgroundColor: retryCount >= 2 ? 'rgba(255, 82, 82, 0.2)' : 'rgba(255, 160, 0, 0.2)', borderRadius: 16 },
              ]}
              onPress={() => resumeDownload(item.id)}
            >
              <Ionicons
                name={retryCount >= 2 ? 'refresh' : 'play'}
                size={18}
                color={retryCount >= 2 ? '#FF5252' : '#FFA000'}
              />
            </TVTouchable>
          )}

          <TVTouchable style={styles.actionBtn} accessibilityLabel="İndirmeyi sil" onPress={() => handleDelete(item)}>
            <Ionicons name="trash-outline" size={18} color="#FF5252" />
          </TVTouchable>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Üst Başlık Barı */}
      <View style={styles.header}>
        {isOfflineMode ? (
          <View style={styles.offlinePill}>
            <Ionicons name="cloud-offline" size={15} color="#FF5252" />
            <Text style={styles.offlinePillText}>Çevrimdışı</Text>
          </View>
        ) : onBack ? (
          <TVTouchable onPress={onBack} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TVTouchable>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>İndirilenler</Text>
          <Text style={styles.headerSub}>
            {isOfflineMode ? 'İnternetsiz Cihaz Kütüphanesi' : 'Çevrimdışı İzleme Kütüphanesi'}
          </Text>
        </View>
        <View style={styles.storageBadge}>
          <Ionicons name="phone-portrait-outline" size={14} color="#00E5FF" />
          <Text style={styles.storageText}>{formatBytes(totalSize)}</Text>
        </View>
      </View>

      {/* Liste */}
      {downloads.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="cloud-offline-outline" size={72} color="#444" />
          <Text style={styles.emptyTitle}>Henüz bir şey indirmediniz</Text>
          <Text style={styles.emptyDesc}>
            {Platform.isTV ? 'Bu cihazda kayıtlı bir içerik bulunmuyor.' : isOfflineMode
              ? 'Çevrimdışı izlemek için internete bağlandığınızda dizi veya film detay sayfasından içerik indirin.'
              : 'Uçakta veya internetsiz seyahatte izlemek için dizi ve filmlerin detay sayfasındaki "İndir" butonuna tıklayın.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={downloads}
          keyExtractor={(item) => item.id}
          initialNumToRender={Platform.isTV ? 4 : 10}
          maxToRenderPerBatch={Platform.isTV ? 2 : 10}
          windowSize={Platform.isTV ? 3 : 21}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090D',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#09090D',
  },
  offlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 82, 82, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 82, 82, 0.4)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 10,
    gap: 5,
  },
  offlinePillText: {
    color: '#FF5252',
    fontSize: Platform.isTV ? 15 : 12,
    fontWeight: '700',
  },
  backBtn: {
    marginRight: 14,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  headerSub: {
    color: '#888',
    fontSize: Platform.isTV ? 15 : 12,
  },
  storageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 5,
  },
  storageText: {
    color: '#00E5FF',
    fontSize: Platform.isTV ? 15 : 12,
    fontWeight: '700',
  },
  listContent: {
    padding: Platform.isTV ? 32 : 16,
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#14141C',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 10,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  poster: {
    width: 54,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#1F1F2C',
  },
  posterPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCol: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  title: {
    color: '#FFF',
    fontSize: Platform.isTV ? 18 : 14,
    fontWeight: '700',
  },
  subText: {
    color: '#888',
    fontSize: Platform.isTV ? 15 : 12,
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  badgeSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badgeSuccessText: {
    color: '#00E676',
    fontSize: 11,
    fontWeight: '600',
  },
  badgeLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badgeLoadingText: {
    color: '#00E5FF',
    fontSize: 11,
    fontWeight: '600',
  },
  badgePaused: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badgePausedText: {
    color: '#FFA000',
    fontSize: 11,
    fontWeight: '600',
  },
  badgeError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badgeErrorText: {
    color: '#FF5252',
    fontSize: 11,
    fontWeight: '600',
  },
  progressBarBg: {
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    marginTop: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#00E5FF',
  },
  actionsCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E50914',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtn: {
    padding: 6,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
  },
  emptyDesc: {
    color: '#777',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
});
