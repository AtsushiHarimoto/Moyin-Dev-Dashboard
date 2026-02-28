import React from 'react';
import { motion } from 'framer-motion';
import type { WikiProject } from '../../types';

interface TaskCardProps {
  task: WikiProject;
  onClick?: () => void;
}

/**
 * 任務卡片組件 — 唯讀
 * 展示任務標題和路徑，點擊查看詳情
 */
export function TaskCard({ task, onClick }: TaskCardProps): React.ReactElement {
  const taskName = task.name || 'Untitled Task';

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="glass-card rounded-xl p-4 cursor-pointer hover:border-sakura-400 transition-all"
      onClick={onClick}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="material-icons text-sakura-400 text-sm">folder</span>
        <h4 className="text-sm font-bold text-[var(--color-moonlight)] truncate flex-1">
          {taskName}
        </h4>
      </div>
      <p className="text-xs text-[var(--color-morning-mist)] truncate">{task.path}</p>
    </motion.div>
  );
}
