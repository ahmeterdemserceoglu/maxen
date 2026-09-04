import React from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

interface HiddenResolverWebViewProps {
  resolving: boolean;
  resolverUrl: string | null;
  providerIndex: number;
  webViewRef: React.RefObject<any>;
  onMessage: (event: any) => void;
}

export function HiddenResolverWebView({
  resolving,
  resolverUrl,
  providerIndex,
  webViewRef,
  onMessage,
}: HiddenResolverWebViewProps) {
  if (!resolving || !resolverUrl) return null;

  return (
    <View style={styles.hiddenWebView}>
      <WebView
        key={`resolver-${providerIndex}-${resolverUrl}`}
        ref={webViewRef}
        source={{
          uri: resolverUrl,
          headers: {
            Referer: resolverUrl,
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        thirdPartyCookiesEnabled
        sharedCookiesEnabled
        mixedContentMode="always"
        setSupportMultipleWindows={false}
        onReceivedSslError={(syntheticEvent: any) => {
          try {
            if (syntheticEvent?.preventDefault) {
              syntheticEvent.preventDefault();
            }
          } catch (e) {}
        }}
        onConsoleMessage={(e: any) => {
          console.log(`[WebView Console] ${e.nativeEvent.message}`);
        }}
        onHttpError={(e: any) => {
          console.warn(`[Resolver HTTP ${e.nativeEvent.statusCode}] ${e.nativeEvent.url}`);
        }}
        onError={(e: any) => {
          const desc = e.nativeEvent.description || '';
          if (!desc.includes('SSL') && !desc.includes('certificate')) {
            console.warn(`[Resolver Load Error] ${desc}`);
          }
        }}
        onShouldStartLoadWithRequest={(req) => {
          const u = req.url.toLowerCase();
          if (u.startsWith('data:') || u.startsWith('intent:') || u.startsWith('market:')) {
            return false;
          }
          return true;
        }}
        onMessage={onMessage}
        injectedJavaScriptBeforeContentLoaded={`
          (function() {
            try {
              Object.defineProperty(navigator, 'webdriver', { get: function() { return undefined; } });
              Object.defineProperty(navigator, 'plugins', { get: function() { return [1, 2, 3, 4, 5]; } });
              Object.defineProperty(navigator, 'languages', { get: function() { return ['tr-TR', 'tr', 'en-US', 'en']; } });
            } catch(e) {}

            function isAdUrl(u) {
              if (!u || typeof u !== 'string') return true;
              var s = u.toLowerCase();
              if (s.indexOf('blob:') === 0 || s.indexOf('data:') === 0) return true;
              var bad = [
                'doubleclick', 'googleads', 'googlesyndication', 'adservice', 'popads',
                'adx', 'adsystem', 'propellerads', 'trafficjunky',
                'exoclick', 'adtrue', 'juicyads', 'vast', 'vpaid', '/ads/',
                'adcdn', 'adserver'
              ];
              for (var i = 0; i < bad.length; i++) {
                if (s.indexOf(bad[i]) !== -1) return true;
              }
              return false;
            }

            function sendResolved(url) {
              if (!url || typeof url !== 'string' || isAdUrl(url)) return;
              try {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'RESOLVED_URL',
                  url: url,
                  referer: window.location.href
                }));
              } catch(e) {}
            }

            try {
              var origSrcDesc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src');
              if (origSrcDesc && origSrcDesc.set) {
                var origSet = origSrcDesc.set;
                Object.defineProperty(HTMLMediaElement.prototype, 'src', {
                  set: function(val) {
                    if (val && !isAdUrl(val) && (val.indexOf('.mp4') !== -1 || val.indexOf('.m3u8') !== -1)) {
                      sendResolved(val);
                    }
                    return origSet.call(this, val);
                  },
                  get: origSrcDesc.get
                });
              }
            } catch(e) {}

            try {
              window.addEventListener('message', function(e) {
                if (e && e.data) {
                  var d = typeof e.data === 'string' ? e.data : JSON.stringify(e.data);
                  var u = d.toLowerCase();
                  if (u.indexOf('.m3u8') !== -1 || u.indexOf('.mp4') !== -1 || u.indexOf('master') !== -1 || u.indexOf('playlist') !== -1 || u.indexOf('opstream') !== -1 || u.indexOf('phim1280') !== -1 || u.indexOf('finepulfe') !== -1 || u.indexOf('/proxy') !== -1) {
                    var match = d.match(/https?:\\/\\/[^"'\\s\\\\]+/i);
                    if (match && !isAdUrl(match[0])) sendResolved(match[0]);
                  }
                }
              });
            } catch(e) {}

            try {
              var origOpen = XMLHttpRequest.prototype.open;
              XMLHttpRequest.prototype.open = function(method, url) {
                if (typeof url === 'string') {
                  var u = url.toLowerCase();
                  if (u.indexOf('.m3u8') !== -1 || u.indexOf('.mp4') !== -1 || u.indexOf('master') !== -1 || u.indexOf('playlist') !== -1 || u.indexOf('index.m3u8') !== -1 || u.indexOf('/proxy') !== -1 || u.indexOf('finepulfe') !== -1 || u.indexOf('purstream') !== -1 || u.indexOf('opstream') !== -1 || u.indexOf('phim1280') !== -1) {
                    if (!isAdUrl(url)) sendResolved(url);
                  }
                }
                return origOpen.apply(this, arguments);
              };
            } catch(e) {}

            try {
              var origFetch = window.fetch;
              window.fetch = function(input, init) {
                var url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
                if (typeof url === 'string') {
                  var u = url.toLowerCase();
                  if (u.indexOf('.m3u8') !== -1 || u.indexOf('.mp4') !== -1 || u.indexOf('master') !== -1 || u.indexOf('playlist') !== -1 || u.indexOf('index.m3u8') !== -1 || u.indexOf('/proxy') !== -1 || u.indexOf('finepulfe') !== -1 || u.indexOf('purstream') !== -1 || u.indexOf('opstream') !== -1 || u.indexOf('phim1280') !== -1) {
                    if (!isAdUrl(url)) sendResolved(url);
                  }
                }
                return origFetch.apply(this, arguments);
              };
            } catch(e) {}
          })();
          true;
        `}
        injectedJavaScript={`
          (function() {
            var scanInterval = null;
            function isAdUrl(u) {
              if (!u || typeof u !== 'string') return true;
              var s = u.toLowerCase();
              if (s.indexOf('blob:') === 0 || s.indexOf('data:') === 0) return true;
              var bad = [
                'doubleclick', 'googleads', 'googlesyndication', 'adservice', 'popads',
                'adx', 'adsystem', 'propellerads', 'trafficjunky',
                'exoclick', 'adtrue', 'juicyads', 'vast', 'vpaid', '/ads/',
                'adcdn', 'adserver'
              ];
              for (var i = 0; i < bad.length; i++) {
                if (s.indexOf(bad[i]) !== -1) return true;
              }
              return false;
            }

            function send(type, data) {
              try {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type, ...data }));
              } catch(e){}
            }

            send('DEBUG_LOG', { msg: 'Tarayıcı çözücü betiği başlatıldı. URL: ' + location.href });

            function scanVideo() {
              try {
                var entries = performance.getEntriesByType('resource');
                for (var k = 0; k < entries.length; k++) {
                  var name = entries[k].name;
                  if (name && (name.indexOf('.m3u8') !== -1 || name.indexOf('.mp4') !== -1)) {
                    if (!isAdUrl(name)) {
                      send('DEBUG_LOG', { msg: 'Ağ seviyesinde M3U8 bulundu: ' + name });
                      send('RESOLVED_URL', { url: name, referer: window.location.href });
                      if (scanInterval) clearInterval(scanInterval);
                      return true;
                    }
                  }
                }
              } catch(e) {}

              var videos = document.querySelectorAll('video');
              for (var i = 0; i < videos.length; i++) {
                var v = videos[i];
                if (v.src && (v.src.indexOf('.m3u8') !== -1 || v.src.indexOf('.mp4') !== -1)) {
                  if (!isAdUrl(v.src)) {
                    send('DEBUG_LOG', { msg: 'DOM Video elementinde M3U8 bulundu: ' + v.src });
                    send('RESOLVED_URL', { url: v.src, referer: window.location.href });
                    if (scanInterval) clearInterval(scanInterval);
                    return true;
                  }
                }
              }

              var sources = document.querySelectorAll('source');
              for (var j = 0; j < sources.length; j++) {
                var s = sources[j];
                if (s.src && (s.src.indexOf('.m3u8') !== -1 || s.src.indexOf('.mp4') !== -1)) {
                  if (!isAdUrl(s.src)) {
                    send('DEBUG_LOG', { msg: 'DOM Source elementinde M3U8 bulundu: ' + s.src });
                    send('RESOLVED_URL', { url: s.src, referer: window.location.href });
                    if (scanInterval) clearInterval(scanInterval);
                    return true;
                  }
                }
              }
              return false;
            }

            function scanSubtitles() {
              var subs = [];
              document.querySelectorAll('track').forEach(function(t) {
                if (t.src) {
                  subs.push({
                    label: t.label || t.srclang || 'Altyazı',
                    lang: t.srclang || '',
                    url: new URL(t.src, location.href).href
                  });
                }
              });
              if (subs.length > 0) send('SUBTITLES_METADATA', { subtitles: subs });
            }

            function scanAudio() {
              try {
                var audios = [];
                var audioElements = document.querySelectorAll('audio');
                for (var a = 0; a < audioElements.length; a++) {
                  var aud = audioElements[a];
                  if (aud.src && !isAdUrl(aud.src)) {
                    audios.push({
                      label: aud.title || 'Ses Parçası',
                      url: aud.src,
                      language: ''
                    });
                  }
                }
                if (window.jwplayer && typeof window.jwplayer === 'function') {
                  try {
                    var jw = window.jwplayer();
                    var jwAudios = jw.getAudioTracks && jw.getAudioTracks();
                    if (Array.isArray(jwAudios)) {
                      jwAudios.forEach(function(jt) {
                        audios.push({
                          label: jt.name || jt.language || 'Ses',
                          language: jt.language || '',
                          url: jt.hlsResource || ''
                        });
                      });
                    }
                  } catch(e) {}
                }
                if (audios.length > 0) {
                  send('AUDIO_TRACKS', { audioTracks: audios });
                }
              } catch(e) {}
            }

            window.stopScanInterval = function() {
              if (scanInterval) { clearInterval(scanInterval); scanInterval = null; }
            };

            setTimeout(function() {
              var btn = document.querySelector('button, .play-btn, [class*="play"], .jw-display-icon');
              if (btn) { try { btn.click(); } catch(e){} }
              scanVideo();
              scanSubtitles();
              scanAudio();
              scanInterval = setInterval(function() {
                scanVideo();
                scanSubtitles();
                scanAudio();
              }, 1000);
            }, 500);
          })();
          true;
        `}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hiddenWebView: {
    position: 'absolute',
    width: 2,
    height: 2,
    bottom: 0,
    right: 0,
    opacity: 0.01,
    overflow: 'hidden',
  },
});
