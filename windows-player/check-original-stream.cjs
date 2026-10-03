const { server, startServer } = require('./server');

const [tmdbId = '1399', type = 'tv', season = '1', episode = '1'] = process.argv.slice(2);

(async () => {
  const address = await startServer();
  const origin = `http://127.0.0.1:${address.port}`;
  const query = new URLSearchParams({ tmdbId, type, season, episode });
  const resolved = await (await fetch(`${origin}/api/resolve?${query}`)).json();
  if (!resolved.ok || !resolved.streamUrl?.startsWith('/api/stream?')) {
    throw new Error(resolved.error || 'Original stream did not use the local proxy');
  }
  const manifestResponse = await fetch(`${origin}${resolved.streamUrl}`);
  const manifest = await manifestResponse.text();
  if (!manifestResponse.ok || !manifest.startsWith('#EXTM3U')) {
    throw new Error(`Master manifest failed: HTTP ${manifestResponse.status}`);
  }
  const audio = manifest.split(/\r?\n/).filter((line) => line.startsWith('#EXT-X-MEDIA:TYPE=AUDIO'));
  const selectedAudio = audio.find((line) => /LANGUAGE="(?:en|eng)"/i.test(line)) || audio[0];
  const selectedAudioUrl = selectedAudio?.match(/URI="([^"]+)"/)?.[1];
  let segmentStatus;
  if (selectedAudioUrl) {
    const audioResponse = await fetch(new URL(selectedAudioUrl, origin));
    const audioManifest = await audioResponse.text();
    if (!audioResponse.ok || !audioManifest.startsWith('#EXTM3U')) {
      throw new Error(`Audio manifest failed: HTTP ${audioResponse.status}`);
    }
    const segmentUrl = audioManifest.split(/\r?\n/).find((line) => line && !line.startsWith('#'));
    if (segmentUrl) {
      const segmentResponse = await fetch(new URL(segmentUrl, origin), { headers: { Range: 'bytes=0-1023' } });
      segmentStatus = segmentResponse.status;
      if (!segmentResponse.ok) throw new Error(`Audio segment failed: HTTP ${segmentStatus}`);
      await segmentResponse.body?.cancel();
    }
  }
  console.log(JSON.stringify({
    masterStatus: manifestResponse.status,
    audioTracks: audio.map((line) => ({
      name: line.match(/NAME="([^"]+)"/)?.[1],
      language: line.match(/LANGUAGE="([^"]+)"/)?.[1],
    })),
    selectedAudio: selectedAudio?.match(/NAME="([^"]+)"/)?.[1],
    segmentStatus,
  }));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => server.close());
