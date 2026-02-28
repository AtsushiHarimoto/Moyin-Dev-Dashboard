import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useI18n } from '../../i18n';

// ── Brand-override CSS injected into the insights iframe ──────────────────────

const BRAND_OVERRIDE_CSS = `
<style>
  * { box-sizing: border-box; }
  body {
    font-family: var(--font-sans, 'Inter', system-ui, sans-serif) !important;
    background: var(--color-bg-dark, #0f051a) !important;
    color: var(--color-moonlight, #f3f0ff) !important;
    padding: 32px 24px !important;
  }
  .container { max-width: 860px; margin: 0 auto; }
  h1 { color: var(--color-moonlight, #f3f0ff) !important; }
  h2 { color: var(--color-morning-mist, #a78bfa) !important; border-bottom: 1px solid color-mix(in srgb, var(--color-sakura-pink) 20%, transparent); padding-bottom: 8px; }
  .subtitle { color: var(--color-cloud-mist, #6d5091) !important; }
  .stats-row { border-color: color-mix(in srgb, var(--color-sakura-pink) 20%, transparent) !important; }
  .stat-value { color: var(--color-moonlight, #f3f0ff) !important; }
  .stat-label { color: var(--color-cloud-mist, #6d5091) !important; }
  .nav-toc { background: var(--color-glass-bg) !important; border-color: color-mix(in srgb, var(--color-sakura-pink) 30%, transparent) !important; }
  .nav-toc a { background: color-mix(in srgb, var(--color-sakura-pink) 15%, transparent) !important; color: var(--color-morning-mist, #a78bfa) !important; }
  .nav-toc a:hover { background: color-mix(in srgb, var(--color-sakura-pink) 30%, transparent) !important; color: var(--color-moonlight, #f3f0ff) !important; }
  .at-a-glance { background: linear-gradient(135deg, color-mix(in srgb, var(--color-sakura-pink) 15%, transparent) 0%, color-mix(in srgb, var(--color-petal-pink) 10%, transparent) 100%) !important; border-color: color-mix(in srgb, var(--color-sakura-pink) 40%, transparent) !important; }
  .glance-title { color: var(--color-moonlight, #f3f0ff) !important; }
  .glance-section, .glance-section strong { color: var(--color-morning-mist, #a78bfa) !important; }
  .see-more { color: var(--color-petal-pink, #f472b6) !important; }
  .project-area, .narrative, .claude-md-section { background: var(--color-glass-bg) !important; border-color: color-mix(in srgb, var(--color-sakura-pink) 30%, transparent) !important; }
  .area-name { color: var(--color-moonlight, #f3f0ff) !important; }
  .area-count { background: color-mix(in srgb, var(--color-sakura-pink) 20%, transparent) !important; color: var(--color-morning-mist, #a78bfa) !important; }
  .area-desc, .narrative p { color: var(--color-morning-mist, #a78bfa) !important; }
  .big-win { background: rgba(52,211,153,0.08) !important; border-color: rgba(52,211,153,0.3) !important; }
  .big-win-title { color: #34d399 !important; }
  .big-win-desc { color: rgba(52,211,153,0.8) !important; }
  .key-insight { background: rgba(52,211,153,0.08) !important; border-color: rgba(52,211,153,0.3) !important; color: #34d399 !important; }
  .friction-category { background: color-mix(in srgb, var(--color-petal-pink) 8%, transparent) !important; border-color: color-mix(in srgb, var(--color-petal-pink) 30%, transparent) !important; }
  .friction-title { color: var(--color-petal-pink, #f472b6) !important; }
  .friction-desc { color: color-mix(in srgb, var(--color-petal-pink) 70%, transparent) !important; }
  .friction-examples li { color: var(--color-morning-mist, #a78bfa) !important; }
  .claude-md-section { background: color-mix(in srgb, var(--color-sakura-pink) 8%, transparent) !important; border-color: color-mix(in srgb, var(--color-sakura-pink) 30%, transparent) !important; }
  .claude-md-section h3 { color: var(--color-sakura-pink, #a855f7) !important; }
  .claude-md-actions { border-color: color-mix(in srgb, var(--color-sakura-pink) 20%, transparent) !important; }
  pre, code { background: color-mix(in srgb, var(--color-surface-dark) 80%, transparent) !important; color: var(--color-moonlight, #f3f0ff) !important; border-radius: 8px; }
  pre { padding: 12px 16px; overflow-x: auto; }
  .feature-card, .horizon-card, .suggestion-card, .pattern-card { background: var(--color-glass-bg) !important; border-color: color-mix(in srgb, var(--color-sakura-pink) 30%, transparent) !important; }
  .feature-card h3, .horizon-card h3, .suggestion-card h3, .pattern-card h3 { color: var(--color-moonlight, #f3f0ff) !important; }
  button, .copy-btn, .add-btn { background: color-mix(in srgb, var(--color-sakura-pink) 20%, transparent) !important; border-color: color-mix(in srgb, var(--color-sakura-pink) 40%, transparent) !important; color: var(--color-morning-mist, #a78bfa) !important; border-radius: 8px !important; }
  button:hover, .copy-btn:hover, .add-btn:hover { background: color-mix(in srgb, var(--color-sakura-pink) 30%, transparent) !important; }
  .fun-ending { background: color-mix(in srgb, var(--color-petal-pink) 8%, transparent) !important; border-color: color-mix(in srgb, var(--color-petal-pink) 30%, transparent) !important; }
  .fun-ending h3 { color: var(--color-petal-pink, #f472b6) !important; }
  .section-intro { color: var(--color-cloud-mist, #6d5091) !important; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: color-mix(in srgb, var(--color-sakura-pink) 30%, transparent); border-radius: 3px; }
</style>
`;

// ── API ───────────────────────────────────────────────────────────────────────

interface InsightsListItem {
  id: string;
  name: string;
  generatedAt: string;
  size: number;
  isCurrent: boolean;
}

async function insightsApi<T>(url: string): Promise<T> {
  const res = await fetch(`/api${url}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data as T;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

// ── Theme variable injection ───────────────────────────────────────────────────

const THEME_VAR_NAMES = [
  '--color-bg-dark',
  '--color-surface-dark',
  '--color-glass-bg',
  '--color-glass-border',
  '--color-sakura-pink',
  '--color-sakura-glow',
  '--color-moonlight',
  '--color-morning-mist',
  '--color-cloud-mist',
  '--color-mist-purple',
  '--color-petal-pink',
  '--color-twilight-purple',
  '--color-dark-purple',
  '--color-smoke-purple',
];

function getThemeVars(): string {
  const style = getComputedStyle(document.documentElement);
  return THEME_VAR_NAMES
    .map((v) => `${v}: ${style.getPropertyValue(v)};`)
    .join('\n  ');
}

// ── Component ─────────────────────────────────────────────────────────────────

export function InsightsManager() {
  const { t } = useI18n();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Load list via React Query
  const { data: list = [], isLoading: loading, refetch: refetchList } = useQuery({
    queryKey: ['insights', 'list'],
    queryFn: () => insightsApi<InsightsListItem[]>('/insights/list'),
    staleTime: 5 * 60 * 1000,
  });

  // Auto-select first item when list loads
  useEffect(() => {
    if (list.length > 0 && !selectedId) {
      setSelectedId(list[0].id);
    }
  }, [list, selectedId]);

  // Load selected report via React Query
  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ['insights', 'detail', selectedId],
    queryFn: () => insightsApi<{ html: string }>(`/insights/report/${selectedId}`),
    enabled: !!selectedId,
    staleTime: 5 * 60 * 1000,
  });

  const html = detailData?.html ?? null;

  const brandedHtml = html
    ? html.replace(
        '</head>',
        `<style>:root {\n  ${getThemeVars()}\n}</style>${BRAND_OVERRIDE_CSS}</head>`,
      )
    : null;
  const selectedItem = list.find((i) => i.id === selectedId);

  // ── Empty state ──
  if (!loading && list.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div
          className="text-center space-y-4 max-w-md p-8 rounded-xl"
          style={{ background: 'var(--color-glass-bg)', border: '1px solid var(--color-glass-border)' }}
        >
          <span className="material-icons text-5xl" style={{ color: 'var(--color-cloud-mist)' }}>query_stats</span>
          <h3 className="text-lg font-bold" style={{ color: 'var(--color-moonlight)' }}>{t('insights.empty')}</h3>
          <p className="text-sm" style={{ color: 'var(--color-morning-mist)' }}>
            {t('insights.emptyDesc')}
          </p>
          <div
            className="mt-4 p-3 rounded-lg text-left"
            style={{ background: 'var(--color-smoke-purple)', border: '1px solid var(--color-glass-border)' }}
          >
            <code className="text-xs" style={{ color: 'var(--color-petal-pink)', fontFamily: 'var(--font-mono)' }}>
              $ claude<br />&gt; /insights
            </code>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full" style={{ minHeight: 'calc(100vh - 64px)' }}>
      {/* ── Sidebar list ── */}
      <div
        className="w-72 shrink-0 flex flex-col border-r overflow-y-auto"
        style={{ borderColor: 'var(--color-glass-border)', background: 'var(--color-smoke-purple)' }}
      >
        {/* Header */}
        <div className="p-4 flex items-center gap-2" style={{ borderBottom: '1px solid var(--color-glass-border)' }}>
          <span className="material-icons text-lg" style={{ color: 'var(--color-sakura-pink)' }}>insights</span>
          <h2 className="text-sm font-bold" style={{ color: 'var(--color-moonlight)', fontFamily: 'var(--font-serif)' }}>
            {t('insights.title')}
          </h2>
          <button
            onClick={() => { refetchList(); }}
            className="ml-auto flex items-center justify-center w-7 h-7 rounded-md transition-all"
            style={{ background: 'var(--color-glass-bg)', border: '1px solid var(--color-glass-border)', color: 'var(--color-morning-mist)', cursor: 'pointer' }}
            title={t('insights.refresh')}
          >
            <span className="material-icons text-sm">refresh</span>
          </button>
        </div>

        {/* Report list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading ? (
            <div className="flex justify-center py-8">
              <span className="material-icons animate-pulse" style={{ color: 'var(--color-sakura-pink)' }}>hourglass_empty</span>
            </div>
          ) : (
            list.map((item) => {
              const isActive = selectedId === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className="w-full text-left px-3 py-2.5 rounded-lg transition-all"
                  style={{
                    background: isActive ? 'var(--color-glass-bg)' : 'transparent',
                    border: isActive ? '1px solid var(--color-glass-border)' : '1px solid transparent',
                    cursor: 'pointer',
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {item.isCurrent && (
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: 'color-mix(in srgb, var(--color-sakura-pink) 20%, transparent)', color: 'var(--color-sakura-pink)', border: '1px solid color-mix(in srgb, var(--color-sakura-pink) 30%, transparent)' }}
                      >
                        {t('insights.latest')}
                      </span>
                    )}
                    <span
                      className="text-xs font-medium truncate"
                      style={{ color: isActive ? 'var(--color-moonlight)' : 'var(--color-morning-mist)' }}
                    >
                      {item.isCurrent ? t('insights.latestReport') : item.name.replace('insights_', '').replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/, '$1-$2-$3 $4:$5')}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px]" style={{ color: 'var(--color-cloud-mist)' }}>
                      {new Date(item.generatedAt).toLocaleDateString('zh-TW')}
                    </span>
                    <span className="text-[10px]" style={{ color: 'var(--color-cloud-mist)' }}>
                      {formatSize(item.size)}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Detail panel ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {detailLoading ? (
          <div className="flex items-center justify-center flex-1">
            <span className="material-icons text-4xl animate-pulse" style={{ color: 'var(--color-sakura-pink)' }}>insights</span>
          </div>
        ) : brandedHtml ? (
          <>
            {/* Detail header */}
            <div
              className="flex items-center justify-between px-6 py-3 shrink-0"
              style={{ borderBottom: '1px solid var(--color-glass-border)' }}
            >
              <div>
                <span className="text-sm font-bold" style={{ color: 'var(--color-moonlight)' }}>
                  {selectedItem?.isCurrent ? t('insights.latestReport') : selectedItem?.name}
                </span>
                {selectedItem && (
                  <span className="text-xs ml-3" style={{ color: 'var(--color-cloud-mist)' }}>
                    {new Date(selectedItem.generatedAt).toLocaleString('zh-TW')}
                  </span>
                )}
              </div>
            </div>
            {/* Iframe */}
            <div className="flex-1 overflow-hidden" style={{ background: 'var(--color-bg-dark)' }}>
              <iframe
                srcDoc={brandedHtml}
                title="Claude Code Insights"
                className="w-full h-full border-0"
                style={{ background: 'var(--color-bg-dark)' }}
                sandbox="allow-same-origin"
              />
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center flex-1">
            <p style={{ color: 'var(--color-cloud-mist)' }}>{t('insights.selectReport')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
