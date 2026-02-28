/**
 * QuickActionsCard Component
 * Displays quick action buttons for common operations
 */

import { motion } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { skillsApi, syncApi, wikiApi } from '../../utils/api';
import { toast } from '../common/Toast';

interface QuickActionsCardProps {
  onRefresh: () => void;
}

/**
 * QuickActionsCard component shows quick action button
 * @param onRefresh - Refresh callback
 */
export function QuickActionsCard({ onRefresh }: QuickActionsCardProps) {
  const queryClient = useQueryClient();

  const { mutate: syncAll, isPending: isSyncing } = useMutation({
    mutationFn: async () => {
      // 並行執行所有同步操作
      const results = await Promise.allSettled([
        skillsApi.syncSkills(),
        syncApi.syncAll('claude'),
        wikiApi.syncWiki(),
      ]);
      return results;
    },
    onSuccess: (results) => {
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failCount = results.filter(r => r.status === 'rejected').length;

      if (failCount === 0) {
        toast.success('✅ 所有數據同步成功');
      } else if (successCount > 0) {
        toast.success(`⚠️ 部分同步完成 (${successCount}/${results.length})`);
      } else {
        toast.error('❌ 同步失敗');
      }

      // 刷新所有查詢
      queryClient.invalidateQueries({ queryKey: ['skills'] });
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['wiki'] });
      onRefresh();
    },
    onError: (error: Error) => {
      toast.error(`❌ 同步失敗: ${error.message}`);
    },
  });

  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="glass-card rounded-2xl p-6"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
          <span className="material-icons text-primary">bolt</span>
        </div>
        <h3 className="text-sm text-[var(--color-morning-mist)]">快速操作</h3>
      </div>

      <button
        onClick={() => syncAll()}
        disabled={isSyncing}
        className="w-full flex items-center justify-center gap-3 p-4 rounded-xl bg-gradient-to-r from-primary/20 to-sakura-pink/20 hover:from-primary/30 hover:to-sakura-pink/30 border border-primary/40 hover:border-primary/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className={`material-icons text-primary ${isSyncing ? 'animate-spin' : ''}`}>
          {isSyncing ? 'sync' : 'cloud_sync'}
        </span>
        <span className="text-sm font-bold text-[var(--color-moonlight)]">
          {isSyncing ? '同步中...' : '同步所有數據'}
        </span>
      </button>
    </motion.div>
  );
}
