import React from 'react';

interface HiddenResolverWebViewProps {
  resolving: boolean;
  resolverUrl: string | null;
  providerIndex: number;
  webViewRef: React.RefObject<any>;
  onMessage: (event: any) => void;
}

export function HiddenResolverWebView(_props: HiddenResolverWebViewProps) {
  // Web ortamında üçüncü taraf sayfaların DOM'una script enjekte edilemediği (CORS / Same-Origin) için
  // web akış çözümü API proxy veya doğrudan stream URL'leri üzerinden sağlanır.
  return null;
}

export default HiddenResolverWebView;
