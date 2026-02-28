import { useEffect, useMemo, useState, useCallback, useRef, memo, type ReactNode } from 'react';
import { formatSize, downloadBlob, contentToHtml } from './reportUtils';
import ReactMarkdown, { type Components } from 'react-markdown';
import { useI18n } from '../../i18n';
import { useReportDetail, useReports, useMarkReportAsRead, useDeleteReport } from '../../hooks/useReports';
import { toast } from '../common/Toast';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { AnalysisTrigger } from './AnalysisTrigger';
import { BatchSubscribe } from './BatchSubscribe';
import { TechRadar, insightsToTrendItems } from './TechRadar';
import { DOMAIN_PRESETS } from '../../constants/domainPresets';
import { useCustomCategoryStore } from '../../stores/useCustomCategoryStore';
import { useAnalysisStore } from '../../stores/useAnalysisStore';
import { useKeywordPresets, useCreateKeywordPreset, useDeleteKeywordPreset } from '../../hooks/useKeywords';
import type { KeywordPreset } from '../../utils/api';
import type { ReportItem } from '../../types';

/* ── Brand colors ── */
const BRAND = {
  bgDeep: 'var(--color-twilight-purple)',
  bgMain: 'var(--color-mist-purple)',
  bgCard: 'var(--color-smoke-purple)',
  bgHover: 'var(--color-cloud-mist)',
  sakuraPink: 'var(--color-petal-pink)',
  petalPink: 'var(--color-morning-mist)',
  moonlight: 'var(--color-moonlight)',
  morningMist: 'var(--color-morning-mist)',
  cloudMist: 'var(--color-cloud-mist)',
  successGreen: '#b8e6cf',
  warningAmber: '#ffe4b8',
  errorPink: '#ffb8c8',
  infoBlue: '#b8d8ff',
} as const;

const RING_COLORS: Record<string, string> = {
  adopt: BRAND.successGreen,
  trial: BRAND.infoBlue,
  assess: BRAND.warningAmber,
  hold: BRAND.errorPink,
};

const QUADRANT_NAMES = ['tools', 'techniques', 'platforms', 'languages', 'languages-and-frameworks', 'languages & frameworks'];

/* ── Helpers for branded inline code ── */
function renderBrandedCode(text: string): ReactNode {
  const lower = text.toLowerCase();

  // Ring name
  const ringColor = RING_COLORS[lower];
  if (ringColor) {
    return (
      <span
        className="inline-block px-2 py-0.5 rounded text-xs font-bold"
        style={{ background: `${ringColor}26`, color: ringColor }}
      >
        {text}
      </span>
    );
  }

  // Quadrant name
  if (QUADRANT_NAMES.includes(lower)) {
    return (
      <span
        className="inline-block px-2 py-0.5 rounded text-xs font-bold"
        style={{ background: BRAND.bgCard, color: BRAND.morningMist }}
      >
        {text}
      </span>
    );
  }

  // Trend arrows
  if (['↑', '→', '↓', 'up', 'stable', 'down'].includes(lower)) {
    let arrowColor: string = BRAND.morningMist;
    if (lower === '↑' || lower === 'up') arrowColor = BRAND.successGreen;
    else if (lower === '↓' || lower === 'down') arrowColor = BRAND.errorPink;
    return (
      <span className="inline-block px-1.5 py-0.5 rounded text-xs font-bold" style={{ color: arrowColor }}>
        {text}
      </span>
    );
  }

  return null;
}

/* ── Highlight labels in bold text ── */
const HIGHLIGHT_LABELS = ['信號', '證據', '風險', '下一步', 'Signal', 'Evidence', 'Risk', 'Next Step'];

function isHighlightLabel(text: string): boolean {
  return HIGHLIGHT_LABELS.some(label => text.startsWith(label));
}

/* ── Branded Markdown components ── */
const brandedMarkdownComponents: Components = {
  h1: ({ children }) => (
    <h1
      className="text-2xl font-bold mb-4 mt-8"
      style={{ color: BRAND.moonlight, fontFamily: 'var(--font-serif, "Playfair Display", "Noto Serif TC", serif)' }}
    >
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2
      className="text-xl font-bold mb-3 mt-6 pl-3"
      style={{
        color: BRAND.moonlight,
        borderLeft: `2px solid ${BRAND.sakuraPink}`,
        paddingLeft: '12px',
        fontFamily: 'var(--font-serif, "Playfair Display", "Noto Serif TC", serif)',
      }}
    >
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3
      className="text-lg font-bold mb-2 mt-5"
      style={{ color: BRAND.moonlight, fontFamily: 'var(--font-serif, "Playfair Display", "Noto Serif TC", serif)' }}
    >
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4
      className="text-base font-bold mb-2 mt-4"
      style={{ color: BRAND.morningMist }}
    >
      {children}
    </h4>
  ),
  p: ({ children }) => (
    <p className="text-sm leading-relaxed mb-3" style={{ color: BRAND.morningMist }}>
      {children}
    </p>
  ),
  code: ({ children, className }) => {
    const isBlock = className?.includes('language-');
    const text = String(children).replace(/\n$/, '');

    if (isBlock) {
      return (
        <code className={className} style={{ background: BRAND.bgDeep }}>
          {children}
        </code>
      );
    }

    // Try branded rendering first
    const branded = renderBrandedCode(text);
    if (branded) return branded;

    // Default inline code
    return (
      <code
        className="inline-block px-1.5 py-0.5 rounded text-xs font-mono"
        style={{ background: BRAND.bgDeep, color: BRAND.sakuraPink }}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre
      className="rounded-lg p-4 overflow-x-auto text-sm mb-4"
      style={{ background: BRAND.bgDeep, border: `1px solid ${BRAND.bgHover}` }}
    >
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote
      className="pl-4 my-4 italic"
      style={{ borderLeft: `3px solid ${BRAND.sakuraPink}`, color: BRAND.morningMist }}
    >
      {children}
    </blockquote>
  ),
  strong: ({ children }) => {
    const text = String(children);
    if (isHighlightLabel(text)) {
      // Remove trailing colon for the label display
      const label = text.replace(/:$/, '');
      return (
        <strong
          className="inline-block px-2 py-0.5 rounded text-xs font-bold mr-1"
          style={{ background: `${BRAND.sakuraPink}1a`, color: BRAND.sakuraPink }}
        >
          {label}:
        </strong>
      );
    }
    return <strong style={{ color: BRAND.moonlight }}>{children}</strong>;
  },
  ul: ({ children }) => (
    <ul className="list-disc pl-5 mb-3 space-y-1" style={{ color: BRAND.morningMist }}>
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-5 mb-3 space-y-1" style={{ color: BRAND.morningMist }}>
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="text-sm leading-relaxed" style={{ color: BRAND.morningMist }}>
      {children}
    </li>
  ),
  a: ({ href, children }) => (
    <a href={href} className="underline transition-colors" style={{ color: BRAND.sakuraPink }} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  hr: () => (
    <hr className="my-6 border-0 h-px" style={{ background: `linear-gradient(to right, ${BRAND.bgHover}, transparent)` }} />
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto mb-4">
      <table className="w-full text-sm border-collapse" style={{ color: BRAND.morningMist }}>
        {children}
      </table>
    </div>
  ),
  th: ({ children }) => (
    <th className="text-left px-3 py-2 text-xs font-bold uppercase tracking-wider border-b" style={{ color: BRAND.moonlight, borderColor: BRAND.bgHover }}>
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 text-sm border-b" style={{ borderColor: BRAND.bgHover }}>
      {children}
    </td>
  ),
};

// ── Export Buttons ────────────────────────────────────────────────────────────

interface ExportButtonsProps {
  detail: { name: string; content: string; ext: string };
}

function ExportButtons({ detail }: ExportButtonsProps) {
  const { t } = useI18n();
  const isMarkdown = ['.md', '.markdown'].includes(detail.ext);
  const isHtml = ['.html', '.htm'].includes(detail.ext);
  const baseName = detail.name.replace(/\.[^.]+$/, '');

  const exportAs = useCallback((format: 'html' | 'md' | 'pdf') => {
    if (format === 'md') {
      const blob = new Blob([detail.content], { type: 'text/markdown;charset=utf-8' });
      downloadBlob(blob, `${baseName}.md`);
    } else if (format === 'html') {
      const html = isHtml ? detail.content : contentToHtml(detail.name, detail.content, isMarkdown);
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      downloadBlob(blob, `${baseName}.html`);
    } else if (format === 'pdf') {
      // Open HTML in new window for browser print-to-PDF
      const html = isHtml ? detail.content : contentToHtml(detail.name, detail.content, isMarkdown);
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank');
      if (win) {
        win.onload = () => {
          win.print();
          setTimeout(() => URL.revokeObjectURL(url), 60000);
        };
      }
    }
  }, [detail, baseName, isHtml, isMarkdown]);

  const btnStyle: React.CSSProperties = {
    background: 'var(--color-glass-bg)',
    border: '1px solid var(--color-glass-border)',
    color: 'var(--color-morning-mist)',
    borderRadius: 'var(--radius-md, 8px)',
    cursor: 'pointer',
    transition: 'all var(--duration-normal, 250ms)',
  };

  return (
    <div className="flex items-center gap-2 shrink-0">
      <span className="text-[10px] font-bold uppercase tracking-wider mr-1" style={{ color: 'var(--color-cloud-mist)' }}>
        {t('reports.export')}
      </span>
      {isHtml && (
        <button
          onClick={() => {
            const blob = new Blob([detail.content], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank', 'noopener,noreferrer');
            setTimeout(() => URL.revokeObjectURL(url), 5000);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold"
          style={btnStyle}
          title={t('reports.export.previewTitle')}
        >
          <span className="material-icons text-[14px]">public</span>
          {t('reports.export.preview')}
        </button>
      )}
      <button
        onClick={() => exportAs('html')}
        className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold"
        style={btnStyle}
        title={t('reports.export.htmlTitle')}
      >
        <span className="material-icons text-[14px]">code</span>
        HTML
      </button>
      <button
        onClick={() => exportAs('md')}
        className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold"
        style={btnStyle}
        title={t('reports.export.mdTitle')}
      >
        <span className="material-icons text-[14px]">description</span>
        MD
      </button>
      <button
        onClick={() => exportAs('pdf')}
        className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold"
        style={btnStyle}
        title={t('reports.export.pdfTitle')}
      >
        <span className="material-icons text-[14px]">picture_as_pdf</span>
        PDF
      </button>
    </div>
  );
}

/* ── Keyword matching helper ── */
function matchesKeywords(report: ReportItem, keywordsStr: string): boolean {
  const keywords = keywordsStr.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
  const haystack = `${report.name} ${report.snippet ?? ''}`.toLowerCase();
  return keywords.some(kw => haystack.includes(kw));
}

/* ── Category types ── */
type CategorySelection =
  | { type: 'all' }
  | { type: 'preset'; label: string }
  | { type: 'custom'; name: string };

/* ── New Category Dialog ── */
const NewCategoryDialog = memo(function NewCategoryDialog({ onClose, onConfirm, apiPresetNames }: {
  onClose: () => void;
  onConfirm: (name: string, keywords: string) => void;
  apiPresetNames?: string[];
}) {
  const { t } = useI18n();
  const { categories: customCategories } = useCustomCategoryStore();
  const [name, setName] = useState('');
  const [keywords, setKeywords] = useState('');
  const [nameError, setNameError] = useState('');
  const [keywordsError, setKeywordsError] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  // 掛載時重置欄位並聚焦名稱輸入框
  useEffect(() => {
    setName('');
    setKeywords('');
    setNameError('');
    setKeywordsError('');
    setTimeout(() => nameRef.current?.focus(), 100);
  }, []);

  const handleConfirm = () => {
    const trimName = name.trim();
    const trimKw = keywords.trim();
    let hasError = false;
    if (!trimName) {
      setNameError(t('reports.category.dialog.nameRequired'));
      hasError = true;
    } else if (
      customCategories.some(c => c.name === trimName) ||
      apiPresetNames?.includes(trimName)
    ) {
      // 重複分類名稱檢查（localStorage + API）
      setNameError(t('reports.category.dialog.nameDuplicate'));
      hasError = true;
    } else {
      setNameError('');
    }
    if (!trimKw) {
      setKeywordsError(t('reports.category.dialog.keywordsRequired'));
      hasError = true;
    } else {
      setKeywordsError('');
    }
    if (hasError) return;
    onConfirm(trimName, trimKw);
  };

  // Enter 鍵觸發確認
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirm();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-[420px] rounded-2xl p-6"
        style={{
          background: 'var(--color-smoke-purple)',
          border: '1px solid var(--color-glass-border)',
          boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <h3 className="text-base font-bold mb-5" style={{ color: 'var(--color-moonlight)', fontFamily: 'var(--font-serif)' }}>
          {t('reports.category.dialog.title')}
        </h3>

        {/* 分類名稱欄位 */}
        <div className="mb-4">
          <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--color-morning-mist)' }}>
            {t('reports.category.dialog.name')}
          </label>
          <input
            ref={nameRef}
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setNameError(''); }}
            placeholder={t('reports.category.dialog.namePlaceholder')}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors"
            style={{
              background: 'var(--color-mist-purple)',
              border: `1px solid ${nameError ? '#ff6b8a' : 'var(--color-glass-border)'}`,
              color: 'var(--color-moonlight)',
            }}
          />
          {nameError && <p className="mt-1 text-[11px]" style={{ color: '#ff6b8a' }}>{nameError}</p>}
        </div>

        {/* 關鍵詞欄位 */}
        <div className="mb-6">
          <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--color-morning-mist)' }}>
            {t('reports.category.dialog.keywords')}
          </label>
          <input
            type="text"
            value={keywords}
            onChange={(e) => { setKeywords(e.target.value); setKeywordsError(''); }}
            placeholder={t('reports.category.dialog.keywordsPlaceholder')}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors"
            style={{
              background: 'var(--color-mist-purple)',
              border: `1px solid ${keywordsError ? '#ff6b8a' : 'var(--color-glass-border)'}`,
              color: 'var(--color-moonlight)',
            }}
          />
          {keywordsError && <p className="mt-1 text-[11px]" style={{ color: '#ff6b8a' }}>{keywordsError}</p>}
        </div>

        {/* 操作按鈕 */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-bold transition-colors"
            style={{ color: 'var(--color-morning-mist)', background: 'var(--color-mist-purple)', border: '1px solid var(--color-glass-border)' }}
          >
            {t('reports.category.dialog.cancel')}
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 rounded-lg text-xs font-bold transition-all"
            style={{ background: 'var(--color-sakura-gradient)', color: 'var(--color-moonlight)', boxShadow: '0 0 12px var(--color-sakura-glow)' }}
          >
            {t('reports.category.dialog.confirm')}
          </button>
        </div>
      </motion.div>
    </div>
  );
});

/* ── Delete Confirm Dialog ── */
const DeleteConfirmDialog = memo(function DeleteConfirmDialog({ reportName, onClose, onConfirm }: {
  reportName: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        ref={dialogRef}
        tabIndex={-1}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', damping: 20 }}
        className="relative w-[400px] rounded-2xl p-6 outline-none"
        style={{
          background: 'var(--color-smoke-purple)',
          border: '1px solid var(--color-glass-border)',
          boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: '#ffb8c820' }}
          >
            <span className="material-icons text-lg" style={{ color: '#ffb8c8' }}>warning</span>
          </div>
          <h3 className="text-base font-bold" style={{ color: 'var(--color-moonlight)', fontFamily: 'var(--font-serif)' }}>
            {t('reports.delete.confirm.title')}
          </h3>
        </div>

        {/* Message */}
        <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--color-morning-mist)' }}>
          {t('reports.delete.confirm.message', { name: reportName })}
        </p>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-bold transition-colors"
            style={{ color: 'var(--color-morning-mist)', background: 'var(--color-mist-purple)', border: '1px solid var(--color-glass-border)' }}
          >
            {t('reports.delete.confirm.cancel')}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg text-xs font-bold transition-all"
            style={{ background: '#ffb8c8', color: 'var(--color-twilight-purple)', boxShadow: '0 0 12px #ffb8c840' }}
          >
            {t('reports.delete.confirm.delete')}
          </button>
        </div>
      </motion.div>
    </div>
  );
});

/* ── Category Filter Bar ── */
const CategoryFilterBar = memo(function CategoryFilterBar({
  active,
  onSelect,
  onAddCustom,
  apiPresets,
}: {
  active: CategorySelection;
  onSelect: (sel: CategorySelection) => void;
  onAddCustom: () => void;
  apiPresets?: KeywordPreset[];
}) {
  const { t } = useI18n();
  const { categories: customCategories, removeCategory } = useCustomCategoryStore();
  const { mutate: deleteApiPreset } = useDeleteKeywordPreset();
  const [customOpen, setCustomOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Use API presets for filter bar, fallback to static
  const filterPresets = useMemo(() => {
    if (apiPresets && apiPresets.length > 0) {
      return apiPresets.map(p => ({
        label: p.category,
        labelKey: p.labelKey,
        icon: p.icon,
        keywords: p.mergedKeywords || p.seedKeywords,
        isBuiltin: p.isBuiltin,
        id: p.id,
      }));
    }
    return DOMAIN_PRESETS.map(p => ({
      label: p.label ?? p.labelKey ?? '',
      labelKey: p.labelKey ?? null,
      icon: p.icon,
      keywords: p.keywords,
      isBuiltin: true,
      id: 0,
    }));
  }, [apiPresets]);

  // Non-builtin presets from API (for custom dropdown)
  const apiCustomPresets = useMemo(
    () => filterPresets.filter(p => !p.isBuiltin),
    [filterPresets],
  );

  const builtinPresets = useMemo(
    () => filterPresets.filter(p => p.isBuiltin),
    [filterPresets],
  );

  // Close dropdown on outside click
  useEffect(() => {
    if (!customOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setCustomOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [customOpen]);

  const pillStyle = (isActive: boolean): React.CSSProperties => ({
    background: isActive ? 'var(--color-sakura-gradient)' : 'var(--color-smoke-purple)',
    border: `1px solid ${isActive ? 'transparent' : 'var(--color-glass-border)'}`,
    color: isActive ? 'var(--color-moonlight)' : 'var(--color-morning-mist)',
    boxShadow: isActive ? '0 0 8px var(--color-sakura-glow)' : 'none',
  });

  const isCustomActive = active.type === 'custom';

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {/* All */}
      <button
        className="px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all"
        style={pillStyle(active.type === 'all')}
        onClick={() => onSelect({ type: 'all' })}
      >
        {t('reports.category.all')}
      </button>

      {/* Builtin Presets */}
      {builtinPresets.map((preset) => (
        <button
          key={preset.labelKey ?? preset.label}
          className="px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all"
          style={pillStyle(active.type === 'preset' && active.label === preset.label)}
          onClick={() => onSelect({ type: 'preset', label: preset.label })}
        >
          {preset.icon} {preset.labelKey ? t(preset.labelKey) : preset.label}
        </button>
      ))}

      {/* Custom dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          className="px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1"
          style={pillStyle(isCustomActive)}
          onClick={() => setCustomOpen(!customOpen)}
        >
          <span className="material-icons text-[12px]">tune</span>
          {t('reports.category.custom')}
          <span className="material-icons text-[12px]">{customOpen ? 'expand_less' : 'expand_more'}</span>
        </button>

        {customOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute left-0 top-full mt-1.5 w-56 rounded-xl py-1.5 z-30"
            style={{
              background: 'var(--color-smoke-purple)',
              border: '1px solid var(--color-glass-border)',
              boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
            }}
          >
            {/* API-based custom presets */}
            {apiCustomPresets.map((cat) => (
              <div
                key={cat.label}
                className="flex items-center justify-between px-3 py-1.5 hover:bg-white/5 cursor-pointer group/cat"
                onClick={() => {
                  onSelect({ type: 'custom', name: cat.label });
                  setCustomOpen(false);
                }}
              >
                <span className="text-[11px] font-medium truncate" style={{ color: active.type === 'custom' && active.name === cat.label ? 'var(--color-petal-pink)' : 'var(--color-morning-mist)' }}>
                  {cat.icon} {cat.label}
                </span>
                <button
                  className="opacity-0 group-hover/cat:opacity-100 transition-opacity ml-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (cat.id) deleteApiPreset(cat.id);
                    if (active.type === 'custom' && active.name === cat.label) {
                      onSelect({ type: 'all' });
                    }
                  }}
                  title={t('reports.category.delete')}
                >
                  <span className="material-icons text-[14px]" style={{ color: '#ff6b8a' }}>close</span>
                </button>
              </div>
            ))}

            {/* Legacy localStorage categories */}
            {customCategories.map((cat) => (
              <div
                key={cat.name}
                className="flex items-center justify-between px-3 py-1.5 hover:bg-white/5 cursor-pointer group/cat"
                onClick={() => {
                  onSelect({ type: 'custom', name: cat.name });
                  setCustomOpen(false);
                }}
              >
                <span className="text-[11px] font-medium truncate" style={{ color: active.type === 'custom' && active.name === cat.name ? 'var(--color-petal-pink)' : 'var(--color-morning-mist)' }}>
                  {cat.icon} {cat.name}
                </span>
                <button
                  className="opacity-0 group-hover/cat:opacity-100 transition-opacity ml-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeCategory(cat.name);
                    if (active.type === 'custom' && active.name === cat.name) {
                      onSelect({ type: 'all' });
                    }
                  }}
                  title={t('reports.category.delete')}
                >
                  <span className="material-icons text-[14px]" style={{ color: '#ff6b8a' }}>close</span>
                </button>
              </div>
            ))}

            {(apiCustomPresets.length > 0 || customCategories.length > 0) && (
              <div className="my-1 h-px mx-3" style={{ background: 'var(--color-glass-border)' }} />
            )}

            {/* Add new category */}
            <button
              className="flex items-center gap-2 w-full px-3 py-1.5 text-[11px] font-bold hover:bg-white/5 transition-colors"
              style={{ color: 'var(--color-petal-pink)' }}
              onClick={() => {
                setCustomOpen(false);
                onAddCustom();
              }}
            >
              <span className="material-icons text-[14px]">add_circle_outline</span>
              {t('reports.category.addNew')}
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
});

export function ReportsManager() {
  const { t, locale } = useI18n();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: reports = [], isLoading: isLoadingReports } = useReports(false);
  const { data: detail, isLoading: isLoadingDetail } = useReportDetail(selectedId);
  const { mutate: markAsRead } = useMarkReportAsRead();
  const { mutate: deleteReport } = useDeleteReport();
  const [searchQuery, setSearchQuery] = useState('');

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  // Batch subscribe toggle (hidden by default)
  const [showBatch, setShowBatch] = useState(false);

  // API-based keyword presets
  const { data: apiPresets } = useKeywordPresets();
  const { mutate: createApiPreset } = useCreateKeywordPreset();

  // Category filtering
  const [activeCategory, setActiveCategory] = useState<CategorySelection>({ type: 'all' });
  const [dialogOpen, setDialogOpen] = useState(false);
  const { categories: customCategories, addCategory } = useCustomCategoryStore();

  // useCallback 穩定引用，避免不必要的子元件重繪
  const handleAddCategory = useCallback((name: string, keywords: string) => {
    // Try API first, fallback to localStorage
    if (apiPresets) {
      createApiPreset(
        { category: name, icon: '🏷️', keywords },
        {
          onSuccess: () => {
            setDialogOpen(false);
            setActiveCategory({ type: 'custom', name });
          },
          onError: (err) => {
            const msg = err instanceof Error ? err.message : String(err);
            console.error('[ReportsManager] createApiPreset failed:', msg);
            // Keep dialog open so user can retry or change name
          },
        },
      );
    } else {
      addCategory({ name, icon: '🏷️', keywords });
      setDialogOpen(false);
      setActiveCategory({ type: 'custom', name });
    }
  }, [addCategory, apiPresets, createApiPreset]);

  const handleDeleteReport = useCallback(() => {
    if (!deleteTarget) return;
    deleteReport(deleteTarget.id, {
      onSuccess: () => {
        toast.success(t('reports.delete.success'));
        if (selectedId === deleteTarget.id) setSelectedId(null);
        setDeleteTarget(null);
      },
      onError: () => {
        toast.error(t('reports.delete.error'));
        setDeleteTarget(null);
      },
    });
  }, [deleteTarget, deleteReport, selectedId, t]);

  // 分析完成時自動切回「全部」，確保新報告可見
  const analysisJob = useAnalysisStore((s) => s.currentJob);
  const prevStatusRef = useRef<string | null>(null);
  useEffect(() => {
    const status = analysisJob?.status ?? null;
    if (status === 'completed' && prevStatusRef.current !== 'completed') {
      setActiveCategory({ type: 'all' });
    }
    prevStatusRef.current = status;
  }, [analysisJob?.status]);

  const trendItems = useMemo(
    () => (detail?.insights ? insightsToTrendItems(detail.insights) : []),
    [detail?.insights]
  );

  const sortedReports = useMemo(
    () => [...reports].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [reports]
  );

  // Build preset list for filtering (API or static fallback)
  const filterPresets = useMemo(() => {
    if (apiPresets && apiPresets.length > 0) {
      return apiPresets
        .filter(p => p.isBuiltin)
        .map(p => ({ label: p.category, keywords: p.mergedKeywords || p.seedKeywords }));
    }
    return DOMAIN_PRESETS.map(p => ({ label: p.label ?? p.labelKey ?? '', keywords: p.keywords }));
  }, [apiPresets]);

  // API non-builtin presets for custom category matching
  const apiCustomMap = useMemo(() => {
    if (!apiPresets) return new Map<string, string>();
    return new Map(
      apiPresets
        .filter(p => !p.isBuiltin)
        .map(p => [p.category, p.mergedKeywords || p.seedKeywords]),
    );
  }, [apiPresets]);

  // Apply category + search filters
  const filteredReports = useMemo(() => {
    let result = sortedReports;

    // Category keyword filter
    if (activeCategory.type === 'preset') {
      const preset = filterPresets.find(p => p.label === activeCategory.label);
      if (preset) {
        result = result.filter(r => matchesKeywords(r, preset.keywords));
      }
    } else if (activeCategory.type === 'custom') {
      // Check API custom presets first, then localStorage
      const apiKw = apiCustomMap.get(activeCategory.name);
      if (apiKw) {
        result = result.filter(r => matchesKeywords(r, apiKw));
      } else {
        const cat = customCategories.find(c => c.name === activeCategory.name);
        if (cat) {
          result = result.filter(r => matchesKeywords(r, cat.keywords));
        }
      }
    }

    // 文字搜尋篩選（含摘要片段）
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(r =>
        r.name.toLowerCase().includes(query) ||
        r.id.toLowerCase().includes(query) ||
        (r.snippet ?? '').toLowerCase().includes(query)
      );
    }

    return result;
  }, [sortedReports, searchQuery, activeCategory, customCategories, filterPresets, apiCustomMap]);

  // 當選中的報告不在篩選結果中時，自動選擇第一筆或清空
  useEffect(() => {
    const exists = filteredReports.some(r => r.id === selectedId);
    if ((!selectedId || !exists) && filteredReports.length > 0) {
      setSelectedId(filteredReports[0].id);
    } else if (!exists && filteredReports.length === 0) {
      setSelectedId(null);
    }
  }, [selectedId, filteredReports]);

  // Auto-mark as read when selecting a report
  const handleSelectReport = (reportId: string) => {
    setSelectedId(reportId);
    const report = reports.find(r => r.id === reportId);
    if (report && !report.isRead) {
      markAsRead(reportId);
    }
  };

  const renderDetailHeader = () => {
    if (!detail) return null;
    return (
      <div className="mb-8 space-y-6">
        <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-6">
          <div className="space-y-4 flex-1 min-w-0">
             <div className="flex items-center gap-3">
               <span className="text-[10px] font-bold text-primary px-3 py-1 rounded-full bg-primary/10 border border-primary/20 tracking-widest">
                 {detail.ext.substring(1).toUpperCase()}
               </span>
               <div className="h-px w-8 bg-moonlight/10"></div>
               <span className="text-[10px] font-bold text-[var(--color-morning-mist)] tracking-widest uppercase truncate whitespace-nowrap">
                 FILE ID: {detail.id}
               </span>
             </div>
             
             <h3 className="text-3xl font-bold text-[var(--color-moonlight)] tracking-tight leading-tight">{detail.name || t('reports.untitled')}</h3>
             
             <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
               <div className="flex items-center gap-2 group/meta">
                 <div className="w-8 h-8 rounded-lg bg-moonlight/5 flex items-center justify-center group-hover/meta:bg-primary/10 transition-colors">
                   <span className="material-icons text-[16px] text-[var(--color-morning-mist)] group-hover/meta:text-primary">schedule</span>
                 </div>
                 <div className="flex flex-col">
                   <span className="text-[9px] font-bold text-[var(--color-morning-mist)] uppercase tracking-tighter">{t('reports.meta.modifiedAt')}</span>
                   <span className="text-[11px] font-medium text-[var(--color-moonlight)]">{new Date(detail.updatedAt).toLocaleString(locale)}</span>
                 </div>
               </div>

               <div className="flex items-center gap-2 group/meta">
                 <div className="w-8 h-8 rounded-lg bg-moonlight/5 flex items-center justify-center group-hover/meta:bg-primary/10 transition-colors">
                   <span className="material-icons text-[16px] text-[var(--color-morning-mist)] group-hover/meta:text-primary">storage</span>
                 </div>
                 <div className="flex flex-col">
                   <span className="text-[9px] font-bold text-[var(--color-morning-mist)] uppercase tracking-tighter">{t('reports.meta.fileSize')}</span>
                   <span className="text-[11px] font-medium text-[var(--color-moonlight)]">{formatSize(detail.size)}</span>
                 </div>
               </div>

               <div className="flex items-center gap-2 group/meta">
                 <div className="w-8 h-8 rounded-lg bg-moonlight/5 flex items-center justify-center group-hover/meta:bg-primary/10 transition-colors">
                   <span className="material-icons text-[16px] text-[var(--color-morning-mist)] group-hover/meta:text-primary">folder_open</span>
                 </div>
                 <div className="flex flex-col">
                   <span className="text-[9px] font-bold text-[var(--color-morning-mist)] uppercase tracking-tighter">{t('reports.meta.storagePath')}</span>
                   <code className="text-[11px] font-mono text-primary/70 truncate max-w-xs">{detail.relativePath}</code>
                 </div>
               </div>
             </div>
          </div>
          
          <ExportButtons detail={detail} />
        </div>
        <div className="h-px w-full bg-gradient-to-r from-moonlight/10 via-moonlight/5 to-transparent"></div>
      </div>
    );
  };

  const renderDetailContent = () => {
    if (!detail) return null;

    const isMarkdown = ['.md', '.markdown'].includes(detail.ext);
    const isHtml = ['.html', '.htm'].includes(detail.ext);

    if (isMarkdown) {
      return (
        <article
          className="max-w-none rounded-lg p-8"
          style={{ background: BRAND.bgMain }}
        >
          <ReactMarkdown components={brandedMarkdownComponents}>
            {detail.content}
          </ReactMarkdown>
        </article>
      );
    }

    if (isHtml) {
      return (
        <div className="relative group p-1">
           <div className="absolute -inset-1 bg-gradient-to-br from-primary/20 via-transparent to-sakura-pink/20 rounded-[32px] blur-xl opacity-30 group-hover:opacity-50 transition-opacity"></div>
           <div className="relative rounded-[28px] overflow-hidden border border-moonlight/10 bg-moonlight shadow-2xl">
              <iframe
                className="w-full min-h-[720px]"
                title={detail.name}
                sandbox="allow-same-origin"
                srcDoc={detail.content}
              />
           </div>
        </div>
      );
    }

    return (
      <pre className="whitespace-pre-wrap break-words text-sm leading-7 bg-[var(--color-dark-purple)]/40 border border-white/5 rounded-2xl p-8 text-morning-mist font-mono shadow-inner">
        {detail.content}
      </pre>
    );
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Fixed Header */}
      <header className="h-20 flex items-center justify-between px-8 border-b border-white/5 bg-background-dark/50 backdrop-blur-md z-20 sticky top-0 shrink-0">
        <div className="flex items-center text-xs font-medium tracking-wide">
          <span className="text-cloud-mist hover:text-morning-mist cursor-pointer transition-colors uppercase">{t('skills.breadcrumbs.home')}</span>
          <span className="mx-3 text-[var(--color-cloud-mist)]">/</span>
          <span className="text-[var(--color-moonlight)] text-glow uppercase">{t('reports.title')}</span>
        </div>
        
        <button
          onClick={() => setShowBatch(prev => !prev)}
          className="flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all"
          style={{
            background: showBatch ? 'var(--color-sakura-gradient)' : 'var(--color-smoke-purple)',
            border: `1px solid ${showBatch ? 'transparent' : 'var(--color-glass-border)'}`,
            color: showBatch ? 'var(--color-moonlight)' : 'var(--color-morning-mist)',
            boxShadow: showBatch ? '0 0 12px var(--color-sakura-glow)' : 'none',
          }}
        >
          <span className="material-icons text-[14px]">{showBatch ? 'expand_less' : 'subscriptions'}</span>
          {t('analysis.batch.title')}
        </button>
      </header>

      {/* Analysis Trigger + Batch Subscribe */}
      <div className="px-8 pt-4">
        <AnalysisTrigger />
        <AnimatePresence>
          {showBatch && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <BatchSubscribe />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Main Split Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: List */}
        <aside className="w-96 min-w-[384px] border-r border-white/5 flex flex-col bg-surface-dark/10 backdrop-blur-sm shadow-xl z-10">
          <div className="p-4 pb-3 border-b border-white/5 bg-[var(--color-dark-purple)]/5 space-y-3">
            {/* Search */}
            <div className="relative group">
              <span className="material-icons absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-morning-mist)] group-focus-within:text-primary transition-colors text-lg">search</span>
              <input
                type="text"
                placeholder={t('reports.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-moonlight/5 border border-moonlight/10 rounded-2xl py-2.5 pl-12 pr-4 text-xs text-[var(--color-moonlight)] placeholder-[var(--color-cloud-mist)] focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 transition-all font-medium"
              />
            </div>
            {/* Category Filter */}
            <CategoryFilterBar
              active={activeCategory}
              onSelect={(sel) => { setActiveCategory(sel); setSelectedId(null); }}
              onAddCustom={() => setDialogOpen(true)}
              apiPresets={apiPresets}
            />
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-none bg-gradient-to-b from-transparent to-black/10">
            {isLoadingReports ? (
              <div className="flex flex-col items-center justify-center h-full opacity-30 gap-4">
                <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                <span className="text-[10px] font-bold tracking-widest uppercase">{t('reports.loading')}</span>
              </div>
            ) : filteredReports.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center opacity-30 select-none space-y-4">
                <span className="material-icons text-5xl text-[var(--color-cloud-mist)]">inbox</span>
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase leading-tight">
                  {activeCategory.type !== 'all' ? t('reports.category.noMatch') : t('reports.empty')}
                </span>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {filteredReports.map((item) => {
                  const selected = item.id === selectedId;
                  return (
                    <motion.button
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={clsx(
                        "w-full text-left p-4 rounded-2xl glass-card transition-all group/report relative overflow-hidden",
                        selected ? 'border-primary/40 bg-primary/10 shadow-[0_0_20px_var(--color-sakura-glow)]' : 'border-moonlight/5 hover:bg-moonlight/5'
                      )}
                      onClick={() => handleSelectReport(item.id)}
                    >
                      {selected && (
                        <div className="absolute top-0 right-0 w-16 h-16 opacity-5 pointer-events-none">
                           <span className="material-icons text-5xl text-primary">analytics</span>
                        </div>
                      )}
                      <div className="flex justify-between items-start mb-2.5 gap-2">
                        <span className={clsx(
                          "text-xs font-bold tracking-tight line-clamp-2 leading-tight transition-colors flex-1",
                          selected ? "text-[var(--color-moonlight)] text-glow" : "text-[var(--color-moonlight)] group-hover/report:text-[var(--color-moonlight)]"
                        )}>
                          {item.name || t('reports.untitled')}
                        </span>
                        {!item.isRead && (
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                            </span>
                            <span className="text-[9px] font-bold uppercase tracking-wider text-primary px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20">NEW</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                        <div className="flex items-center gap-3">
                          <span className={clsx(
                            "px-2 py-0.5 rounded-md",
                            selected ? "bg-primary text-[var(--color-moonlight)]" : "bg-moonlight/5 text-[var(--color-morning-mist)]"
                          )}>
                            {item.ext.substring(1)}
                          </span>
                          <span className="flex items-center gap-1.5 text-[var(--color-morning-mist)]">
                            <span className="material-icons text-[12px]">schedule</span>
                            {new Date(item.updatedAt).toLocaleDateString(locale)}
                          </span>
                        </div>
                        <div
                          role="button"
                          tabIndex={0}
                          className="opacity-0 group-hover/report:opacity-100 transition-all p-1 rounded-lg hover:bg-[#ffb8c820] cursor-pointer"
                          title={t('reports.delete')}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget({ id: item.id, name: item.name });
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.stopPropagation();
                              setDeleteTarget({ id: item.id, name: item.name });
                            }
                          }}
                        >
                          <span className="material-icons text-[14px]" style={{ color: '#ffb8c8' }}>delete_outline</span>
                        </div>
                      </div>
                      {selected && (
                        <motion.div 
                          layoutId="active-pill"
                          className="absolute left-0 top-4 bottom-4 w-1 bg-primary rounded-r-full shadow-[0_0_10px_var(--color-petal-pink)]"
                        />
                      )}
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            )}
          </div>
        </aside>

        {/* Right Section: Content */}
        <section className="flex-1 overflow-y-auto bg-twilight-gradient bg-no-repeat bg-fixed scrollbar-sakura p-12">
          <div className="max-w-5xl mx-auto">
            {isLoadingDetail ? (
              <div className="flex flex-col items-center justify-center h-[50vh] opacity-30 gap-4">
                <div className="w-10 h-10 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                <span className="text-[10px] font-bold tracking-widest uppercase">{t('reports.loading')}</span>
              </div>
            ) : detail ? (
              <motion.div
                key={detail.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              >
                {trendItems.length > 0 && (
                  <div className="mb-8">
                    <TechRadar items={trendItems} className="w-full" />
                  </div>
                )}
                {renderDetailHeader()}
                {renderDetailContent()}
              </motion.div>
            ) : (
              <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-12">
                <div className="text-center space-y-4 max-w-2xl">
                    <h2 className="text-5xl font-bold text-[var(--color-moonlight)] tracking-tighter mb-4">{t('reports.title')}</h2>
                    <p className="text-morning-mist text-lg leading-relaxed">{t('reports.subtitle')}</p>
                </div>
                
                <div className="flex flex-col items-center justify-center opacity-20 group">
                  <div className="w-32 h-32 rounded-full border-2 border-dashed border-[var(--color-cloud-mist)] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-700">
                    <span className="material-icons text-7xl text-[var(--color-cloud-mist)]">analytics</span>
                  </div>
                  <span className="text-xs font-bold tracking-[0.4em] uppercase text-[var(--color-cloud-mist)]">{t('reports.detail.empty')}</span>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* New Category Dialog */}
      <AnimatePresence>
        {dialogOpen && (
          <NewCategoryDialog
            onClose={() => setDialogOpen(false)}
            onConfirm={handleAddCategory}
            apiPresetNames={apiPresets?.map(p => p.category)}
          />
        )}
      </AnimatePresence>

      {/* Delete Confirm Dialog */}
      <AnimatePresence>
        {deleteTarget && (
          <DeleteConfirmDialog
            reportName={deleteTarget.name}
            onClose={() => setDeleteTarget(null)}
            onConfirm={handleDeleteReport}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
