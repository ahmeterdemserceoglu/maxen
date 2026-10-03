import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { checkAvailableStorage, computeFileChecksum, simpleHash } from './downloadEncryptionService';
import { buildOfflineHlsPlan, isHlsUrl, OfflineAsset } from './offlineHls';

const STORAGE_KEY = '@maxen_downloads_v1';
const DOWNLOAD_DIR = `${FileSystem.documentDirectory || ''}maxen_downloads/`;
export type DownloadStatus = 'queued' | 'downloading' | 'paused' | 'completed' | 'error';
export interface DownloadItem {
  id: string; tmdbId: string; type: 'movie' | 'tv'; title: string;
  show_title?: string; season_number?: number; episode_number?: number;
  posterUrl?: string | null; backdropUrl?: string | null;
  streamUrl: string; headers?: Record<string, string>; localUri?: string;
  isEncrypted?: boolean; checksum?: string; resumeData?: string;
  progress: number; totalBytes: number; downloadedBytes: number;
  status: DownloadStatus; downloadedAt: number; error?: string; retryCount?: number;
}
type Receipt = { size: number; checksum: string };
type Index = { fingerprint: string; files: Record<string, Receipt> };
type Run = {
  item: DownloadItem; controller: AbortController;
  jobs: Set<FileSystem.DownloadResumable>; stopped: boolean; done: Promise<void>;
};
let queue: DownloadItem[] = [];
let loading: Promise<void> | undefined;
let writes = Promise.resolve();
let active: Run | undefined;
const listeners = new Set<(items: DownloadItem[]) => void>();
const deleting = new Set<string>();
const stops = new Map<string, Promise<void>>();
const folderFor = (id: string) => `${DOWNLOAD_DIR}${id.replace(/[^a-zA-Z0-9_-]/g, '_')}/`;
const notify = () => listeners.forEach(l => { try { l(queue.map(i => ({ ...i }))); } catch {} });
function saveQueue(): Promise<void> {
  const snapshot = JSON.stringify(queue);
  writes = writes.catch(() => undefined).then(() => AsyncStorage.setItem(STORAGE_KEY, snapshot));
  notify();
  return writes;
}
async function loadQueue(): Promise<void> {
  if (!loading) {
    loading = (async () => {
      const json = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed = json ? JSON.parse(json) : [];
      queue = Array.isArray(parsed) ? parsed : [];
      for (const item of queue) if (item.status === 'downloading') item.status = 'queued';
      await saveQueue();
      setTimeout(processQueue, 0);
    })().catch(e => { loading = undefined; throw e; });
  }
  await loading;
}
export function subscribeToDownloads(listener: (items: DownloadItem[]) => void): () => void {
  listeners.add(listener);
  loadQueue().then(() => { if (listeners.has(listener)) listener(queue.map(i => ({ ...i }))); })
    .catch(e => console.warn('İndirme listesi yüklenemedi:', e));
  return () => { listeners.delete(listener); };
}
export async function getDownloads(): Promise<DownloadItem[]> {
  await loadQueue(); return queue.map(i => ({ ...i }));
}
export async function getDownloadedMedia(id: string): Promise<DownloadItem | null> {
  await loadQueue();
  const item = queue.find(i => i.id === id && i.status === 'completed');
  return item && await verifyDownloadIntegrity(item) ? { ...item } : null;
}
export async function queueDownload(input: Omit<DownloadItem, 'progress' | 'totalBytes' | 'downloadedBytes' | 'status' | 'downloadedAt'>): Promise<DownloadItem> {
  if (Platform.OS === 'web') throw new Error('Çevrimdışı indirme mobil uygulamada kullanılabilir.');
  await loadQueue();
  if (deleting.has(input.id)) throw new Error('Dosya siliniyor, lütfen tekrar deneyin.');
  await stops.get(input.id);
  let existing = queue.find(i => i.id === input.id);
  if (existing?.status === 'downloading' || existing?.status === 'queued') return { ...existing };
  if (existing?.status === 'completed' && await verifyDownloadIntegrity(existing)) return { ...existing };
  if (active?.item.id === input.id) await active.done;
  const disk = await checkAvailableStorage(100 * 1024 * 1024, 200 * 1024 * 1024);
  if (!disk.sufficient) throw new Error('En az 300 MB boş alan gereklidir.');
  await FileSystem.makeDirectoryAsync(DOWNLOAD_DIR, { intermediates: true });
  // Another enqueue may have completed while storage/space checks were pending.
  existing = queue.find(i => i.id === input.id);
  if (existing?.status === 'downloading' || existing?.status === 'queued') return { ...existing };
  const item = existing || { ...input, progress: 0, totalBytes: 0, downloadedBytes: 0, downloadedAt: Date.now() } as DownloadItem;
  if (item.streamUrl !== input.streamUrl) item.resumeData = undefined;
  Object.assign(item, input, { status: 'queued', error: undefined, isEncrypted: false });
  if (!existing) queue.push(item);
  await saveQueue(); processQueue(); return { ...item };
}
function assertActive(run: Run) {
  if (run.stopped || run.controller.signal.aborted || !queue.includes(run.item)) throw new Error('İndirme durduruldu.');
}
function processQueue() {
  if (active) return;
  const item = queue.find(i => i.status === 'queued' && !deleting.has(i.id));
  if (!item) return;
  const run: Run = { item, controller: new AbortController(), jobs: new Set(), stopped: false, done: Promise.resolve() };
  active = run; item.status = 'downloading'; item.error = undefined;
  run.done = execute(run).finally(() => { if (active === run) active = undefined; processQueue(); });
}
async function execute(run: Run) {
  try {
    await saveQueue(); assertActive(run);
    const folder = folderFor(run.item.id);
    await FileSystem.makeDirectoryAsync(folder, { intermediates: true }); assertActive(run);
    if (isHlsUrl(run.item.streamUrl)) await downloadHls(run, folder);
    else await downloadDirect(run, folder);
    assertActive(run);
    Object.assign(run.item, { status: 'completed', progress: 1, downloadedAt: Date.now(), retryCount: 0, resumeData: undefined });
    await saveQueue();
  } catch (e: any) {
    if (!run.stopped && queue.includes(run.item)) {
      run.item.status = 'error'; run.item.error = e?.message || 'İndirme tamamlanamadı.';
      await saveQueue().catch(err => console.warn('İndirme kaydı yazılamadı:', err));
    }
  }
}
const headersFor = (item: DownloadItem): Record<string, string> => ({
  'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36',
  ...(item.streamUrl.includes('vixsrc') ? { Referer: 'https://vixsrc.to/' } : {}), ...item.headers,
});
async function checkedReceipt(uri: string): Promise<Receipt> {
  const info = await FileSystem.getInfoAsync(uri, { md5: true });
  if (!info.exists || !info.size || !info.md5) throw new Error('İndirilen dosya eksik veya doğrulanamadı.');
  return { size: info.size, checksum: `md5:${info.md5}` };
}
async function downloadAsset(run: Run, asset: OfflineAsset, folder: string): Promise<Receipt> {
  for (let attempt = 0; attempt < 3; attempt++) {
    assertActive(run);
    const uri = folder + asset.file;
    const headers = headersFor(run.item);
    if (asset.range) headers.Range = `bytes=${asset.range.start}-${asset.range.start + asset.range.length - 1}`;
    const job = FileSystem.createDownloadResumable(asset.url, uri, { headers });
    run.jobs.add(job);
    try {
      const result = await job.downloadAsync(); assertActive(run);
      if (!result || result.status < 200 || result.status >= 300 || (asset.range && result.status !== 206)) throw new Error(`Video parçası indirilemedi (${result?.status ?? 'yanıt yok'}).`);
      const contentType = Object.entries(result.headers || {}).find(([k]) => k.toLowerCase() === 'content-type')?.[1] || '';
      if (/text\/html|json/i.test(contentType)) throw new Error('Video parçası yerine geçersiz bir yanıt alındı.');
      const receipt = await checkedReceipt(uri);
      if (asset.range && receipt.size !== asset.range.length) throw new Error('Video parçasının boyutu uyuşmuyor.');
      if (asset.key && receipt.size !== 16) throw new Error('HLS şifreleme anahtarı geçersiz.');
      return receipt;
    } catch (e) {
      assertActive(run);
      await FileSystem.deleteAsync(uri, { idempotent: true });
      if (attempt === 2) throw e;
      await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
    } finally { run.jobs.delete(job); }
  }
  throw new Error('Video parçası indirilemedi.');
}
async function downloadHls(run: Run, folder: string) {
  const plan = await buildOfflineHlsPlan(run.item.streamUrl, async url => {
    assertActive(run);
    const response = await fetch(url, { headers: headersFor(run.item), signal: run.controller.signal });
    if (!response.ok) throw new Error(`Oynatma listesi alınamadı (${response.status}).`);
    return { text: await response.text(), url: response.url || url };
  });
  assertActive(run);
  const fingerprint = simpleHash(JSON.stringify(plan));
  const indexPath = folder + 'offline_index.json';
  let index: Index = { fingerprint, files: {} };
  try { const previous = JSON.parse(await FileSystem.readAsStringAsync(indexPath)); if (previous.fingerprint === fingerprint) index = previous; } catch {}
  let completed = 0, bytes = 0, next = 0;
  let indexWrites = Promise.resolve();
  let failure: unknown;
  const persistIndex = () => {
    const snapshot = JSON.stringify(index);
    indexWrites = indexWrites.then(() => FileSystem.writeAsStringAsync(indexPath, snapshot));
    return indexWrites;
  };
  const worker = async () => {
    while (next < plan.assets.length && !failure) {
      const asset = plan.assets[next++];
      try {
        assertActive(run);
        let receipt: Receipt | undefined = index.files[asset.file];
        if (receipt) {
          try { const current = await checkedReceipt(folder + asset.file); if (current.size !== receipt.size || current.checksum !== receipt.checksum) receipt = undefined; }
          catch { receipt = undefined; }
        }
        if (!receipt) receipt = await downloadAsset(run, asset, folder);
        assertActive(run); index.files[asset.file] = receipt; bytes += receipt.size; completed++;
        run.item.downloadedBytes = bytes;
        run.item.progress = completed / (plan.assets.length + Object.keys(plan.playlists).length);
        run.item.totalBytes = Math.round(bytes / completed * plan.assets.length);
        notify(); await persistIndex(); if (completed % 10 === 0) await saveQueue();
      } catch (e) { failure = e; }
    }
  };
  // Release the queue only after every native writer has settled.
  await Promise.all(Array.from({ length: Math.min(5, plan.assets.length) }, worker));
  await indexWrites;
  if (failure) throw failure;
  assertActive(run);
  if (completed !== plan.assets.length) throw new Error('İndirme eksik, lütfen devam ettirin.');
  for (const [name, text] of Object.entries(plan.playlists)) {
    assertActive(run); await FileSystem.writeAsStringAsync(folder + name, text);
    index.files[name] = await checkedReceipt(folder + name);
  }
  await persistIndex();
  run.item.localUri = folder + plan.entry; run.item.checksum = index.files[plan.entry].checksum;
  run.item.downloadedBytes = Object.values(index.files).reduce((sum, r) => sum + r.size, 0);
  run.item.totalBytes = run.item.downloadedBytes;
}
async function downloadDirect(run: Run, folder: string) {
  const item = run.item, uri = folder + 'video.mp4';
  if (!item.resumeData) { item.progress = 0; item.totalBytes = 0; item.downloadedBytes = 0; }
  const job = FileSystem.createDownloadResumable(item.streamUrl, uri, { headers: headersFor(item) }, progress => {
    if (run.stopped) return;
    item.downloadedBytes = Math.max(0, progress.totalBytesWritten);
    item.totalBytes = Math.max(0, progress.totalBytesExpectedToWrite);
    item.progress = item.totalBytes > 0 ? Math.min(0.99, item.downloadedBytes / item.totalBytes) : 0; notify();
  }, item.resumeData);
  run.jobs.add(job);
  try {
    const result = item.resumeData ? await job.resumeAsync() : await job.downloadAsync(); assertActive(run);
    if (!result || result.status < 200 || result.status >= 300 || (item.resumeData && result.status !== 206)) {
      item.resumeData = undefined; await FileSystem.deleteAsync(uri, { idempotent: true });
      throw new Error(`Video indirilemedi (${result?.status ?? 'yanıt yok'}).`);
    }
    const contentType = Object.entries(result.headers || {}).find(([k]) => k.toLowerCase() === 'content-type')?.[1] || '';
    if (/text\/|json|mpegurl/i.test(contentType)) throw new Error('Kaynak video yerine geçersiz bir yanıt döndürdü.');
    const receipt = await checkedReceipt(uri);
    if (item.totalBytes > 0 && receipt.size !== item.totalBytes) {
      throw new Error('Video dosyası tam olarak indirilemedi. Lütfen tekrar deneyin.');
    }
    item.localUri = uri; item.checksum = receipt.checksum; item.downloadedBytes = item.totalBytes = receipt.size;
  } catch (e) {
    if (!run.stopped) item.resumeData = undefined;
    throw e;
  } finally { run.jobs.delete(job); }
}

/** Check every local HLS dependency, including downloads from older versions. */
export async function verifyDownloadIntegrity(item: DownloadItem): Promise<boolean> {
  const folder = folderFor(item.id);
  if (!item.localUri?.startsWith(folder)) return false;
  try {
    const info = await FileSystem.getInfoAsync(item.localUri);
    if (!info.exists || !info.size) return false;
    if (item.checksum?.startsWith('md5:') && await computeFileChecksum(item.localUri) !== item.checksum) return false;
    if (!isHlsUrl(item.localUri)) return true;
    const visited = new Set<string>();
    const visit = async (uri: string): Promise<boolean> => {
      if (visited.has(uri)) return true;
      visited.add(uri);
      const text = await FileSystem.readAsStringAsync(uri);
      if (!text.startsWith('#EXTM3U')) return false;
      let children = 0;
      for (const line of text.split(/\r?\n/).map(l => l.trim())) {
        const child = line && !line.startsWith('#') ? line : line.match(/URI="([^"]+)"/)?.[1];
        if (!child) continue;
        if (!/^[a-zA-Z0-9_.-]+$/.test(child) || child === '..') return false;
        const childUri = folder + child, childInfo = await FileSystem.getInfoAsync(childUri);
        if (!childInfo.exists || !childInfo.size) return false;
        if (isHlsUrl(childUri) && !await visit(childUri)) return false;
        children++;
      }
      return children > 0;
    };
    if (!await visit(item.localUri)) return false;
    const indexInfo = await FileSystem.getInfoAsync(folder + 'offline_index.json');
    if (indexInfo.exists) {
      const index: Index = JSON.parse(await FileSystem.readAsStringAsync(folder + 'offline_index.json'));
      for (const [name, expected] of Object.entries(index.files)) {
        if (!/^[a-zA-Z0-9_.-]+$/.test(name) || name === '..') return false;
        const current = await checkedReceipt(folder + name);
        if (current.size !== expected.size || current.checksum !== expected.checksum) return false;
      }
    }
    return true;
  } catch { return false; }
}
function stopRun(run: Run, retainResume: boolean): Promise<void> {
  const previous = stops.get(run.item.id);
  if (previous) return previous;
  const operation = finishStop(run, retainResume).finally(() => { stops.delete(run.item.id); });
  stops.set(run.item.id, operation);
  return operation;
}
async function finishStop(run: Run, retainResume: boolean) {
  run.stopped = true; run.controller.abort();
  await Promise.allSettled([...run.jobs].map(async job => {
    const state = await job.pauseAsync();
    if (retainResume && !isHlsUrl(run.item.streamUrl)) run.item.resumeData = state.resumeData;
  }));
  await run.done;
}
export async function pauseDownload(id: string) {
  await loadQueue(); const item = queue.find(i => i.id === id);
  if (!item || !['downloading', 'queued'].includes(item.status)) return;
  item.status = 'paused'; const run = active?.item === item ? active : undefined;
  if (run) await stopRun(run, true); await saveQueue();
}
export async function resumeDownload(id: string) {
  await loadQueue(); if (deleting.has(id)) return;
  await stops.get(id);
  const item = queue.find(i => i.id === id);
  if (!item || !['paused', 'error'].includes(item.status)) return;
  if (active?.item === item) await active.done;
  item.status = 'queued'; item.error = undefined; await saveQueue(); processQueue();
}
export async function deleteDownload(id: string) {
  await loadQueue(); if (deleting.has(id)) return;
  await stops.get(id);
  const item = queue.find(i => i.id === id); if (!item) return;
  deleting.add(id);
  try {
    item.status = 'paused'; const run = active?.item === item ? active : undefined;
    if (run) await stopRun(run, false);
    await FileSystem.deleteAsync(folderFor(id), { idempotent: true });
    queue = queue.filter(i => i !== item); await saveQueue();
  } finally { deleting.delete(id); processQueue(); }
}
export async function getTotalStorageUsed(): Promise<number> {
  return (await getDownloads()).reduce((sum, i) => sum + (i.downloadedBytes || 0), 0);
}
