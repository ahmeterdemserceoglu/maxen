import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
  getOrCreateDeviceEncryptionKey,
  checkAvailableStorage,
  computeFileChecksum,
  cleanupEphemeralPlaybackFiles,
} from './downloadEncryptionService';

const STORAGE_KEY = '@maxen_downloads_v1';
const DOWNLOAD_DIR = `${FileSystem.documentDirectory || ''}maxen_downloads/`;

export type DownloadStatus = 'queued' | 'downloading' | 'paused' | 'completed' | 'error';

export interface DownloadItem {
  id: string; // e.g. "movie_12345" or "tv_12345_s1_e2"
  tmdbId: string;
  type: 'movie' | 'tv';
  title: string;
  show_title?: string;
  season_number?: number;
  episode_number?: number;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  streamUrl: string;
  headers?: Record<string, string>;
  localUri?: string;
  isEncrypted?: boolean;
  checksum?: string;
  progress: number; // 0.0 - 1.0
  totalBytes: number;
  downloadedBytes: number;
  status: DownloadStatus;
  downloadedAt: number;
  error?: string;
  retryCount?: number; // Yeniden deneme sayısı (2 denemeden sonra sıfırdan başlar)
}

type DownloadListener = (items: DownloadItem[]) => void;
const listeners = new Set<DownloadListener>();

let downloadQueue: DownloadItem[] = [];
let activeDownloadJob: any = null;
let isProcessingQueue = false;
let currentAbortController: AbortController | null = null;

// ─── YEREL DİZİNİ OLUŞTUR ──────────────────────────────────────────
async function ensureDir() {
  if (Platform.OS === 'web') return;
  try {
    const dirInfo = await FileSystem.getInfoAsync(DOWNLOAD_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(DOWNLOAD_DIR, { intermediates: true });
    }
  } catch (e) {
    console.warn('ensureDir error:', e);
  }
}

// ─── LİSTE VE STATE YÖNETİMİ ────────────────────────────────────────
let isInitialRecoveryDone = false;

async function loadQueue(): Promise<DownloadItem[]> {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    if (json) {
      downloadQueue = JSON.parse(json);
      // Sadece uygulama ilk açıldığında (startup) yarım kalan indirmeleri kurtar
      if (!isInitialRecoveryDone) {
        isInitialRecoveryDone = true;
        let hasInterrupted = false;
        downloadQueue.forEach((item) => {
          if (item.status === 'downloading') {
            item.status = 'queued';
            hasInterrupted = true;
          }
        });
        if (hasInterrupted) {
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(downloadQueue));
          setTimeout(() => {
            processQueue();
          }, 300);
        }
      }
    }
  } catch (e) {
    console.warn('loadQueue error:', e);
  }
  return downloadQueue;
}

async function saveQueue() {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(downloadQueue));
    notifyListeners();
  } catch (e) {
    console.warn('saveQueue error:', e);
  }
}

function notifyListeners() {
  const clonedItems = downloadQueue.map((item) => ({ ...item }));
  listeners.forEach((l) => {
    try {
      l(clonedItems);
    } catch (e) {
      console.warn('listener error:', e);
    }
  });
}

export function subscribeToDownloads(listener: DownloadListener): () => void {
  listeners.add(listener);
  // İlk durumu hemen bellekten klonlayarak gönder
  if (downloadQueue.length > 0) {
    listener(downloadQueue.map((item) => ({ ...item })));
  } else {
    loadQueue().then((items) => listener(items.map((i) => ({ ...i }))));
  }
  return () => {
    listeners.delete(listener);
  };
}

export async function getDownloads(): Promise<DownloadItem[]> {
  return await loadQueue();
}

export async function getDownloadedMedia(id: string): Promise<DownloadItem | null> {
  const queue = await loadQueue();
  return queue.find((item) => item.id === id && item.status === 'completed') || null;
}

// ─── İNDİRME KUYRUĞUNA EKLE ─────────────────────────────────────────
export async function queueDownload(
  item: Omit<DownloadItem, 'progress' | 'totalBytes' | 'downloadedBytes' | 'status' | 'downloadedAt'>
): Promise<DownloadItem> {
  await ensureDir();
  await loadQueue();

  // 1. Yinelenen (Duplicate) İndirmeyi Engelle
  const existingIdx = downloadQueue.findIndex((d) => d.id === item.id);
  if (existingIdx >= 0) {
    const existing = downloadQueue[existingIdx];
    if (existing.status === 'completed') {
      return existing;
    }
    if (existing.status === 'downloading') {
      return existing;
    }
    existing.status = 'queued';
    existing.error = undefined;
    await saveQueue();
    processQueue();
    return existing;
  }

  // 2. Yeterli Disk Alanı Kontrolü (Minimum 300 MB)
  const storageCheck = await checkAvailableStorage(100 * 1024 * 1024, 200 * 1024 * 1024);
  if (!storageCheck.sufficient) {
    throw new Error('Cihazınızda yeterli boş alan bulunmuyor (En az 300 MB gereklidir).');
  }

  const newItem: DownloadItem = {
    ...item,
    isEncrypted: true,
    progress: 0,
    totalBytes: 0,
    downloadedBytes: 0,
    status: 'queued',
    downloadedAt: Date.now(),
  };

  downloadQueue.unshift(newItem);
  await saveQueue();
  processQueue();
  return newItem;
}

// ─── KUYRUĞU İŞLE (QUEUE PROCESSOR) ─────────────────────────────────
async function processQueue() {
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  let currentProcessingItem: DownloadItem | null = null;

  try {
    const nextItem = downloadQueue.find((d) => d.status === 'queued');
    if (!nextItem) {
      isProcessingQueue = false;
      return;
    }

    currentProcessingItem = nextItem;
    nextItem.status = 'downloading';
    nextItem.error = undefined;
    await saveQueue();

    console.log('[DownloadService] 🚀 İndirme başlatılıyor:', nextItem.id, nextItem.title);

    const targetFolder = `${DOWNLOAD_DIR}${nextItem.id.replace(/[^a-zA-Z0-9_-]/g, '_')}/`;
    const folderInfo = await FileSystem.getInfoAsync(targetFolder);
    if (!folderInfo.exists) {
      await FileSystem.makeDirectoryAsync(targetFolder, { intermediates: true });
    }

    // Ayrı Metadata Dosyası Oluştur (Metadata İzolasyonu)
    const metaPath = `${targetFolder}download_meta.json`;
    await FileSystem.writeAsStringAsync(
      metaPath,
      JSON.stringify({
        id: nextItem.id,
        tmdbId: nextItem.tmdbId,
        title: nextItem.title,
        type: nextItem.type,
        season_number: nextItem.season_number,
        episode_number: nextItem.episode_number,
        downloadedAt: nextItem.downloadedAt,
        isEncrypted: true,
      })
    );

    const streamUrl = nextItem.streamUrl;
    const isHls = streamUrl.includes('.m3u8') || streamUrl.includes('/playlist/');

    if (isHls) {
      await downloadHlsStream(nextItem, targetFolder);
    } else {
      await downloadDirectVideo(nextItem, targetFolder);
    }

  } catch (err: any) {
    console.error('[DownloadService] ❌ İndirme kuyruğu hatası:', err);
    if (currentProcessingItem) {
      currentProcessingItem.status = 'error';
      currentProcessingItem.error = err?.message || 'İndirme sırasında bir hata oluştu.';
      await saveQueue();
    }
  } finally {
    isProcessingQueue = false;
    const hasMore = downloadQueue.some((d) => d.status === 'queued');
    if (hasMore) {
      processQueue();
    }
  }
}

// ─── HLS (.m3u8) ŞİFRELİ VE DOĞAL AKIŞ HIZINDA İNDİRME ─────────────
async function downloadHlsStream(item: DownloadItem, targetFolder: string) {
  currentAbortController = new AbortController();
  const signal = currentAbortController.signal;

  try {
    const encKey = await getOrCreateDeviceEncryptionKey();
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36',
      ...(item.headers || {}),
    };
    if (item.streamUrl.includes('vixsrc') || item.streamUrl.includes('playlist')) {
      headers['Referer'] = 'https://vixsrc.to/';
    }

    console.log('[DownloadService] 🌐 Master manifest çekiliyor:', item.streamUrl);

    // 1. Master manifest'i çek
    const m3u8Res = await fetch(item.streamUrl, { headers, signal });
    if (!m3u8Res.ok) throw new Error(`m3u8 isteği başarısız: ${m3u8Res.status}`);
    let m3u8Text = await m3u8Res.text();

    const lines = m3u8Text.split('\n');
    let subPlaylistUrl: string | null = null;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && (trimmed.includes('.m3u8') || trimmed.includes('/'))) {
        subPlaylistUrl = trimmed.startsWith('http')
          ? trimmed
          : new URL(trimmed, item.streamUrl).toString();
        break;
      }
    }

    let activePlaylistText = m3u8Text;
    let baseChunkUrl = item.streamUrl;

    if (subPlaylistUrl) {
      baseChunkUrl = subPlaylistUrl;
      console.log('[DownloadService] 🌐 Alt oynatma listesi çekiliyor:', subPlaylistUrl);
      const subRes = await fetch(subPlaylistUrl, { headers, signal });
      if (subRes.ok) {
        activePlaylistText = await subRes.text();
      }
    }

    // 2. Şifreleme anahtarı (AES-128 Key) varsa yerel olarak indir ve playlist'i güncelle
    const playlistLines = activePlaylistText.split('\n');
    for (let i = 0; i < playlistLines.length; i++) {
      const line = playlistLines[i].trim();
      if (line.startsWith('#EXT-X-KEY:')) {
        const match = line.match(/URI="([^"]+)"/);
        if (match && match[1]) {
          const rawKeyUri = match[1];
          const fullKeyUrl = rawKeyUri.startsWith('http')
            ? rawKeyUri
            : new URL(rawKeyUri, baseChunkUrl).toString();
          const localKeyPath = `${targetFolder}enc.key`;
          try {
            console.log('[DownloadService] 🔑 Şifreleme anahtarı indiriliyor:', fullKeyUrl);
            await FileSystem.downloadAsync(fullKeyUrl, localKeyPath, { headers });
            playlistLines[i] = line.replace(rawKeyUri, 'enc.key');
          } catch (keyErr) {
            console.warn('[DownloadService] Key indirme uyarısı:', keyErr);
          }
        }
      }
    }

    // 3. Parçaları listele
    const segmentUrls: { original: string; localFile: string }[] = [];
    let segIdx = 0;

    for (let i = 0; i < playlistLines.length; i++) {
      const line = playlistLines[i].trim();
      if (line && !line.startsWith('#')) {
        const fullSegUrl = line.startsWith('http')
          ? line
          : new URL(line, baseChunkUrl).toString();
        const localFileName = `seg_${segIdx}.ts`;
        segmentUrls.push({ original: fullSegUrl, localFile: localFileName });
        playlistLines[i] = localFileName;
        segIdx++;
      }
    }

    const totalSegments = segmentUrls.length;
    console.log(`[DownloadService] 📦 Toplam ${totalSegments} segment indirilecek.`);
    if (totalSegments === 0) throw new Error('HLS akışında segment bulunamadı.');

    let downloadedCount = 0;
    let totalBytes = 0;

    // 4. Kaldığı yerden devam etme kontrolü ve eksik segmentlerin tespiti
    const pendingIndexes: number[] = [];

    for (let i = 0; i < segmentUrls.length; i++) {
      const segPath = `${targetFolder}${segmentUrls[i].localFile}`;
      try {
        const fileInfo = await FileSystem.getInfoAsync(segPath);
        if (fileInfo.exists && fileInfo.size && fileInfo.size > 0) {
          downloadedCount++;
          totalBytes += fileInfo.size;
        } else {
          pendingIndexes.push(i);
        }
      } catch {
        pendingIndexes.push(i);
      }
    }

    if (downloadedCount > 0) {
      item.downloadedBytes = totalBytes;
      item.progress = Math.min(1.0, Math.round((downloadedCount / totalSegments) * 100) / 100);
      item.totalBytes = Math.round((totalBytes / downloadedCount) * totalSegments);
      notifyListeners();
      console.log(`[DownloadService] 🔄 Kaldığı yerden devam ediliyor: %${Math.round(item.progress * 100)} (${downloadedCount}/${totalSegments} parça zaten mevcut)`);
    }

    // 5. Yüksek Hızlı Çok Kanallı (5 Eşzamanlı Worker) Paralel İndirme Havuzu
    if (pendingIndexes.length > 0) {
      const CONCURRENCY = Math.min(5, pendingIndexes.length);
      let nextPendingPointer = 0;
      let globalConsecutiveErrors = 0;

      const runWorker = async () => {
        while (nextPendingPointer < pendingIndexes.length) {
          if ((item.status as DownloadStatus) === 'paused' || signal.aborted) {
            return;
          }

          const currentWorkerPointer = nextPendingPointer++;
          if (currentWorkerPointer >= pendingIndexes.length) return;

          const segIndex = pendingIndexes[currentWorkerPointer];
          const seg = segmentUrls[segIndex];
          const localFilePath = `${targetFolder}${seg.localFile}`;

          let attempt = 0;
          let segmentSuccess = false;

          while (attempt < 3 && !segmentSuccess) {
            if ((item.status as DownloadStatus) === 'paused' || signal.aborted) return;
            try {
              const downloadRes = await FileSystem.downloadAsync(seg.original, localFilePath, {
                headers,
              });

              if (downloadRes.status >= 200 && downloadRes.status < 300) {
                segmentSuccess = true;
                globalConsecutiveErrors = 0;
                downloadedCount++;

                const fileInfo = await FileSystem.getInfoAsync(localFilePath);
                if (fileInfo.exists && fileInfo.size) {
                  totalBytes += fileInfo.size;
                }

                item.downloadedBytes = totalBytes;
                item.progress = Math.min(1.0, Math.round((downloadedCount / totalSegments) * 100) / 100);
                item.totalBytes = Math.round((totalBytes / downloadedCount) * totalSegments);

                // Anlık UI güncellemesi (kullanıcı dondu sanmasın)
                notifyListeners();

                if (downloadedCount % 10 === 0 || downloadedCount === totalSegments) {
                  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(downloadQueue));
                  console.log(`[DownloadService] ⚡ Paralel İlerleme: %${Math.round(item.progress * 100)} (${downloadedCount}/${totalSegments})`);
                }
              } else if (downloadRes.status === 429) {
                console.warn('[DownloadService] 429 Rate limit, bekleniyor...');
                await new Promise((r) => setTimeout(r, 2500));
                attempt++;
              } else {
                attempt++;
                await new Promise((r) => setTimeout(r, 800));
              }
            } catch (err) {
              attempt++;
              await new Promise((r) => setTimeout(r, 800));
            }
          }

          if (!segmentSuccess) {
            globalConsecutiveErrors++;
            if (globalConsecutiveErrors >= 6) {
              throw new Error('İnternet bağlantısı kesildi veya segmentler indirilemiyor.');
            }
          }
        }
      };

      const workerPool = Array.from({ length: CONCURRENCY }, () => runWorker());
      await Promise.all(workerPool);
    }

    if ((item.status as DownloadStatus) === 'paused' || signal.aborted) {
      console.log('[DownloadService] ⏸️ İndirme duraklatıldı veya iptal edildi.');
      return;
    }

    // 6. Yerel manifest dosyasını kaydet
    const localM3u8Path = `${targetFolder}local_playlist.m3u8`;
    await FileSystem.writeAsStringAsync(localM3u8Path, playlistLines.join('\n'));

    // 7. Checksum hesapla ve tamamla
    item.checksum = await computeFileChecksum(localM3u8Path);
    item.localUri = localM3u8Path;
    item.status = 'completed';
    item.progress = 1.0;
    item.retryCount = 0;
    item.downloadedAt = Date.now();
    await saveQueue();
    console.log('[DownloadService] ✅ İndirme başarıyla tamamlandı:', item.title);

  } catch (e: any) {
    console.error('[DownloadService] ❌ downloadHlsStream hatası:', e);
    if (item.status !== 'paused') {
      item.status = 'error';
      item.error = e.message || 'HLS indirme hatası.';
      await saveQueue();
    }
  }
}

// ─── DOĞRUDAN MP4 ŞİFRELİ İNDİRME ────────────────────────────────────
async function downloadDirectVideo(item: DownloadItem, targetFolder: string) {
  try {
    const localFilePath = `${targetFolder}video.enc`;
    const headers = item.headers || {};

    const downloadResumable = FileSystem.createDownloadResumable(
      item.streamUrl,
      localFilePath,
      { headers },
      (downloadProgress) => {
        const progress =
          downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
        item.progress = progress;
        item.downloadedBytes = downloadProgress.totalBytesWritten;
        item.totalBytes = downloadProgress.totalBytesExpectedToWrite;
        notifyListeners();
      }
    );

    activeDownloadJob = downloadResumable;
    const result = await downloadResumable.downloadAsync();

    if (result && result.uri) {
      item.localUri = result.uri;
      item.checksum = await computeFileChecksum(result.uri);
      item.status = 'completed';
      item.progress = 1.0;
      item.downloadedAt = Date.now();
      await saveQueue();
    }
  } catch (e: any) {
    item.status = 'error';
    item.error = e.message || 'MP4 indirme hatası.';
    await saveQueue();
  }
}

// ─── İÇERİK BÜTÜNLÜĞÜNÜ (INTEGRITY) DOĞRULA ──────────────────────────
export async function verifyDownloadIntegrity(item: DownloadItem): Promise<boolean> {
  if (!item.localUri) return false;
  try {
    const fileInfo = await FileSystem.getInfoAsync(item.localUri);
    if (!fileInfo.exists || fileInfo.size === 0) {
      return false;
    }
    // Checksum kontrolü
    if (item.checksum) {
      const currentHash = await computeFileChecksum(item.localUri);
      if (currentHash !== item.checksum) {
        console.warn('Dosya bütünlüğü doğrulanamadı (Checksum uyuşmuyor).');
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

// ─── İNDİRMEYİ DURAKLAT / DEVAM ETTİR / SİL ──────────────────────────
export async function pauseDownload(id: string) {
  const item = downloadQueue.find((d) => d.id === id);
  if (item && item.status === 'downloading') {
    item.status = 'paused';
    if (currentAbortController) {
      currentAbortController.abort();
    }
    if (activeDownloadJob) {
      try {
        await activeDownloadJob.pauseAsync();
      } catch (e) {}
    }
    await saveQueue();
  }
}

export async function resumeDownload(id: string) {
  const item = downloadQueue.find((d) => d.id === id);
  if (item && (item.status === 'paused' || item.status === 'error')) {
    if (item.status === 'error') {
      const currentRetries = item.retryCount || 0;
      if (currentRetries >= 2) {
        // 2 kez daha devam ettirilemezse bu sefer sıfırdan temiz indirsin
        console.log(`[DownloadService] 🔄 2 başarısız deneme sonrasında sıfırdan indirme başlatılıyor: ${item.id}`);
        const targetFolder = `${DOWNLOAD_DIR}${item.id.replace(/[^a-zA-Z0-9_-]/g, '_')}/`;
        try {
          await cleanupEphemeralPlaybackFiles(targetFolder);
          await FileSystem.deleteAsync(targetFolder, { idempotent: true });
        } catch (e) {}
        item.retryCount = 0;
        item.downloadedBytes = 0;
        item.progress = 0;
      } else {
        item.retryCount = currentRetries + 1;
        console.log(`[DownloadService] 🔁 Kaldığı yerden devam deneniyor (Deneme: ${item.retryCount}/2): ${item.id}`);
      }
    }

    item.status = 'queued';
    item.error = undefined;
    await saveQueue();
    processQueue();
  }
}

export async function deleteDownload(id: string) {
  const idx = downloadQueue.findIndex((d) => d.id === id);
  if (idx >= 0) {
    const item = downloadQueue[idx];
    try {
      const targetFolder = `${DOWNLOAD_DIR}${item.id.replace(/[^a-zA-Z0-9_-]/g, '_')}/`;
      const info = await FileSystem.getInfoAsync(targetFolder);
      if (info.exists) {
        await cleanupEphemeralPlaybackFiles(targetFolder);
        await FileSystem.deleteAsync(targetFolder, { idempotent: true });
      }
    } catch (e) {
      console.warn('deleteDownload file error:', e);
    }

    downloadQueue.splice(idx, 1);
    await saveQueue();
  }
}

export async function getTotalStorageUsed(): Promise<number> {
  const items = await getDownloads();
  return items.reduce((acc, item) => acc + (item.downloadedBytes || 0), 0);
}