import { useI18n } from '../../i18n';
import type { Session } from '../../types';
import clsx from 'clsx';
import { motion } from 'framer-motion';

interface SessionCardProps {
  session: Session;
  isActive: boolean;
  onSelect: (sessionId: string) => void;
}

export function SessionCard({ session, isActive, onSelect }: SessionCardProps) {
  const { locale, t } = useI18n();

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
        return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false });
    }
    return date.toLocaleDateString(locale, { month: '2-digit', day: '2-digit' });
  };

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onSelect(session.sessionId)}
      className={clsx(
        "group relative p-4 rounded-2xl border transition-all duration-300 cursor-pointer",
        isActive
            ? "border-primary/50 bg-primary/5 shadow-[0_0_15px_-3px_var(--color-sakura-glow)]"
            : "border-moonlight/5 bg-moonlight/[0.02] hover:bg-moonlight/[0.05] hover:border-moonlight/10"
      )}
    >
      <div className="flex justify-between items-start mb-1.5">
        <h3 className={clsx(
            "font-bold text-sm truncate pr-2 tracking-tight transition-colors",
            isActive ? "text-[var(--color-moonlight)]" : "text-[var(--color-moonlight)] group-hover:text-[var(--color-moonlight)]"
        )}>
          {session.customTitle || session.summary || t('sessions.untitled')}
        </h3>
        <span className={clsx(
            "text-[10px] font-bold shrink-0 uppercase tracking-tighter",
            isActive ? "text-primary" : "text-[var(--color-morning-mist)]"
        )}>
          {formatDate(session.modifiedAt)}
        </span>
      </div>

      <p className={clsx(
          "text-[11px] line-clamp-2 mb-3 leading-relaxed transition-colors",
          isActive ? "text-[var(--color-moonlight)]" : "text-[var(--color-morning-mist)] group-hover:text-[var(--color-morning-mist)]"
      )}>
        {session.firstPrompt || ''}
      </p>

      <div className="flex items-center gap-2">
        <span className={clsx(
            "px-1.5 py-0.5 rounded text-[10px] font-bold border",
            isActive
                ? "bg-primary/20 text-primary border-primary/20"
                : "bg-moonlight/5 text-[var(--color-morning-mist)] border-moonlight/5"
        )}>
          {session.provider?.toUpperCase() || 'CLAUDE'}
        </span>
        <span className="text-[10px] font-bold text-[var(--color-cloud-mist)]">
           {t('sessions.messageCount', { count: session.messageCount })}
        </span>

        {isActive && (
           <span className="material-icons text-primary text-[16px] ml-auto animate-pulse">arrow_forward</span>
        )}
      </div>
    </motion.div>
  );
}
