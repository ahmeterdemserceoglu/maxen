const { server, startServer } = require('./server');

(async () => {
  const address = await startServer();
  const origin = `http://127.0.0.1:${address.port}`;
  const params = new URLSearchParams({ tmdbId: '1399', type: 'tv', season: '1', episode: '1' });
  const resolved = await (await fetch(`${origin}/api/resolve?${params}`)).json();
  const master = await (await fetch(`${origin}${resolved.streamUrl}`)).text();
  const lines = master.split(/\r?\n/);
  const video = lines.find((line, index) => index > 0 && lines[index - 1].startsWith('#EXT-X-STREAM-INF:'));
  const subtitleLine = lines.find((line) => line.startsWith('#EXT-X-MEDIA:TYPE=SUBTITLES') && /LANGUAGE="tur"/.test(line));
  const subtitle = subtitleLine?.match(/URI="([^"]+)"/)?.[1];
  for (const [name, url] of [['video', video], ['subtitle', subtitle]]) {
    if (!url) continue;
    const response = await fetch(new URL(url, origin));
    const text = await response.text();
    console.log(JSON.stringify({ name, status: response.status, complete: text.includes('#EXT-X-ENDLIST'), byteRange: text.includes('BYTERANGE'), sampleAes: text.includes('SAMPLE-AES'), firstLines: text.split(/\r?\n/).slice(0, 8) }));
  }
})().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
