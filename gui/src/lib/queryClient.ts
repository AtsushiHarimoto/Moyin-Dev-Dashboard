import { QueryClient } from '@tanstack/react-query';
import { useToastStore } from '../components/common/Toast';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30_000, // 30 seconds default
    },
    mutations: {
      onError: (error: Error) => {
        const addToast = useToastStore.getState().addToast;
        addToast(error.message || '操作失敗', 'error');
      },
    },
  },
});
