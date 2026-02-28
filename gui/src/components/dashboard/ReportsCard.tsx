/**
 * ReportsCard Component
 * Displays latest report statistics
 */

import { motion } from 'framer-motion';
import { useNavigationStore } from '../../stores/useNavigationStore';

interface ReportsCardProps {
  data: {
    total: number;
    unread: number;
    latest: {
      name: string;
      updatedAt: string;
    } | null;
  };
}

/**
 * ReportsCard component shows latest report info
 * @param data - Reports statistics data
 */
export function ReportsCard({ data }: ReportsCardProps) {
  const { setMode } = useNavigationStore();

  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="glass-card rounded-2xl p-6 cursor-pointer"
      onClick={() => setMode('reports')}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
          <span className="material-icons text-orange-400">tips_and_updates</span>
        </div>
        <div>
          <h3 className="text-sm text-[var(--color-morning-mist)]">最新報告</h3>
          {data.unread > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse"></span>
              {data.unread} 未讀
            </span>
          )}
        </div>
      </div>

      <div className="text-3xl font-bold text-[var(--color-moonlight)] mb-2">{data.total}</div>

      {data.latest && (
        <p className="text-xs text-[var(--color-morning-mist)] truncate">
          最新: {data.latest.name.replace('.md', '')}
        </p>
      )}
    </motion.div>
  );
}
