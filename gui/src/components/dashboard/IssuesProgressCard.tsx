/**
 * IssuesProgressCard Component
 * Displays task progress statistics
 */

import { motion } from 'framer-motion';
import { useNavigationStore } from '../../stores/useNavigationStore';

interface IssuesProgressCardProps {
  data: {
    todo: number;
    doing: number;
    done: number;
    recentlyMoved: number;
  };
}

/**
 * IssuesProgressCard component shows task progress
 * @param data - Issues statistics data
 */
export function IssuesProgressCard({ data }: IssuesProgressCardProps) {
  const { setMode } = useNavigationStore();

  const total = data.todo + data.doing + data.done;
  const donePercentage = total > 0 ? Math.round((data.done / total) * 100) : 0;

  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="glass-card rounded-2xl p-6 cursor-pointer"
      onClick={() => setMode('issues')}
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
            <span className="material-icons text-primary">task_alt</span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-[var(--color-moonlight)]">任務進度</h3>
            <p className="text-xs text-[var(--color-morning-mist)]">點擊查看看板</p>
          </div>
        </div>

        <div className="text-right">
          <div className="text-2xl font-bold text-green-400">{donePercentage}%</div>
          <div className="text-xs text-[var(--color-morning-mist)]">完成率</div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--color-morning-mist)]">📋 TODO</span>
          <span className="text-lg font-bold text-[var(--color-moonlight)]">{data.todo}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--color-morning-mist)]">🚧 DOING</span>
          <span className="text-lg font-bold text-orange-400">{data.doing}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--color-morning-mist)]">✅ DONE</span>
          <span className="text-lg font-bold text-green-400">{data.done}</span>
        </div>
      </div>

      {data.recentlyMoved > 0 && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <p className="text-xs text-[var(--color-morning-mist)]">
            最近 24 小時內移動了 <span className="text-primary font-bold">{data.recentlyMoved}</span> 個任務
          </p>
        </div>
      )}
    </motion.div>
  );
}
