import { useEffect, useMemo, useState } from 'react';
import { useMessages } from '../../hooks/useMessages';
import { useExportSession } from '../../hooks/useSessions';
import { MessageBubble } from './MessageBubble';
import { useI18n } from '../../i18n';
import type { Session, SessionProvider } from '../../types';

interface SessionDetailProps {
  session: Session;
  provider: SessionProvider;
  onBack: () => void;
}

export function SessionDetail({ session, provider, onBack }: SessionDetailProps) {
  const { locale, t } = useI18n();
  const { data: messages, isLoading } = useMessages(session.sessionId, provider);
  const { mutate: exportSession, isPending: isExporting } = useExportSession();
  const [visibleCount, setVisibleCount] = useState(200);

  useEffect(() => {
    setVisibleCount(200);
  }, [session.sessionId]);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleString(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

  const displayableMessages = useMemo(
    () => (messages || []).filter((msg) => (msg.content || '').trim().length > 0),
    [messages]
  );

  const totalMessages = displayableMessages.length;
  const visibleMessages = displayableMessages.slice(Math.max(0, totalMessages - visibleCount));

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Detail Header */}
      <header className="h-20 shrink-0 border-b border-moonlight/5 px-8 flex items-center justify-between bg-background-dark/30 backdrop-blur-md">
        <div className="flex items-center gap-4 min-w-0">
          <button
            onClick={onBack}
            className="lg:hidden text-[var(--color-morning-mist)] hover:text-[var(--color-moonlight)]"
          >
            <span className="material-icons">arrow_back</span>
          </button>
          <div className="min-w-0">
             <h2 className="text-sm font-bold text-[var(--color-moonlight)] tracking-tight truncate">
               {session.customTitle || session.summary || t('sessions.untitled')}
             </h2>
             <div className="flex items-center gap-3 mt-0.5">
                <span className="text-[10px] font-bold text-[var(--color-morning-mist)] uppercase tracking-tighter">
                   {formatDate(session.modifiedAt)}
                </span>
                <span className="w-1 h-1 rounded-full bg-[var(--color-smoke-purple)]"></span>
                <span className="text-[10px] font-bold text-[var(--color-morning-mist)] uppercase tracking-tighter">
                   {t('sessions.messageCount', { count: session.messageCount })}
                </span>
                {session.gitBranch && (
                   <>
                     <span className="w-1 h-1 rounded-full bg-[var(--color-smoke-purple)]"></span>
                     <span className="text-[10px] font-bold text-primary uppercase tracking-tighter flex items-center gap-1">
                        <span className="material-icons text-[12px]">account_tree</span>
                        {session.gitBranch}
                     </span>
                   </>
                )}
             </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
           <button
             onClick={() => exportSession({ sessionId: session.sessionId, provider, format: 'md' })}
             disabled={isExporting || isLoading}
             className="px-4 py-1.5 rounded-full border border-moonlight/10 text-[10px] font-bold text-[var(--color-morning-mist)] hover:text-[var(--color-moonlight)] hover:bg-moonlight/5 transition-all uppercase tracking-widest flex items-center gap-2"
           >
             <span className="material-icons text-sm">download</span>
             {isExporting ? '...' : t('sessions.detail.exportMarkdown')}
           </button>
        </div>
      </header>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-8 py-12 scrollbar-sakura scroll-smooth bg-background-dark/20">
        <div className="max-w-4xl mx-auto w-full">
           {isLoading ? (
             <div className="flex flex-col items-center justify-center py-32 gap-6 opacity-40">
                <div className="w-12 h-12 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-primary/60">{t('sessions.loadingMessages')}</span>
             </div>
           ) : totalMessages > 0 ? (
             <div className="pb-20">
               {totalMessages > visibleCount && (
                 <div className="flex justify-center mb-16 relative">
                    <div className="absolute top-1/2 left-0 right-0 h-px bg-moonlight/5 -z-10"></div>
                    <button
                      onClick={() => setVisibleCount(v => v + 200)}
                      className="px-8 py-2.5 rounded-full bg-surface-dark border border-moonlight/10 text-[10px] font-bold text-[var(--color-morning-mist)] hover:text-[var(--color-moonlight)] hover:border-primary/40 hover:shadow-[0_0_15px_var(--color-sakura-glow)] transition-all uppercase tracking-widest flex items-center gap-3"
                    >
                      <span className="material-icons text-sm">history</span>
                      {t('sessions.detail.loadPrevious')}
                    </button>
                 </div>
               )}
               {visibleMessages.map((msg) => (
                 <MessageBubble key={msg.messageUuid} message={msg} />
               ))}
             </div>
           ) : (
             <div className="flex flex-col items-center justify-center py-24 opacity-30">
                <span className="material-icons text-6xl mb-4">comments_disabled</span>
                <span className="text-sm font-bold tracking-widest uppercase">{t('sessions.noMessages')}</span>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
