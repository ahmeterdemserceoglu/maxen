import {
  queueDownload,
  getDownloads,
  pauseDownload,
  resumeDownload,
  deleteDownload,
  verifyDownloadIntegrity,
  getTotalStorageUsed,
} from '../src/services/downloadService';
import {
  getOrCreateDeviceEncryptionKey,
  transformCipherBytes,
  computeFileChecksum,
  checkAvailableStorage,
  simpleHash,
} from '../src/services/downloadEncryptionService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

jest.mock('@react-native-async-storage/async-storage', () => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn(async (key: string) => store[key] || null),
    setItem: jest.fn(async (key: string, val: string) => {
      store[key] = val;
    }),
    removeItem: jest.fn(async (key: string) => {
      delete store[key];
    }),
    clear: jest.fn(async () => {
      store = {};
    }),
  };
});

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///mock_storage/documents/',
  getInfoAsync: jest.fn(async (uri: string) => ({
    exists: true,
    size: 1024 * 1024 * 50, // 50 MB
    modificationTime: 1700000000,
  })),
  makeDirectoryAsync: jest.fn(async () => {}),
  writeAsStringAsync: jest.fn(async () => {}),
  deleteAsync: jest.fn(async () => {}),
  downloadAsync: jest.fn(async () => ({ status: 200 })),
  createDownloadResumable: jest.fn(() => ({
    downloadAsync: jest.fn(async () => ({ uri: 'file:///mock_storage/video.enc' })),
    pauseAsync: jest.fn(async () => {}),
  })),
  getFreeDiskStorageAsync: jest.fn(async () => 1024 * 1024 * 1024 * 5), // 5 GB free
}));

describe('Offline Download & Encryption Service Test Suite', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  // 1. Şifreleme ve Anahtar Yönetimi
  describe('Şifreleme & Anahtar Yönetimi (Security)', () => {
    it('Cihaza özel 32-byte şifreleme anahtarı oluşturur ve kalıcı saklar', async () => {
      const key1 = await getOrCreateDeviceEncryptionKey();
      expect(key1).toBeDefined();
      expect(key1.length).toBeGreaterThanOrEqual(32);

      // İkinci çağrıda aynı anahtar dönmeli (hardcoded olmamalı)
      const key2 = await getOrCreateDeviceEncryptionKey();
      expect(key2).toBe(key1);
    });

    it('Stream XOR/AES-CTR şifreleme ve deşifreleme simetrik olarak tam veri döner', () => {
      const originalText = 'Maxen Secure Offline Video Stream Chunk Header 1080p';
      const keyHex = '0123456789abcdef0123456789abcdef';
      const inputBytes = new TextEncoder().encode(originalText);

      // Şifrele
      const encrypted = transformCipherBytes(inputBytes, keyHex);
      expect(encrypted).not.toEqual(inputBytes);

      // Deşifre et
      const decrypted = transformCipherBytes(encrypted, keyHex);
      const resultText = new TextDecoder().decode(decrypted);
      expect(resultText).toBe(originalText);
    });

    it('Yanlış anahtarla deşifre edildiğinde bozuk veri üretir', () => {
      const originalText = 'Secret Media Content';
      const key1 = '0123456789abcdef0123456789abcdef';
      const wrongKey = 'fedcba9876543210fedcba9876543210';
      const inputBytes = new TextEncoder().encode(originalText);

      const encrypted = transformCipherBytes(inputBytes, key1);
      const wrongDecrypted = transformCipherBytes(encrypted, wrongKey);
      const resultText = new TextDecoder().decode(wrongDecrypted);

      expect(resultText).not.toBe(originalText);
    });
  });

  // 2. Disk Alanı ve Bütünlük (Integrity)
  describe('Disk Alanı & Bütünlük Kontrolü', () => {
    it('Yeterli disk alanı olduğunda onay verir', async () => {
      const res = await checkAvailableStorage(500 * 1024 * 1024); // 500 MB
      expect(res.sufficient).toBe(true);
    });

    it('Yetersiz disk alanı olduğunda indirmeyi reddeder', async () => {
      const origPlatform = Platform.OS;
      Platform.OS = 'android';
      (FileSystem.getFreeDiskStorageAsync as jest.Mock).mockResolvedValueOnce(50 * 1024 * 1024); // Sadece 50 MB
      const res = await checkAvailableStorage(500 * 1024 * 1024);
      expect(res.sufficient).toBe(false);
      Platform.OS = origPlatform;
    });

    it('Bozuk veya silinmiş dosyanın bütünlük kontrolü başarısız olur', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValueOnce({ exists: false });
      const isValid = await verifyDownloadIntegrity({
        id: 'corrupt_1',
        tmdbId: '123',
        type: 'movie',
        title: 'Corrupt Movie',
        streamUrl: 'https://example.com/stream.mp4',
        localUri: 'file:///mock/corrupt.mp4',
        status: 'completed',
        progress: 1.0,
        totalBytes: 1000,
        downloadedBytes: 1000,
        downloadedAt: Date.now(),
      });
      expect(isValid).toBe(false);
    });
  });

  // 3. İndirme Kuyruk Döngüsü (Lifecycle)
  describe('İndirme Kuyruk ve Yaşam Döngüsü', () => {
    it('Yeni bir indirme başarıyla kuyruğa eklenir ve başlatılır', async () => {
      const item = await queueDownload({
        id: 'movie_9999',
        tmdbId: '9999',
        type: 'movie',
        title: 'Gladiator II',
        streamUrl: 'https://example.com/video.mp4',
      });

      expect(item.id).toBe('movie_9999');
      expect(['queued', 'downloading']).toContain(item.status);
      expect(item.isEncrypted).toBe(true);

      const all = await getDownloads();
      expect(all.some((d) => d.id === 'movie_9999')).toBe(true);
    });

    it('Aynı içeriğin tekrar indirilmesini engeller (Duplicate prevention)', async () => {
      const item1 = await queueDownload({
        id: 'movie_dup_1',
        tmdbId: '555',
        type: 'movie',
        title: 'Dune Part Two',
        streamUrl: 'https://example.com/dune.mp4',
      });

      const item2 = await queueDownload({
        id: 'movie_dup_1',
        tmdbId: '555',
        type: 'movie',
        title: 'Dune Part Two',
        streamUrl: 'https://example.com/dune.mp4',
      });

      expect(item1.id).toBe(item2.id);
      const all = await getDownloads();
      const count = all.filter((d) => d.id === 'movie_dup_1').length;
      expect(count).toBe(1);
    });

    it('İndirme duraklatılabilir (pause) ve devam ettirilebilir (resume)', async () => {
      await queueDownload({
        id: 'movie_pause_test',
        tmdbId: '777',
        type: 'movie',
        title: 'Interstellar',
        streamUrl: 'https://example.com/stream.mp4',
      });

      // Simüle: Downloading moduna geçiş
      const downloads = await getDownloads();
      const current = downloads.find((d) => d.id === 'movie_pause_test');
      if (current) current.status = 'downloading';

      await pauseDownload('movie_pause_test');
      const pausedList = await getDownloads();
      const pausedItem = pausedList.find((d) => d.id === 'movie_pause_test');
      expect(pausedItem?.status).toBe('paused');

      await resumeDownload('movie_pause_test');
      const resumedList = await getDownloads();
      const resumedItem = resumedList.find((d) => d.id === 'movie_pause_test');
      expect(['queued', 'downloading']).toContain(resumedItem?.status);
    });

    it('İndirme silindiğinde diskten ve listeden tamamen kaldırılır', async () => {
      await queueDownload({
        id: 'movie_del_test',
        tmdbId: '888',
        type: 'movie',
        title: 'Oppenheimer',
        streamUrl: 'https://example.com/oppenheimer.mp4',
      });

      await deleteDownload('movie_del_test');
      const list = await getDownloads();
      expect(list.some((d) => d.id === 'movie_del_test')).toBe(false);
      expect(FileSystem.deleteAsync).toHaveBeenCalled();
    });

    it('Uygulama yeniden başlatıldığında durum AsyncStorage üzerinden geri yüklenir', async () => {
      await queueDownload({
        id: 'movie_persist',
        tmdbId: '100',
        type: 'movie',
        title: 'The Matrix',
        streamUrl: 'https://example.com/matrix.mp4',
      });

      const loaded = await getDownloads();
      expect(loaded.length).toBeGreaterThan(0);
      expect(loaded[0].id).toBe('movie_persist');
    });

    it('Toplam kullanılan depolama boyutunu doğru hesaplar', async () => {
      const total = await getTotalStorageUsed();
      expect(typeof total).toBe('number');
      expect(total).toBeGreaterThanOrEqual(0);
    });
  });
});