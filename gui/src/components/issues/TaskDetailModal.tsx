import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { wikiApi } from '../../utils/api';
import { useI18n } from '../../i18n';
import { toast } from '../common/Toast';

const COPY_FEEDBACK_DURATION = 2000; // Duration in ms to show copy success feedback

interface TaskDetailModalProps {
  projectId: string | null;
  projectName: string;
  onClose: () => void;
}

/**
 * 任務詳情 Modal - 兩層結構
 * 第一層：顯示項目下的文件列表
 * 第二層：顯示選中文件的 Markdown 內容
 */
export function TaskDetailModal({ projectId, projectName, onClose }: TaskDetailModalProps): React.ReactElement | null {
  const { t } = useI18n();
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [isCopied, setIsCopied] = useState(false);

  // 獲取項目下的文件列表
  const { data: files, isLoading: filesLoading } = useQuery({
    queryKey: ['wiki', 'files', projectId],
    queryFn: () => wikiApi.getFiles(projectId!),
    enabled: !!projectId,
  });

  // 獲取選中文件的內容
  const { data: content, isLoading: contentLoading } = useQuery({
    queryKey: ['wiki', 'content', selectedFileId],
    queryFn: () => wikiApi.getContent(selectedFileId!),
    enabled: !!selectedFileId,
  });

  if (!projectId) return null;

  // 返回文件列表視圖
  const handleBackToList = () => {
    setSelectedFileId(null);
    setSelectedFileName('');
  };

  // 複製 Markdown 內容
  const handleCopyContent = async () => {
    if (!content?.content) return;

    try {
      await navigator.clipboard.writeText(content.content);
      setIsCopied(true);
      toast.success(t('issues.detail.copySuccess'));

      setTimeout(() => setIsCopied(false), COPY_FEEDBACK_DURATION);
    } catch (error) {
      toast.error(t('issues.detail.copyFailed'));
    }
  };

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* Modal */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', damping: 20 }}
          className="glass-card rounded-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              {selectedFileId && (
                <button
                  onClick={handleBackToList}
                  className="w-10 h-10 rounded-xl bg-moonlight/5 hover:bg-moonlight/10 flex items-center justify-center text-[var(--color-morning-mist)] hover:text-[var(--color-moonlight)] transition-all"
                  title={t('issues.detail.backToList')}
                >
                  <span className="material-icons">arrow_back</span>
                </button>
              )}

              <div className="w-10 h-10 rounded-xl bg-sakura-500/20 flex items-center justify-center">
                <span className="material-icons text-sakura-400">
                  {selectedFileId ? 'article' : 'folder'}
                </span>
              </div>

              <div>
                <h2 className="text-xl font-bold text-[var(--color-moonlight)]">
                  {selectedFileId ? selectedFileName : projectName}
                </h2>
                <p className="text-xs text-[var(--color-morning-mist)]">
                  {selectedFileId ? t('issues.detail.fileDetail') : t('issues.detail.fileList')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Copy Button - 僅在文件詳情視圖顯示 */}
              {selectedFileId && content && (
                <button
                  onClick={handleCopyContent}
                  className={clsx(
                    'flex items-center gap-2 px-4 py-2 rounded-xl border transition-all',
                    isCopied
                      ? 'bg-green-500/20 border-green-500/40'
                      : 'bg-moonlight/5 hover:bg-moonlight/10 border-moonlight/10 hover:border-sakura-400/40'
                  )}
                  title={t('issues.detail.copy')}
                >
                  <span
                    className={clsx(
                      'material-icons text-lg transition-colors',
                      isCopied ? 'text-green-400' : 'text-[var(--color-morning-mist)]'
                    )}
                  >
                    {isCopied ? 'check' : 'content_copy'}
                  </span>
                  <span className="text-sm font-bold text-[var(--color-moonlight)]">
                    {isCopied ? t('issues.detail.copied') : t('issues.detail.copy')}
                  </span>
                </button>
              )}

              {/* Close Button */}
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-xl bg-moonlight/5 hover:bg-moonlight/10 flex items-center justify-center text-[var(--color-morning-mist)] hover:text-[var(--color-moonlight)] transition-all"
                title={t('issues.kanban.cancel')}
              >
                <span className="material-icons">close</span>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 scrollbar-sakura">
            {!selectedFileId ? (
              // 文件列表視圖
              filesLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="w-10 h-10 border-4 border-sakura-500/20 border-t-sakura-500 rounded-full animate-spin"></div>
                </div>
              ) : files && files.length > 0 ? (
                (() => {
                  // 過濾只顯示 .md 文件
                  const mdFiles = files.filter(file => file.name.toLowerCase().endsWith('.md'));

                  if (mdFiles.length === 0) {
                    return (
                      <div className="text-center py-20 text-[var(--color-morning-mist)]">
                        <span className="material-icons text-6xl opacity-20 mb-4">folder_open</span>
                        <p>{t('issues.detail.noMarkdown')}</p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-2">
                      {mdFiles.map((file) => (
                        <motion.button
                          key={file.id}
                          whileHover={{ x: 4 }}
                          onClick={() => {
                            setSelectedFileId(file.id);
                            setSelectedFileName(file.name);
                          }}
                          className="w-full flex items-center gap-3 p-4 rounded-xl bg-moonlight/5 hover:bg-moonlight/10 border border-moonlight/10 hover:border-sakura-400/40 transition-all text-left"
                        >
                          <span className="material-icons text-sakura-400">description</span>
                          <div className="flex-1">
                            <div className="text-sm font-bold text-[var(--color-moonlight)]">{file.name}</div>
                            <div className="text-xs text-[var(--color-morning-mist)]">{file.path}</div>
                          </div>
                          <span className="material-icons text-[var(--color-morning-mist)]">chevron_right</span>
                        </motion.button>
                      ))}
                    </div>
                  );
                })()
              ) : (
                <div className="text-center py-20 text-[var(--color-morning-mist)]">
                  <span className="material-icons text-6xl opacity-20 mb-4">folder_open</span>
                  <p>{t('issues.detail.noFiles')}</p>
                </div>
              )
            ) : (
              // 文件詳情視圖
              contentLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="w-10 h-10 border-4 border-sakura-500/20 border-t-sakura-500 rounded-full animate-spin"></div>
                </div>
              ) : content ? (
                <div className="prose prose-invert prose-slate max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      code({ className, children, ...props }: any) {
                        const isInline = !className;
                        const match = /language-(\w+)/.exec(className || '');
                        return !isInline && match ? (
                          <SyntaxHighlighter
                            style={vscDarkPlus}
                            language={match[1]}
                            PreTag="div"
                            {...props}
                          >
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        ) : (
                          <code className={className} {...props}>
                            {children}
                          </code>
                        );
                      },
                    }}
                  >
                    {content.content}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="text-center py-20 text-[var(--color-morning-mist)]">
                  <span className="material-icons text-6xl opacity-20 mb-4">description</span>
                  <p>{t('issues.detail.loadFailed')}</p>
                </div>
              )
            )}
          </div>

          {/* Footer */}
          {content && selectedFileId && (
            <div className="flex items-center justify-between p-6 border-t border-white/10 bg-[var(--color-dark-purple)]/20">
              <div className="text-xs text-[var(--color-morning-mist)]">
                {t('issues.detail.lastUpdated', { date: new Date(content.updatedAt).toLocaleString('zh-TW') })}
              </div>
              <button
                onClick={handleBackToList}
                className="sakura-btn px-6 py-2 rounded-xl text-sm font-bold"
              >
                {t('issues.detail.backToList')}
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
