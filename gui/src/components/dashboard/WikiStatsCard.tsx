/**
 * WikiStatsCard Component
 * Displays wiki documentation statistics
 */

import { motion } from 'framer-motion';

interface WikiStatsCardProps {
  data: {
    projects: number;
    knowledge: number;
    skillsDocs: number;
    recentUpdates: Array<{
      name: string;
      updatedAt: string;
    }>;
  };
}

/**
 * WikiStatsCard component shows wiki documentation stats
 * @param data - Wiki statistics data
 */
export function WikiStatsCard({ data }: WikiStatsCardProps) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="glass-card rounded-2xl p-6"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
          <span className="material-icons text-blue-400">menu_book</span>
        </div>
        <div>
          <h3 className="text-lg font-bold text-[var(--color-moonlight)]">文檔統計</h3>
          <p className="text-xs text-[var(--color-morning-mist)]">Wiki & Knowledge</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <div className="text-2xl font-bold text-[var(--color-moonlight)]">{data.projects}</div>
          <div className="text-xs text-[var(--color-morning-mist)]">項目文檔</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-[var(--color-moonlight)]">{data.knowledge}</div>
          <div className="text-xs text-[var(--color-morning-mist)]">知識庫</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-[var(--color-moonlight)]">{data.skillsDocs}</div>
          <div className="text-xs text-[var(--color-morning-mist)]">Skills</div>
        </div>
      </div>

      {data.recentUpdates?.length > 0 && (
        <div className="pt-4 border-t border-white/10">
          <p className="text-xs text-[var(--color-morning-mist)] mb-2">最近更新:</p>
          <div className="space-y-1">
            {data.recentUpdates.slice(0, 3).map((update, i) => (
              <div key={i} className="text-xs text-[var(--color-morning-mist)] truncate">
                • {update.name}
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
