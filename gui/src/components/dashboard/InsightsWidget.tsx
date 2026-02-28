import { useLatestInsights } from '../../hooks/useAnalysis';
import { useNavigationStore } from '../../stores/useNavigationStore';
import type { TrendItem } from '../../utils/api';

interface CategoryCardProps {
  title: string;
  items: string[];
  trendItems?: TrendItem[];
  borderColor: string;
}

function trendArrow(direction?: TrendItem['trendDirection']): string {
  if (direction === 'rising') return '↑';
  if (direction === 'declining') return '↓';
  return '→';
}

function trendArrowColor(direction?: TrendItem['trendDirection']): string {
  if (direction === 'rising') return '#b8e6cf';
  if (direction === 'declining') return '#ffb8c8';
  return 'var(--color-morning-mist)';
}

function CategoryCard({ title, items, trendItems, borderColor }: CategoryCardProps) {
  if (items.length === 0) return null;

  return (
    <div
      className="rounded-lg p-4 flex-1 min-w-[140px]"
      style={{
        background: 'var(--color-smoke-purple)',
        borderLeft: `3px solid ${borderColor}`,
      }}
    >
      <h4 className="text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: borderColor }}>
        {title}
      </h4>
      <ul className="space-y-1">
        {items.map((item, idx) => {
          const trend = trendItems?.find(t => t.name === item);
          return (
            <li key={`${item}-${idx}`} className="text-sm flex items-center gap-1.5" style={{ color: 'var(--color-moonlight)' }}>
              <span>{item}</span>
              {trend && (
                <span className="text-xs font-bold" style={{ color: trendArrowColor(trend.trendDirection) }}>
                  {trendArrow(trend.trendDirection)}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function InsightsWidget() {
  const { data: insights, isLoading } = useLatestInsights();
  const setMode = useNavigationStore((s) => s.setMode);

  if (isLoading) {
    return (
      <div className="rounded-lg p-5 animate-pulse" style={{ background: 'var(--color-smoke-purple)', height: '160px' }} />
    );
  }

  if (!insights) {
    return (
      <div
        className="rounded-lg p-5 text-center"
        style={{ background: 'var(--color-smoke-purple)', border: '1px solid var(--color-mist-purple)' }}
      >
        <span className="text-2xl mb-2 block">🔮</span>
        <p className="text-sm" style={{ color: 'var(--color-cloud-mist)' }}>
          尚無分析數據，前往報告頁面執行分析
        </p>
      </div>
    );
  }

  const adopt = insights.adopt ?? [];
  const trial = insights.trial ?? [];
  const assess = insights.assess ?? [];
  const hold = insights.hold ?? [];
  const trendItems = insights.items ?? [];

  return (
    <div
      className="rounded-lg p-5"
      style={{ background: 'var(--color-smoke-purple)', border: '1px solid var(--color-mist-purple)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">🔮</span>
          <h3 className="text-base font-bold" style={{ color: 'var(--color-moonlight)', fontFamily: 'var(--font-serif, "Playfair Display", "Noto Serif TC", serif)' }}>
            AI 洞察
          </h3>
        </div>
        <span className="text-xs" style={{ color: 'var(--color-cloud-mist)' }}>
          {new Date(insights.reportDate).toLocaleDateString('zh-TW')}
        </span>
      </div>

      {/* 4-column grid: lg=4col, md=2x2, sm=stack */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <CategoryCard
          title="🟢 建議採用"
          items={adopt}
          trendItems={trendItems}
          borderColor="#b8e6cf"
        />
        <CategoryCard
          title="🔵 值得試驗"
          items={trial}
          trendItems={trendItems}
          borderColor="#b8d8ff"
        />
        <CategoryCard
          title="🟡 持續觀察"
          items={assess}
          trendItems={trendItems}
          borderColor="#ffe4b8"
        />
        <CategoryCard
          title="🔴 謹慎觀望"
          items={hold}
          trendItems={trendItems}
          borderColor="#ffb8c8"
        />
      </div>

      {insights.summary && (
        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-morning-mist)' }}>
          {insights.summary}
        </p>
      )}

      <button
        type="button"
        onClick={() => setMode('reports')}
        className="mt-3 text-xs transition-colors hover:underline"
        style={{ color: 'var(--color-petal-pink)' }}
      >
        查看完整報告 →
      </button>
    </div>
  );
}
