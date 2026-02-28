/**
 * SessionList 組件
 * 顯示會話列表，支持虛擬滾動
 */

import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';
import { SessionCard } from './SessionCard';
import type { Session } from '../../types';
import { useI18n } from '../../i18n';

interface SessionListProps {
  sessions: Session[];
  selectedSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
}

export function SessionList({ sessions, selectedSessionId, onSelectSession }: SessionListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const { t } = useI18n();

  const virtualizer = useVirtualizer({
    count: sessions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120, // Adjusted for new design
    overscan: 5,
  });

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-6">
        <span className="material-icons text-4xl text-[var(--color-cloud-mist)] mb-4">history_toggle_off</span>
        <h3 className="text-sm font-bold text-[var(--color-morning-mist)] uppercase tracking-widest mb-1">{t('sessions.empty.title')}</h3>
        <p className="text-xs text-[var(--color-cloud-mist)]">{t('sessions.empty.description')}</p>
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className="h-full overflow-y-auto p-3 scrollbar-none"
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const session = sessions[virtualRow.index];
          if (!session) return null;

          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
                paddingBottom: '8px'
              }}
            >
              <SessionCard
                session={session}
                isActive={selectedSessionId === session.sessionId}
                onSelect={onSelectSession}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
