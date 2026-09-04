/**
 * profileMedia.test.ts
 *
 * Bug Fix #1 — "İzlemeye Devam Et" yanlış bölüm açılıyor
 * ─────────────────────────────────────────────────────────
 * Kök neden: mediaDocId dizi bölümleri için sezon/bölüm bilgisini
 * Firestore key'ine dahil etmiyordu; tüm bölümler aynı dokümana
 * yazılıp birbirinin üzerine geçiyordu.
 *
 * Düzeltme: Artık `tv_<id>_S<n>E<n>` formatı kullanılıyor.
 */

import { mediaDocId, normalizeMediaItem } from '../src/types/profileMedia';

// ─────────────────────────────────────────────────────────────────────────────
// mediaDocId — key çakışması düzeltmesi
// ─────────────────────────────────────────────────────────────────────────────
describe('mediaDocId — dizi bölümleri için benzersiz Firestore key üretimi', () => {

  // ── Filmler ────────────────────────────────────────────────────────────────
  describe('Film (movie)', () => {
    it('film için sadece type_id formatı döndürür', () => {
      const id = mediaDocId({ id: 550, type: 'movie', title: 'Fight Club' });
      expect(id).toBe('movie_550');
    });

    it('title olan ama EpisodeNumber olmayan içeriği film sayar', () => {
      const id = mediaDocId({ id: 123, title: 'Interstellar' });
      expect(id).toBe('movie_123');
    });

    it('tmdbId yedek olarak kullanılır', () => {
      const id = mediaDocId({ tmdbId: 999, type: 'movie' });
      expect(id).toBe('movie_999');
    });
  });

  // ── Diziler — ÇAKIŞMA YOKTUR ────────────────────────────────────────────────
  describe('Dizi (tv) — sezon/bölüm keye dahil edilir', () => {

    it('farklı bölümler FARKLI key üretir — çakışma yok [BUG FIX]', () => {
      const base = { tmdbId: 1399, type: 'tv', show_title: 'Game of Thrones' };

      const e1 = mediaDocId({ ...base, season_number: 1, episode_number: 1 });
      const e2 = mediaDocId({ ...base, season_number: 1, episode_number: 2 });
      const e3 = mediaDocId({ ...base, season_number: 1, episode_number: 3 });
      const s2e1 = mediaDocId({ ...base, season_number: 2, episode_number: 1 });

      const keys = new Set([e1, e2, e3, s2e1]);
      expect(keys.size).toBe(4);
    });

    it('key formatı tv_<id>_S<n>E<n> seklindedir', () => {
      const id = mediaDocId({
        id: 1399,
        type: 'tv',
        season_number: 2,
        episode_number: 5,
      });
      expect(id).toBe('tv_1399_S2E5');
    });

    it('farklı sezonlar FARKLI key üretir', () => {
      const base = { id: 66732, type: 'tv' };
      const s1 = mediaDocId({ ...base, season_number: 1, episode_number: 1 });
      const s2 = mediaDocId({ ...base, season_number: 2, episode_number: 1 });
      expect(s1).toBe('tv_66732_S1E1');
      expect(s2).toBe('tv_66732_S2E1');
      expect(s1).not.toBe(s2);
    });

    it('Jellyfin veri formatini (SeasonNumber, IndexNumber) da destekler', () => {
      const id = mediaDocId({
        Id: 'jf_abc123',
        type: 'tv',
        SeasonNumber: 3,
        IndexNumber: 7,
      });
      expect(id).toBe('tv_jf_abc123_S3E7');
    });

    it('Jellyfin (ParentIndexNumber) veri formatini da destekler', () => {
      const id = mediaDocId({
        id: 'jf_xyz',
        type: 'tv',
        ParentIndexNumber: 1,
        IndexNumber: 4,
        EpisodeNumber: undefined,
      });
      expect(id).toBe('tv_jf_xyz_S1E4');
    });

    it('sezon/bolum bilgisi yoksa temel tv_<id> formatina duşer', () => {
      const id = mediaDocId({ id: 1399, type: 'tv' });
      expect(id).toBe('tv_1399');
    });

    it('URL karakterlerindeki slashi alt cizgiye donusturur', () => {
      const id = mediaDocId({
        id: 'show/42',
        type: 'tv',
        season_number: 1,
        episode_number: 1,
      });
      expect(id).not.toContain('/');
    });
  });

  // ── Regresyon — eski bug ────────────────────────────────────────────────────
  describe('Regresyon — eski key cakismasi artik olmayacak', () => {

    it('[REGRESYON] S01E03 ve S01E07 artık FARKLI dokumanlara kaydedilir', () => {
      const show = { id: 12345, type: 'tv', show_title: 'Breaking Bad' };

      const keyE3 = mediaDocId({ ...show, season_number: 1, episode_number: 3 });
      const keyE7 = mediaDocId({ ...show, season_number: 1, episode_number: 7 });

      expect(keyE3).toBe('tv_12345_S1E3');
      expect(keyE7).toBe('tv_12345_S1E7');
      expect(keyE3).not.toBe(keyE7);
    });

    it('[REGRESYON] S01E05 bitince sonraki bolum S01E06 FARKLI key alır', () => {
      const currentEp = { id: 12345, type: 'tv', season_number: 1, episode_number: 5 };
      const nextEp    = { id: 12345, type: 'tv', season_number: 1, episode_number: 6 };
      expect(mediaDocId(currentEp)).not.toBe(mediaDocId(nextEp));
    });

    it('[REGRESYON] 20 farklı bolum => 20 farklı key', () => {
      const keys = Array.from({ length: 20 }, (_, i) =>
        mediaDocId({ id: 999, type: 'tv', season_number: 1, episode_number: i + 1 })
      );
      const unique = new Set(keys);
      expect(unique.size).toBe(20);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// normalizeMediaItem — dizi meta verisi doğru normalize edilir
// ─────────────────────────────────────────────────────────────────────────────
describe('normalizeMediaItem — dizi bolumu meta verisi', () => {

  it('season_number ve episode_number korunur', () => {
    const item = normalizeMediaItem({
      id: 1399,
      type: 'tv',
      show_title: 'Game of Thrones',
      season_number: 2,
      episode_number: 4,
      positionSeconds: 180,
      durationSeconds: 3600,
      progress: 0.05,
    });

    expect(item.season_number).toBe(2);
    expect(item.episode_number).toBe(4);
    expect(item.positionSeconds).toBe(180);
    expect(item.durationSeconds).toBe(3600);
    expect(item.type).toBe('tv');
  });

  it('Jellyfin alanlari (SeasonNumber, EpisodeNumber) normalize edilir', () => {
    const item = normalizeMediaItem({
      id: 'jf_001',
      type: 'tv',
      SeasonNumber: 1,
      EpisodeNumber: 3,
    });
    expect(item.season_number).toBe(1);
    expect(item.episode_number).toBe(3);
  });

  it('film: positionSeconds ve progress dogru kaydedilir', () => {
    const item = normalizeMediaItem({
      id: 550,
      type: 'movie',
      title: 'Fight Club',
      positionSeconds: 1200,
      durationSeconds: 7200,
      progress: 0.167,
    });

    expect(item.type).toBe('movie');
    expect(item.positionSeconds).toBe(1200);
    expect(item.progress).toBeCloseTo(0.167, 2);
  });
});
