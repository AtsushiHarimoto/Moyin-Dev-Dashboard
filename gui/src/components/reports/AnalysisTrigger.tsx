import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../../i18n';
import { useStartAnalysis } from '../../hooks/useAnalysis';
import { useAnalysisStore, selectIsRunning } from '../../stores/useAnalysisStore';
import { DOMAIN_PRESETS } from '../../constants/domainPresets';
import { useKeywordPresets, useKeywordRefreshStatus, useRefreshKeywords } from '../../hooks/useKeywords';
import type { KeywordPreset } from '../../utils/api';

const DAY_OPTIONS = [7, 30, 60, 120, 360];

/** Map API preset to the shape used by this component */
interface PresetView {
  label: string;
  labelKey: string | null;
  descriptionKey: string | null;
  icon: string;
  keywords: string;
  seedCount: number;
  discoveredCount: number;
}

function apiToView(p: KeywordPreset): PresetView {
  return {
    label: p.category,
    labelKey: p.labelKey,
    descriptionKey: p.descriptionKey,
    icon: p.icon,
    keywords: p.mergedKeywords || p.seedKeywords,
    seedCount: p.seedCount,
    discoveredCount: p.discoveredCount,
  };
}

function staticToView(p: (typeof DOMAIN_PRESETS)[number]): PresetView {
  return {
    label: p.label ?? p.labelKey ?? '',
    labelKey: p.labelKey ?? null,
    descriptionKey: p.descriptionKey ?? null,
    icon: p.icon,
    keywords: p.keywords,
    seedCount: 0,
    discoveredCount: 0,
  };
}

// ── Keyword List Dialog ──────────────────────────────────────────────────────

/** Split a comma-separated string into a trimmed, non-empty list. */
function splitKeywords(csv: string | undefined): string[] {
  if (!csv) return [];
  return csv.split(',').map((k) => k.trim()).filter(Boolean);
}

interface KeywordListDialogProps {
  preset: KeywordPreset;
  t: (key: string, params?: Record<string, string | number>) => string;
  onClose: () => void;
}

function KeywordListDialog({ preset, t, onClose }: KeywordListDialogProps) {
  const seedList = splitKeywords(preset.seedKeywords);
  const discoveredList = splitKeywords(preset.discoveredKeywords);
  const scoreMap = new Map(
    (preset.discoverScores ?? []).map((s) => [s.keyword, s.score]),
  );
  const dialogRef = useRef<HTMLDivElement>(null);

  // Escape key to close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Auto-focus dialog for accessibility
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const isEmpty = seedList.length === 0 && discoveredList.length === 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: 'spring', damping: 20 }}
        className="glass-card rounded-2xl w-full max-w-lg max-h-[70vh] overflow-hidden flex flex-col outline-none"
        onClick={(e) => e.stopPropagation()}
      >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <h3
              className="text-sm font-bold flex items-center gap-2"
              style={{ color: 'var(--color-moonlight)', fontFamily: 'var(--font-serif)' }}
            >
              <span>{preset.icon}</span>
              <span>{preset.category} — {t('analysis.keywords.dialog.title')}</span>
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10"
              style={{ color: 'var(--color-morning-mist)' }}
            >
              <span className="material-icons text-[18px]">close</span>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto scrollbar-sakura px-5 py-4 space-y-5">
            {isEmpty ? (
              <p className="text-xs text-center py-6" style={{ color: 'var(--color-cloud-mist)' }}>
                {t('analysis.keywords.dialog.empty')}
              </p>
            ) : (
              <>
                {/* Seed Keywords */}
                {seedList.length > 0 && (
                  <div>
                    <h4
                      className="text-xs font-semibold mb-2 flex items-center gap-1.5"
                      style={{ color: 'var(--color-morning-mist)' }}
                    >
                      <span>🌱</span>
                      {t('analysis.keywords.dialog.seed')}
                      <span className="text-[10px] opacity-70">({seedList.length})</span>
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {seedList.map((kw) => (
                        <span
                          key={kw}
                          className="px-2 py-0.5 rounded-full text-[11px]"
                          style={{
                            background: 'var(--color-smoke-purple)',
                            border: '1px solid var(--color-glass-border)',
                            color: 'var(--color-moonlight)',
                          }}
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI Discovered */}
                {discoveredList.length > 0 && (
                  <div>
                    <h4
                      className="text-xs font-semibold mb-2 flex items-center gap-1.5"
                      style={{ color: 'var(--color-morning-mist)' }}
                    >
                      <span>🔍</span>
                      {t('analysis.keywords.dialog.discovered')}
                      <span className="text-[10px] opacity-70">({discoveredList.length})</span>
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {discoveredList.map((kw) => {
                        const score = scoreMap.get(kw);
                        return (
                          <span
                            key={kw}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px]"
                            style={{
                              background: 'var(--color-smoke-purple)',
                              border: '1px solid var(--color-glass-border)',
                              color: 'var(--color-moonlight)',
                            }}
                          >
                            {kw}
                            {score != null && (
                              <span
                                className="text-[9px] px-1 rounded"
                                style={{
                                  background: 'rgba(255,255,255,0.1)',
                                  color: 'var(--color-morning-mist)',
                                }}
                              >
                                {score.toFixed(1)}
                              </span>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
      </motion.div>
    </motion.div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export function AnalysisTrigger() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { data: apiPresets } = useKeywordPresets();
  const { data: refreshJob } = useKeywordRefreshStatus();
  const { mutate: refreshKeywords, isPending: isRefreshStarting } = useRefreshKeywords();
  const { mutate: startAnalysis, isPending } = useStartAnalysis();
  const isRunning = useAnalysisStore(selectIsRunning);
  const batchProgress = useAnalysisStore((s) => s.batchProgress);
  const isBatchRunning = batchProgress?.status === 'running';

  // Use API presets when available, fallback to static
  const presets: PresetView[] = useMemo(() => {
    if (apiPresets && apiPresets.length > 0) return apiPresets.map(apiToView);
    return DOMAIN_PRESETS.map(staticToView);
  }, [apiPresets]);

  // Use label as stable identifier instead of numeric index
  // null = custom mode
  const [activeLabel, setActiveLabel] = useState<string | null>(() =>
    presets.length > 0 ? presets[0].label : null,
  );
  const [keywords, setKeywords] = useState('');
  const [days, setDays] = useState(7);
  const [dialogOpen, setDialogOpen] = useState(false);

  const isCustom = activeLabel === null;
  const activePreset = isCustom ? null : presets.find((p) => p.label === activeLabel) ?? null;

  // Full KeywordPreset for dialog (has seedKeywords, discoveredKeywords, discoverScores)
  const activeFullPreset = useMemo(() => {
    if (!activePreset || !apiPresets) return null;
    return apiPresets.find((p) => p.category === activePreset.label) ?? null;
  }, [activePreset, apiPresets]);

  // Sync keywords when presets update (e.g. after refresh) or active preset changes
  useEffect(() => {
    if (activePreset) {
      setKeywords(activePreset.keywords);
    }
  }, [activePreset?.keywords]); // eslint-disable-line react-hooks/exhaustive-deps

  const disabled = isRunning || isPending || isBatchRunning;
  const isKeywordRefreshRunning = refreshJob?.status === 'queued' || refreshJob?.status === 'running';
  const isTerminalJob = refreshJob?.status === 'completed' || refreshJob?.status === 'failed';
  const terminalAge = isTerminalJob && refreshJob?.completedAt
    ? Date.now() - Date.parse(refreshJob.completedAt)
    : 0;
  const showRefreshPanel = refreshJob && (!isTerminalJob || terminalAge < 30_000);
  const refreshButtonBusy = isRefreshStarting || isKeywordRefreshRunning;
  const refreshProgress = refreshJob?.progress ?? 0;
  const refreshTotalText = refreshJob ? (refreshJob.total > 0 ? String(refreshJob.total) : '—') : '0';
  const refreshSummaryText = refreshJob
    ? `${refreshJob.completed}/${refreshTotalText}  ✓${refreshJob.succeeded}  ✕${refreshJob.failed}`
    : '';
  const refreshJobHandledRef = useRef<string | null>(null);

  const keywordsInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (isCustom) keywordsInputRef.current?.focus();
  }, [isCustom]);

  useEffect(() => {
    if (!refreshJob) return;
    const isTerminal = refreshJob.status === 'completed' || refreshJob.status === 'failed';
    if (!isTerminal) return;
    if (refreshJobHandledRef.current === refreshJob.id) return;
    refreshJobHandledRef.current = refreshJob.id;

    if (refreshJob.status === 'completed') {
      void queryClient.invalidateQueries({ queryKey: ['keyword-presets'] });
    }
  }, [refreshJob, queryClient]);

  const handleStart = () => {
    if (disabled) return;
    const label = activePreset?.label ?? '';
    startAnalysis({ keywords, days, label });
  };

  const handlePreset = (preset: PresetView) => {
    setActiveLabel(preset.label);
    setKeywords(preset.keywords);
  };

  const handleCustom = () => {
    setActiveLabel(null);
    setKeywords('');
  };

  const presetBtnStyle = (isActive: boolean): React.CSSProperties => ({
    background: isActive ? 'var(--color-sakura-gradient)' : 'var(--color-smoke-purple)',
    border: `1px solid ${isActive ? 'transparent' : 'var(--color-glass-border)'}`,
    color: isActive ? 'var(--color-moonlight)' : 'var(--color-morning-mist)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    boxShadow: isActive ? '0 0 8px var(--color-sakura-glow)' : 'none',
    opacity: disabled ? 0.5 : 1,
  });

  return (
    <div
      className="rounded-xl p-5 mb-6"
      style={{
        background: 'var(--color-glass-bg)',
        border: '1px solid var(--color-glass-border)',
      }}
    >
      {/* Header + Refresh button */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">🔮</span>
          <h3
            className="text-base font-bold"
            style={{ color: 'var(--color-moonlight)', fontFamily: 'var(--font-serif)' }}
          >
            {t('analysis.title')}
          </h3>
        </div>
        <button
          type="button"
          onClick={() => refreshKeywords({ useAi: true })}
          disabled={refreshButtonBusy || disabled}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold transition-all"
          style={{
            background: 'var(--color-smoke-purple)',
            border: '1px solid var(--color-glass-border)',
            color: refreshButtonBusy ? 'var(--color-cloud-mist)' : 'var(--color-morning-mist)',
            cursor: refreshButtonBusy || disabled ? 'not-allowed' : 'pointer',
            opacity: refreshButtonBusy ? 0.6 : 1,
          }}
          title={t('analysis.refreshTrending')}
        >
          <span
            className="material-icons text-[14px]"
            style={refreshButtonBusy ? { animation: 'spin 1s linear infinite' } : undefined}
          >
            autorenew
          </span>
          {refreshButtonBusy ? t('analysis.refreshing') : t('analysis.refreshTrending')}
        </button>
      </div>

      {showRefreshPanel && (
        <div
          className="mb-4 rounded-lg p-3"
          style={{
            background: 'color-mix(in srgb, var(--color-smoke-purple) 70%, transparent)',
            border: '1px solid var(--color-glass-border)',
          }}
        >
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="text-[11px] font-semibold" style={{ color: 'var(--color-moonlight)' }}>
              {refreshJob.status === 'queued' && t('analysis.refreshJob.queued')}
              {refreshJob.status === 'running' && t('analysis.refreshJob.running')}
              {refreshJob.status === 'completed' && t('analysis.refreshJob.completed')}
              {refreshJob.status === 'failed' && t('analysis.refreshJob.failed')}
            </div>
            <div className="text-[10px] font-mono" style={{ color: 'var(--color-morning-mist)' }}>
              {refreshSummaryText}
            </div>
          </div>

          <div
            className="h-1.5 rounded-full overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.08)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${refreshProgress}%`,
                background: 'linear-gradient(90deg, var(--color-sakura-pink), var(--color-petal-pink))',
                boxShadow: '0 0 10px var(--color-sakura-glow)',
              }}
            />
          </div>

          <div className="mt-2 flex items-center justify-between gap-3 text-[10px]">
            <div style={{ color: 'var(--color-cloud-mist)' }}>
              {refreshJob.currentCategory
                ? `${t('analysis.refreshJob.current')}: ${refreshJob.currentCategory}`
                : refreshJob.message}
            </div>
            <div style={{ color: 'var(--color-morning-mist)' }}>{refreshProgress}%</div>
          </div>

          {refreshJob.error && refreshJob.status === 'failed' && (
            <div className="mt-2 text-[10px]" style={{ color: '#ffb8c8' }}>
              {refreshJob.error}
            </div>
          )}
        </div>
      )}

      {/* Domain Presets + Custom */}
      <div className="flex flex-wrap gap-2 mb-3">
        {presets.map((preset) => (
          <button
            key={preset.labelKey ?? preset.label}
            type="button"
            onClick={() => handlePreset(preset)}
            disabled={disabled}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={presetBtnStyle(activeLabel === preset.label)}
          >
            {preset.icon} {preset.labelKey ? t(preset.labelKey) : preset.label}
            {preset.discoveredCount > 0 && (
              <span
                className="ml-1 px-1 py-0.5 rounded text-[9px]"
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  verticalAlign: 'super',
                }}
              >
                +{preset.discoveredCount}
              </span>
            )}
          </button>
        ))}
        <button
          type="button"
          onClick={handleCustom}
          disabled={disabled}
          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={presetBtnStyle(isCustom)}
        >
          ✏️ {t('analysis.custom')}
        </button>
      </div>

      {/* Active preset description + keyword count */}
      {activePreset && (
        <div className="flex items-center gap-3 mb-3 pl-1">
          {activePreset.descriptionKey && (
            <p className="text-xs" style={{ color: 'var(--color-cloud-mist)' }}>
              {t(activePreset.descriptionKey)}
            </p>
          )}
          {(activePreset.seedCount > 0 || activePreset.discoveredCount > 0) && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap"
              style={{
                background: 'var(--color-smoke-purple)',
                color: 'var(--color-morning-mist)',
                border: '1px solid var(--color-glass-border)',
              }}
            >
              {t('analysis.keywordCount', {
                seed: activePreset.seedCount,
                discovered: activePreset.discoveredCount,
              })}
            </span>
          )}
        </div>
      )}

      {/* Input Row */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="flex items-center gap-1.5 text-xs mb-1" style={{ color: 'var(--color-morning-mist)' }}>
            {t('analysis.keywords')}
            {activePreset && (activePreset.seedCount + activePreset.discoveredCount) > 0 && (
              <button
                type="button"
                onClick={() => setDialogOpen(true)}
                className="inline-flex items-center gap-0.5 px-1.5 py-0 rounded-full text-[10px] font-medium transition-all hover:brightness-125"
                style={{
                  background: 'var(--color-smoke-purple)',
                  border: '1px solid var(--color-glass-border)',
                  color: 'var(--color-morning-mist)',
                  cursor: 'pointer',
                  lineHeight: '1.6',
                }}
              >
                {activePreset.seedCount + activePreset.discoveredCount} ↗
              </button>
            )}
          </label>
          <input
            type="text"
            value={keywords}
            onChange={(e) => {
              setKeywords(e.target.value);
              if (!isCustom) {
                if (!activePreset || e.target.value !== activePreset.keywords) {
                  setActiveLabel(null);
                }
              }
            }}
            disabled={disabled}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors"
            style={{
              background: 'var(--color-smoke-purple)',
              border: '1px solid var(--color-glass-border)',
              color: 'var(--color-moonlight)',
            }}
            placeholder={isCustom ? t('analysis.placeholder.custom') : t('analysis.placeholder.default')}
            ref={keywordsInputRef}
          />
        </div>

        <div className="w-28">
          <label className="block text-xs mb-1" style={{ color: 'var(--color-morning-mist)' }}>
            {t('analysis.days')}
          </label>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            disabled={disabled}
            className="w-full pl-3 pr-7 py-2 rounded-lg text-sm outline-none"
            style={{
              appearance: 'none',
              background: `var(--color-smoke-purple) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23a78bfa'/%3E%3C/svg%3E") no-repeat right 10px center`,
              border: '1px solid var(--color-glass-border)',
              color: 'var(--color-moonlight)',
            }}
          >
            {DAY_OPTIONS.map((d) => (
              <option key={d} value={d}>{t('analysis.dayUnit', { count: d })}</option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={handleStart}
          disabled={disabled}
          className="px-5 py-2 rounded-lg text-sm font-medium transition-all"
          style={{
            background: disabled ? 'var(--color-mist-purple)' : 'var(--color-sakura-gradient)',
            color: disabled ? 'var(--color-cloud-mist)' : 'var(--color-moonlight)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            boxShadow: disabled ? 'none' : '0 0 12px var(--color-sakura-glow)',
          }}
          title={isRunning ? t('analysis.runningTitle') : t('analysis.startTitle')}
        >
          {isRunning ? t('analysis.running') : t('analysis.start')}
        </button>
      </div>

      {/* Keyword List Dialog */}
      <AnimatePresence>
        {dialogOpen && activeFullPreset && (
          <KeywordListDialog
            preset={activeFullPreset}
            t={t}
            onClose={() => setDialogOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
