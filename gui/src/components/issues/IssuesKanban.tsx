import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useWikiProjects } from '../../hooks/useWiki';
import { wikiApi } from '../../utils/api';
import { useI18n } from '../../i18n';
import { toast } from '../common/Toast';
import { KanbanColumn } from './KanbanColumn';
import { TaskDetailModal } from './TaskDetailModal';
import type { WikiProject } from '../../types';

/**
 * Issues Kanban Board — 唯讀模式
 * 僅瀏覽任務狀態，不對實際檔案做任何變更。
 * 資料來源：wiki sync → SQLite DB
 */
export function IssuesKanban(): React.ReactElement {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [selectedProject, setSelectedProject] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // 獲取三列數據
  const { data: todoProjects = [], isLoading: loadingTodo } = useWikiProjects('TODO');
  const { data: doingProjects = [], isLoading: loadingDoing } = useWikiProjects('DOING');
  const { data: doneProjects = [], isLoading: loadingDone } = useWikiProjects('DONE');

  const isLoading = loadingTodo || loadingDoing || loadingDone;

  // 同步 Wiki 數據（只寫 DB，不改檔案）
  const { mutate: syncWiki, isPending: isSyncing } = useMutation({
    mutationFn: () => wikiApi.syncWiki(),
    onSuccess: (data) => {
      toast.success(t('issues.kanban.toast.syncSuccess', { projects: data.projects, files: data.files }));
      queryClient.invalidateQueries({ queryKey: ['wiki', 'projects'] });
    },
    onError: (error: any) => {
      toast.error(t('issues.kanban.toast.syncFailed', { message: error.message }));
    },
  });

  function handleTaskClick(task: WikiProject): void {
    setSelectedProject({ id: task.id, name: task.name });
  }

  function handleCloseDetail(): void {
    setSelectedProject(null);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-[var(--color-moonlight)]">{t('issues.kanban.loading')}</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6">
      {/* Toolbar */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-[var(--color-moonlight)]">{t('issues.kanban.title')}</h2>
          <p className="text-sm text-[var(--color-morning-mist)] mt-1">{t('issues.kanban.subtitle')}</p>
        </div>

        <div className="flex items-center gap-3">
          {/* 同步按鈕（只寫 DB，不改檔案） */}
          <button
            onClick={() => syncWiki()}
            disabled={isSyncing}
            className={clsx(
              'flex items-center gap-2 px-6 py-2.5 rounded-xl bg-moonlight/5 hover:bg-moonlight/10 border border-moonlight/10 transition-all',
              isSyncing && 'opacity-50 cursor-not-allowed'
            )}
          >
            <span
              className={clsx(
                'material-icons text-lg',
                isSyncing ? 'animate-spin text-sakura-400' : 'text-[var(--color-morning-mist)]'
              )}
            >
              sync
            </span>
            <span className="text-sm font-bold text-[var(--color-moonlight)]">
              {isSyncing ? t('issues.kanban.syncing') : t('issues.kanban.sync')}
            </span>
          </button>
        </div>
      </div>

      {/* Kanban Board — 純瀏覽，無拖曳 */}
      <div className="flex-1 flex gap-4 overflow-x-auto pb-4">
        <KanbanColumn
          category="TODO"
          label="📋 TODO"
          tasks={todoProjects}
          onTaskClick={handleTaskClick}
        />
        <KanbanColumn
          category="DOING"
          label="🚧 DOING"
          tasks={doingProjects}
          onTaskClick={handleTaskClick}
        />
        <KanbanColumn
          category="DONE"
          label="✅ DONE"
          tasks={doneProjects}
          onTaskClick={handleTaskClick}
        />
      </div>

      {/* 項目詳情 Modal */}
      <TaskDetailModal
        projectId={selectedProject?.id || null}
        projectName={selectedProject?.name || ''}
        onClose={handleCloseDetail}
      />
    </div>
  );
}
