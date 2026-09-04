import { useQuery } from '@tanstack/react-query';
import {
  fetchHomePoolData,
  fetchMediaDetailData,
  fetchSeasonData,
  fetchBoxsetData,
} from '@/services/api/tmdbService';

export function useHomeFeedQuery(activeTab: string) {
  return useQuery({
    queryKey: ['homeFeed', activeTab],
    queryFn: () => fetchHomePoolData(activeTab),
    staleTime: 1000 * 60 * 5, // 5 dakika taze
    gcTime: 1000 * 60 * 30, // 30 dakika önbellek
  });
}

export function useMediaDetailQuery(tmdbId: string | undefined | null, type: 'movie' | 'tv') {
  return useQuery({
    queryKey: ['mediaDetail', type, tmdbId],
    queryFn: () => fetchMediaDetailData(tmdbId!, type),
    enabled: Boolean(tmdbId),
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 60,
  });
}

export function useSeasonQuery(tvId: string | undefined | null, seasonNumber: number) {
  return useQuery({
    queryKey: ['seasonDetail', tvId, seasonNumber],
    queryFn: () => fetchSeasonData(tvId!, seasonNumber),
    enabled: Boolean(tvId && seasonNumber >= 0),
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 60,
  });
}

export function useBoxsetQuery(collectionId: string | number | undefined | null) {
  return useQuery({
    queryKey: ['boxsetDetail', collectionId],
    queryFn: () => fetchBoxsetData(collectionId!),
    enabled: Boolean(collectionId),
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 120,
  });
}
