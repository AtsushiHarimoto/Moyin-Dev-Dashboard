import { useI18n } from '../../i18n';
import clsx from 'clsx';

export type HistoryProvider = 'claude' | 'codex';

interface HistoryTabsProps {
  activeProvider: HistoryProvider;
  onChange: (provider: HistoryProvider) => void;
}

const providers: Array<{ id: HistoryProvider; labelKey: string }> = [
  { id: 'claude', labelKey: 'sessions.tabs.claude' },
  { id: 'codex', labelKey: 'sessions.tabs.codex' },
];

export function HistoryTabs({ activeProvider, onChange }: HistoryTabsProps) {
  const { t } = useI18n();

  return (
    <div className="flex items-center gap-1.5 p-1 px-1.5 rounded-full glass-panel border border-moonlight/10 w-fit">
      {providers.map((provider) => {
        const active = provider.id === activeProvider;
        return (
          <button
            key={provider.id}
            onClick={() => onChange(provider.id)}
            className={clsx(
                "px-4 py-1.5 text-[11px] font-bold tracking-widest uppercase rounded-full transition-all duration-300",
                active
                    ? "bg-primary text-[var(--color-moonlight)] shadow-[0_0_12px_var(--color-sakura-glow)]"
                    : "text-cloud-mist hover:text-[var(--color-moonlight)]"
            )}
          >
            {t(provider.labelKey)}
          </button>
        );
      })}
    </div>
  );
}
