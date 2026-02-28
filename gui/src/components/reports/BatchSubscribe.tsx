import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useI18n } from '../../i18n';
import { useStartBatchAnalysis, useCancelBatchAnalysis, useEmailStatus } from '../../hooks/useAnalysis';
import { useAnalysisStore, selectIsRunning } from '../../stores/useAnalysisStore';
import { DOMAIN_PRESETS } from '../../constants/domainPresets';
import { useKeywordPresets } from '../../hooks/useKeywords';
import type { KeywordPreset } from '../../utils/api';

interface PresetView {
  label: string;
  icon: string;
  keywords: string;
}

export function BatchSubscribe() {
  const { t } = useI18n();
  const { data: apiPresets } = useKeywordPresets();
  const { data: emailStatus } = useEmailStatus();
  const { mutate: startBatch, isPending } = useStartBatchAnalysis();
  const { mutate: cancelBatch } = useCancelBatchAnalysis();
  const isSingleRunning = useAnalysisStore(selectIsRunning);
  const batchProgress = useAnalysisStore((s) => s.batchProgress);

  // Use API data or fallback to static
  const presets: PresetView[] = useMemo(() => {
    if (apiPresets && apiPresets.length > 0) {
      return apiPresets.map((p: KeywordPreset) => ({
        label: p.category,
        icon: p.icon,
        keywords: p.mergedKeywords || p.seedKeywords,
      }));
    }
    return DOMAIN_PRESETS.map(p => ({
      label: p.label!,
      icon: p.icon,
      keywords: p.keywords,
    }));
  }, [apiPresets]);

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(presets.map((p) => p.label)),
  );

  // Sync selection when presets change (e.g. API loads after static fallback)
  const prevPresetsRef = useRef(presets);
  useEffect(() => {
    if (prevPresetsRef.current !== presets) {
      setSelected(new Set(presets.map((p) => p.label)));
      prevPresetsRef.current = presets;
    }
  }, [presets]);

  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const [focusedLabel, setFocusedLabel] = useState<string | null>(null);

  const isBatchRunning = batchProgress?.status === 'running';
  const disabled = isSingleRunning || isPending;
  const allSelected = selected.size === presets.length;
  const noneSelected = selected.size === 0;

  const togglePreset = useCallback((label: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected(allSelected ? new Set() : new Set(presets.map((p) => p.label)));
  }, [allSelected, presets]);

  const handleStart = () => {
    if (disabled || isBatchRunning || noneSelected) return;
    const batchPresets = presets
      .filter((p) => selected.has(p.label))
      .map((p) => ({ label: p.label, keywords: p.keywords }));
    startBatch({ presets: batchPresets, days: 7 });
  };

  const getItemStatus = (label: string) => {
    if (!batchProgress) return null;
    const result = batchProgress.results.find((r) => r.label === label);
    if (result) {
      return result.status === 'completed'
        ? (result.emailed ? '\u2705' : '\u2611\uFE0F')
        : '\u274C';
    }
    if (batchProgress.currentLabel === label) return '\uD83D\uDD04';
    return '\u23F3';
  };

  const getItemText = (label: string) => {
    if (!batchProgress) return '';
    const result = batchProgress.results.find((r) => r.label === label);
    if (result) {
      if (result.status === 'completed') return result.emailed ? t('analysis.batch.doneEmailed') : t('analysis.batch.done');
      return t('analysis.batch.failed');
    }
    if (batchProgress.currentLabel === label) return t('analysis.batch.analyzing');
    return t('analysis.batch.waiting');
  };

  return (
    <div
      className="rounded-xl p-5 mb-6"
      style={{
        background: 'var(--color-glass-bg)',
        border: '1px solid var(--color-glass-border)',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">{'\uD83D\uDCEC'}</span>
        <h3 className="text-base font-bold" style={{ color: 'var(--color-moonlight)', fontFamily: 'var(--font-serif)' }}>
          {t('analysis.batch.title')}
        </h3>
      </div>

      <p className="text-xs mb-3" style={{ color: 'var(--color-cloud-mist)' }}>
        {t('analysis.batch.description')}
      </p>

      {/* Email status */}
      {emailStatus && (
        <div className="text-xs mb-4" style={{ color: emailStatus.configured ? 'var(--color-sakura-pink)' : 'var(--color-cloud-mist)' }}>
          {emailStatus.configured
            ? `\u2705 Gmail: ${emailStatus.from} \u2192 ${emailStatus.to}`
            : `\u274C ${t('analysis.batch.emailNotConfigured')}`}
        </div>
      )}

      {/* Category selection + Start button, or progress */}
      {!isBatchRunning ? (
        <div className="space-y-3">
          {/* Select all / deselect all */}
          <div className="flex flex-wrap items-center justify-between gap-1">
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs"
              style={{
                color: 'var(--color-morning-mist)',
                cursor: 'pointer',
                background: 'var(--color-mist-purple)',
                border: '1px solid var(--color-glass-border)',
                borderRadius: '9999px',
                padding: '2px 10px',
              }}
            >
              {allSelected ? t('analysis.batch.deselectAll') : t('analysis.batch.selectAll')}
            </button>
            <span
              className="text-xs"
              style={{
                color: 'var(--color-cloud-mist)',
                background: 'var(--color-smoke-purple)',
                borderRadius: '6px',
                padding: '1px 8px',
              }}
            >
              {selected.size}/{presets.length}
            </span>
          </div>

          {/* Preset checkboxes — flex wrap capsules */}
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => {
              const isChecked = selected.has(preset.label);
              const isHovered = hoveredLabel === preset.label;
              const isFocused = focusedLabel === preset.label;
              return (
                <label
                  key={preset.label}
                  className="inline-flex items-center gap-1.5 py-1.5 px-3 text-xs cursor-pointer"
                  style={{
                    borderRadius: '9999px',
                    maxWidth: '100%',
                    background: isChecked
                      ? 'var(--color-smoke-purple)'
                      : isHovered ? 'var(--color-mist-purple)' : 'transparent',
                    border: isChecked
                      ? '1px solid var(--color-sakura-pink)'
                      : '1px solid var(--color-glass-border)',
                    boxShadow: isChecked ? '0 0 8px var(--color-sakura-glow)' : 'none',
                    transition: 'all var(--duration-normal) var(--ease-out)',
                  }}
                  onMouseEnter={() => setHoveredLabel(preset.label)}
                  onMouseLeave={() => setHoveredLabel(null)}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => togglePreset(preset.label)}
                    className="sr-only"
                    onFocus={() => setFocusedLabel(preset.label)}
                    onBlur={() => setFocusedLabel(null)}
                  />
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 14,
                      height: 14,
                      minWidth: 14,
                      borderRadius: '50%',
                      border: isChecked ? 'none' : `1.5px solid ${isHovered ? 'var(--color-sakura-pink)' : 'var(--color-glass-border)'}`,
                      background: isChecked ? 'var(--color-sakura-gradient)' : 'transparent',
                      outline: isFocused ? '2px solid var(--color-sakura-pink)' : 'none',
                      outlineOffset: isFocused ? 1 : 0,
                      transition: 'all var(--duration-normal) var(--ease-out)',
                      color: 'var(--color-moonlight)',
                    }}
                  >
                    {isChecked && (
                      <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5L4.5 7.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <span style={{ color: isChecked ? 'var(--color-moonlight)' : 'var(--color-cloud-mist)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {preset.icon} {preset.label}
                  </span>
                </label>
              );
            })}
          </div>

          {/* Start button */}
          <button
            type="button"
            onClick={handleStart}
            disabled={disabled || !emailStatus?.configured || noneSelected}
            className="px-5 py-2.5 rounded-lg text-sm font-medium transition-all w-full"
            style={{
              background: (disabled || !emailStatus?.configured || noneSelected) ? 'var(--color-mist-purple)' : 'var(--color-sakura-gradient)',
              color: (disabled || !emailStatus?.configured || noneSelected) ? 'var(--color-cloud-mist)' : 'var(--color-moonlight)',
              cursor: (disabled || !emailStatus?.configured || noneSelected) ? 'not-allowed' : 'pointer',
              boxShadow: (disabled || !emailStatus?.configured || noneSelected) ? 'none' : '0 0 12px var(--color-sakura-glow)',
            }}
          >
            {'\uD83D\uDE80'} {t('analysis.batch.start')} ({selected.size})
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Progress list — only selected presets */}
          {presets.filter((p) => selected.has(p.label)).map((preset) => (
            <div
              key={preset.label}
              className="flex items-center justify-between py-1.5 px-3 rounded-lg text-xs"
              style={{ background: 'var(--color-smoke-purple)' }}
            >
              <span style={{ color: 'var(--color-moonlight)' }}>
                {preset.icon} {preset.label}
              </span>
              <span style={{ color: 'var(--color-morning-mist)' }}>
                {getItemStatus(preset.label)} {getItemText(preset.label)}
              </span>
            </div>
          ))}

          {/* Progress bar */}
          <div className="flex items-center justify-between text-xs mt-2" style={{ color: 'var(--color-cloud-mist)' }}>
            <span>{batchProgress.current}/{batchProgress.total}</span>
            <button
              type="button"
              onClick={() => cancelBatch()}
              className="text-xs underline"
              style={{ color: 'var(--color-morning-mist)' }}
            >
              {t('analysis.batch.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
