/**
 * 消息數據 Hooks
 */

import { useQuery } from '@tanstack/react-query';
import { messagesApi } from '../utils/api';
import type { Message, SessionProvider } from '../types';

/**
 * 獲取會話的所有消息
 */
export function useMessages(sessionId: string | null, provider: SessionProvider = 'claude') {
  return useQuery<Message[]>({
    queryKey: ['messages', provider, sessionId],
    queryFn: () => messagesApi.getBySession(sessionId!, provider),
    enabled: !!sessionId,
  });
}
