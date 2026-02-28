import React from 'react';
import type { WikiProject } from '../../types';
import { useI18n } from '../../i18n';
import { TaskCard } from './TaskCard';

interface KanbanColumnProps {
  category: string;
  label: string;
  tasks: WikiProject[];
  onTaskClick?: (task: WikiProject) => void;
}

/**
 * 看板列組件 — 唯讀
 * 顯示特定狀態的任務列表
 */
export function KanbanColumn({ label, tasks, onTaskClick }: KanbanColumnProps): React.ReactElement {
  const { t } = useI18n();

  return (
    <div className="flex-1 min-w-[320px] max-w-[400px]">
      <div className="glass-card rounded-2xl p-4 h-full flex flex-col">
        {/* Column Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-[var(--color-moonlight)]">{label}</h3>
          <span className="text-xs text-[var(--color-morning-mist)] px-2 py-1 bg-smoke-purple rounded-lg">
            {tasks.length}
          </span>
        </div>

        {/* Task Cards */}
        <div className="flex-1 space-y-2 overflow-y-auto scrollbar-sakura">
          {tasks.length === 0 ? (
            <div className="text-center text-[var(--color-morning-mist)] text-sm py-8">
              {t('issues.kanban.empty')}
            </div>
          ) : (
            tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onClick={() => onTaskClick?.(task)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
