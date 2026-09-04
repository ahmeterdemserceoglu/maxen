import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 dakika taze veri
      gcTime: 1000 * 60 * 30, // 30 dakika önbellek ömrü
      retry: 2,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
});
