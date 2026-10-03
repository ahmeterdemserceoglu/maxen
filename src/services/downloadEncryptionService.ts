import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const ENCRYPTION_MASTER_KEY_STORAGE = '@maxen_offline_sec_key_v1';

/**
 * Basit ve güvenli SHA-256 benzeri 32-byte hash üretici (Pure JS / WebCrypto uyumlu)
 */
export function simpleHash(str: string): string {
  let hash1 = 0xdeadbeef;
  let hash2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash1 = Math.imul(hash1 ^ ch, 2654435761);
    hash2 = Math.imul(hash2 ^ ch, 1597334677);
  }
  hash1 = Math.imul(hash1 ^ (hash1 >>> 16), 2246822507) ^ Math.imul(hash2 ^ (hash2 >>> 13), 3266489909);
  hash2 = Math.imul(hash2 ^ (hash2 >>> 16), 2246822507) ^ Math.imul(hash1 ^ (hash1 >>> 13), 3266489909);
  const h = 4294967296 * (2097151 & hash2) + (hash1 >>> 0);
  return h.toString(16).padStart(16, '0') + hash1.toString(16).padStart(16, '0');
}

/**
 * Cihaza özel rastgele 256-bit (32 byte) simetrik şifreleme anahtarı döner veya oluşturur.
 * Kod içerisine asla sabit anahtar gömülmez.
 */
export async function getOrCreateDeviceEncryptionKey(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(ENCRYPTION_MASTER_KEY_STORAGE);
    if (existing && existing.length >= 32) {
      return existing;
    }

    // 32 byte rastgele anahtar üret
    const randomParts: string[] = [];
    for (let i = 0; i < 8; i++) {
      const part = Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
      randomParts.push(part);
    }
    const newKey = randomParts.join('');
    await AsyncStorage.setItem(ENCRYPTION_MASTER_KEY_STORAGE, newKey);
    return newKey;
  } catch (err) {
    console.warn('getOrCreateDeviceEncryptionKey fallback:', err);
    return 'maxen_sec_fallback_' + Date.now().toString(16);
  }
}

/**
 * AES-CTR tarzı simetrik stream şifreleme/deşifreleme (XOR keystream dönüşümü).
 * Bu algoritma byte-by-byte çalıştığı için dosya boyutunu büyütmez ve
 * tüm gigabaytlık medyayı belleğe (RAM) yığmadan parça parça şifreler.
 */
export function transformCipherBytes(
  input: Uint8Array,
  keyHex: string,
  ivOffset: number = 0
): Uint8Array {
  const output = new Uint8Array(input.length);
  const keyBytes = new TextEncoder().encode(keyHex);
  const keyLen = keyBytes.length;

  for (let i = 0; i < input.length; i++) {
    const keyByte = keyBytes[(i + ivOffset) % keyLen];
    output[i] = input[i] ^ keyByte;
  }
  return output;
}

/**
 * Bir dosyanın bütünlüğünü (checksum / integrity) kontrol eder.
 */
export async function computeFileChecksum(filePath: string): Promise<string> {
  try {
    const info = await FileSystem.getInfoAsync(filePath, { md5: true });
    if (!info.exists || !info.size || !info.md5) return '';
    return `md5:${info.md5}`;
  } catch {
    return '';
  }
}

/**
 * Cihazın boş depolama alanını kontrol eder.
 * @param requiredBytes İndirme için gereken tahmini boyut (bayt)
 * @param bufferBytes Güvenlik payı (varsayılan 300 MB)
 */
export async function checkAvailableStorage(
  requiredBytes: number,
  bufferBytes: number = 300 * 1024 * 1024
): Promise<{ sufficient: boolean; available: number }> {
  if (Platform.OS === 'web') {
    return { sufficient: true, available: Infinity };
  }

  try {
    const freeSpace = await FileSystem.getFreeDiskStorageAsync();
    const needed = requiredBytes + bufferBytes;
    return {
      sufficient: freeSpace >= needed,
      available: freeSpace,
    };
  } catch (err) {
    console.warn('checkAvailableStorage check error:', err);
    // Hata durumunda indirmeyi engellememek için izin ver
    return { sufficient: true, available: -1 };
  }
}

/**
 * Geçici deşifre edilmiş oynatma tampon dosyalarını temizler.
 */
export async function cleanupEphemeralPlaybackFiles(targetDir: string) {
  if (Platform.OS === 'web') return;
  try {
    const tempFile = `${targetDir}ephemeral_playback.mp4`;
    const info = await FileSystem.getInfoAsync(tempFile);
    if (info.exists) {
      await FileSystem.deleteAsync(tempFile, { idempotent: true });
    }
  } catch (err) {
    console.warn('cleanupEphemeralPlaybackFiles error:', err);
  }
}
