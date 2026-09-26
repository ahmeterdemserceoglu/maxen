import { useEffect, useRef } from 'react';
import { usePlayerStore } from '@/store/playerStore';
import { streamSessionManager } from '@/features/player/services/StreamSessionManager';
import { streamPreheater } from '@/features/player/services/StreamPreheater';
import { API_BASE_URL } from '@/config/tmdb';

interface StreamResolverProps {
  tmdbId: string | null;
  isMovie: boolean;
  seasonNum: number;
  episodeNum: number;
  isJellyfin: boolean;
  serverUrl?: string;
  itemId?: string;
  userId?: string;
  token?: string;
  playSessionId?: string;
  audioLang?: string;
}

export function useStreamResolver({
  tmdbId,
  isMovie,
  seasonNum,
  episodeNum,
  isJellyfin,
  serverUrl,
  itemId,
  userId,
  token,
  playSessionId,
  audioLang,
}: StreamResolverProps) {
  const setStreamUrl = usePlayerStore((state) => state.setStreamUrl);
  const setResolving = usePlayerStore((state) => state.setResolving);
  const setSubtitles = usePlayerStore((state) => state.setSubtitles);
  const isStreamFoundRef = useRef(false);

  useEffect(() => {
    isStreamFoundRef.current = false;

    if (isJellyfin && serverUrl && itemId && userId && token && playSessionId) {
      setResolving(false);
      const staticUrl = `${serverUrl}/Videos/${itemId}/stream?static=true&MediaSourceId=${itemId}&UserId=${userId}&DeviceId=maxen-device&PlaySessionId=${playSessionId}&api_key=${token}`;
      setStreamUrl(staticUrl);
      isStreamFoundRef.current = true;
      return;
    }

    if (!tmdbId) {
      setResolving(false);
      return;
    }

    const type = isMovie ? 'movie' : 'tv';
    const mediaKey = `${type}_${tmdbId}_${seasonNum}_${episodeNum}`;
    let isCancelled = false;

    async function fetchBackendStream() {
      if (isCancelled) return;
      setResolving(true);
      try {
        const langQuery = audioLang ? `&lang=${encodeURIComponent(audioLang)}` : '';
        const apiUrl = `${API_BASE_URL}/api/stream?tmdbId=${tmdbId}&type=${type}&season=${seasonNum}&episode=${episodeNum}${langQuery}`;
        console.log(`[useStreamResolver] Fetching from API: ${apiUrl}`);
        
        const res = await fetch(apiUrl, {
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!res.ok) {
          throw new Error(`API Error: ${res.status}`);
        }

        const data = await res.json();
        
        if (data && data.success && data.streamUrl) {
          console.log(`[useStreamResolver] SUCCESS! URL: ${data.streamUrl}`);
          isStreamFoundRef.current = true;
          
          if (!isCancelled) {
            setStreamUrl(data.streamUrl);
            if (data.subtitles && Array.isArray(data.subtitles) && data.subtitles.length > 0) {
              setSubtitles(data.subtitles);
              usePlayerStore.getState().setSubtitleTrack(data.subtitles[0]);
            }
            streamSessionManager.setSession({
              streamUrl: data.streamUrl,
              provider: data.provider || 'Maxen Backend',
              expiresAt: Date.now() + 2 * 60 * 60 * 1000,
              headers: data.headers || {}
              ,mediaKey
            });
          }
        } else {
          throw new Error('Stream URL not found in response');
        }
      } catch (e) {
        console.warn(`[useStreamResolver] Error:`, e);
      } finally {
        if (!isCancelled) {
          setResolving(false);
        }
      }
    }

    const savedSession = streamSessionManager.getSession();
    if (savedSession?.mediaKey === mediaKey) {
      console.log(`[useStreamResolver] Using saved session.`);
      setStreamUrl(savedSession.streamUrl);
      isStreamFoundRef.current = true;
      setResolving(false);
      return;
    }

    const cacheKey = streamPreheater.generateKey(tmdbId, type, seasonNum, episodeNum);
    const preheated = streamPreheater.get(cacheKey);

    if (preheated?.streamResult?.streamUrl) {
      console.log(`[useStreamResolver] ⚡ Instant Play Activated from Preheated Cache!`, preheated.streamResult.streamUrl);
      const res = preheated.streamResult;
      setStreamUrl(res.streamUrl);
      if (res.subtitles && Array.isArray(res.subtitles) && res.subtitles.length > 0) {
        setSubtitles(res.subtitles);
        usePlayerStore.getState().setSubtitleTrack(res.subtitles[0]);
      }
      streamSessionManager.setSession({
        streamUrl: res.streamUrl,
        provider: res.provider || 'Preheated Cache',
        expiresAt: Date.now() + 2 * 60 * 60 * 1000,
        headers: res.headers || {}
        ,mediaKey
      });
      isStreamFoundRef.current = true;
      setResolving(false);
      return;
    }

    fetchBackendStream();

    return () => {
      isCancelled = true;
    };
  }, [tmdbId, isMovie, seasonNum, episodeNum, isJellyfin, serverUrl, itemId, userId, token, playSessionId, audioLang]);
}
