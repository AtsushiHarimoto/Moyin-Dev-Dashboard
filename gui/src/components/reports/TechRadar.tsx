import { useMemo, useState } from 'react';
import { useI18n } from '../../i18n';
import type { TrendItem as BaseTrendItem } from '../../utils/api';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  Cell,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface TrendItem extends BaseTrendItem {
  isNew?: boolean;
}

// ── Brand Tokens ───────────────────────────────────────────────────────────────
// Mapped from tokens.css (--color-*) for JS usage inside Recharts SVG

const T = {
  bgDeep: 'var(--color-bg-dark, #0f051a)',
  surface: 'var(--color-surface-dark, rgba(20,10,35,0.85))',
  glassBg: 'var(--color-glass-bg, rgba(30,15,50,0.6))',
  glassBorder: 'var(--color-glass-border, rgba(168,85,247,0.4))',
  sakura: 'var(--color-sakura-pink, #a855f7)',
  moonlight: 'var(--color-moonlight, #f3f0ff)',
  morningMist: 'var(--color-morning-mist, #a78bfa)',
  cloudMist: 'var(--color-cloud-mist, #6d5091)',
  mistPurple: 'var(--color-mist-purple, #2d1b4e)',
  petalPink: 'var(--color-petal-pink, #f472b6)',
  twilight: 'var(--color-twilight-purple, #1a0e2e)',
  smokePurple: 'var(--color-smoke-purple, #140a23)',
} as const;

// Recharts SVG uses CSS var() with hardcoded fallbacks
const SVG = {
  gridStroke: 'var(--color-mist-purple, #2d1b4e)',
  axisStroke: 'var(--color-cloud-mist, #6d5091)',
  axisText: 'var(--color-morning-mist, #a78bfa)',
  ringText: 'var(--color-moonlight, #f3f0ff)',
} as const;

const RING_COLORS: Record<TrendItem['ring'], string> = {
  adopt: '#34d399',   // emerald-400 — 成功/採用
  trial: '#818cf8',   // indigo-400 — 試驗
  assess: '#fbbf24',  // amber-400 — 評估
  hold: '#f472b6',    // pink-400 — 暫緩
};

// ── Layout Constants ───────────────────────────────────────────────────────────

const QUADRANTS: TrendItem['quadrant'][] = ['techniques', 'tools', 'platforms', 'languages'];

const QUADRANT_LABEL_KEYS: Record<TrendItem['quadrant'], string> = {
  techniques: 'radar.quadrant.techniques',
  tools: 'radar.quadrant.tools',
  platforms: 'radar.quadrant.platforms',
  languages: 'radar.quadrant.languages',
};

const RING_LABEL_KEYS: Record<TrendItem['ring'], string> = {
  adopt: 'radar.ring.adopt',
  trial: 'radar.ring.trial',
  assess: 'radar.ring.assess',
  hold: 'radar.ring.hold',
};

const TREND_LABEL_KEYS: Record<TrendItem['trendDirection'], string> = {
  rising: 'radar.trend.rising',
  stable: 'radar.trend.stable',
  declining: 'radar.trend.declining',
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

// ── Chart Data ─────────────────────────────────────────────────────────────────

interface ChartDatum {
  x: number;
  y: number;
  z: number;
  item: TrendItem;
}

function toChartData(items: TrendItem[]): ChartDatum[] {
  const ringY: Record<TrendItem['ring'], number> = { hold: 0, assess: 1, trial: 2, adopt: 3 };

  return items.map((item) => {
    const h = hashString(item.name);
    const jitterX = ((h % 100) / 100 - 0.5) * 0.6;
    const jitterY = (((h >> 8) % 100) / 100 - 0.5) * 0.5;
    const qIdx = QUADRANTS.indexOf(item.quadrant);
    return {
      x: qIdx + 0.5 + jitterX,
      y: ringY[item.ring] + 0.5 + jitterY,
      z: 60 + item.confidence * 540,
      item,
    };
  });
}

// ── Custom Bubble Shape ────────────────────────────────────────────────────────

interface BubbleShapeProps {
  cx?: number;
  cy?: number;
  payload?: ChartDatum;
}

function BubbleShape(props: BubbleShapeProps) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null || !payload?.item) return null;
  const item = payload.item;
  const color = RING_COLORS[item.ring];
  const r = 5 + item.confidence * 12;

  let arrow: { dy: number; text: string; color: string } | null = null;
  if (item.trendDirection === 'rising') {
    arrow = { dy: -r - 6, text: '▲', color: RING_COLORS.adopt };
  } else if (item.trendDirection === 'declining') {
    arrow = { dy: r + 10, text: '▼', color: RING_COLORS.hold };
  }

  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={color} opacity={0.85} className="cursor-pointer" />
      {item.isNew && (
        <circle cx={cx} cy={cy} r={r + 3} fill="none" stroke={color} strokeWidth={1.5} strokeDasharray="3 2" opacity={0.5} />
      )}
      {arrow && (
        <text x={cx} y={cy + arrow.dy} textAnchor="middle" fill={arrow.color} fontSize={8} fontWeight={700}>
          {arrow.text}
        </text>
      )}
    </g>
  );
}

// ── Custom Tooltip ─────────────────────────────────────────────────────────────

interface BubbleTooltipProps {
  active?: boolean;
  payload?: Array<{ payload?: ChartDatum }>;
}

function BubbleTooltip({ active, payload }: BubbleTooltipProps) {
  const { t } = useI18n();
  if (!active || !payload?.[0]?.payload?.item) return null;
  const item = payload[0].payload.item;
  const ringColor = RING_COLORS[item.ring];

  return (
    <div
      style={{
        background: T.twilight,
        border: `1px solid ${T.glassBorder}`,
        borderRadius: 'var(--radius-lg, 12px)',
        padding: 'var(--spacing-sm, 8px) var(--spacing-lg, 24px)',
        minWidth: 180,
        maxWidth: 260,
        boxShadow: 'var(--shadow-md, 0 4px 12px rgba(0,0,0,0.3))',
      }}
    >
      <div style={{ color: T.moonlight, fontWeight: 700, fontSize: 'var(--font-size-body-sm, 14px)', marginBottom: 'var(--spacing-sm, 8px)' }}>
        {item.name}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm, 8px)', marginBottom: 'var(--spacing-sm, 8px)' }}>
        <span
          style={{
            fontSize: 'var(--font-size-caption, 12px)',
            fontWeight: 700,
            padding: '2px var(--spacing-sm, 8px)',
            borderRadius: 'var(--radius-full, 9999px)',
            background: `${ringColor}20`,
            color: ringColor,
            border: `1px solid ${ringColor}40`,
          }}
        >
          {t(RING_LABEL_KEYS[item.ring])}
        </span>
        <span style={{ fontSize: 'var(--font-size-caption, 12px)', color: T.morningMist }}>
          {t(QUADRANT_LABEL_KEYS[item.quadrant])}
        </span>
      </div>
      {item.signal && (
        <p style={{ fontSize: 'var(--font-size-caption, 12px)', lineHeight: 1.5, color: T.morningMist, margin: '0 0 var(--spacing-sm, 8px)' }}>
          {item.signal}
        </p>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm, 8px)' }}>
        <span style={{ fontSize: 'var(--font-size-caption, 12px)', color: T.cloudMist }}>{t('radar.confidence')}</span>
        <div style={{ flex: 1, height: 6, borderRadius: 'var(--radius-full, 9999px)', background: `${SVG.gridStroke}80`, overflow: 'hidden' }}>
          <div style={{ width: `${Math.round(item.confidence * 100)}%`, height: '100%', borderRadius: 'var(--radius-full, 9999px)', background: T.petalPink }} />
        </div>
        <span style={{ fontSize: 'var(--font-size-caption, 12px)', fontWeight: 700, color: T.petalPink }}>
          {Math.round(item.confidence * 100)}%
        </span>
      </div>
    </div>
  );
}

// ── Zoom Controls ──────────────────────────────────────────────────────────────

const ZOOM_MIN = 0.8;
const ZOOM_MAX = 2.5;
const ZOOM_STEP = 0.3;

function ZoomControls({ zoom, onZoom }: { zoom: number; onZoom: (z: number) => void; }) {
  const { t } = useI18n();
  const canZoomIn = zoom < ZOOM_MAX;
  const canZoomOut = zoom > ZOOM_MIN;
  const isDefault = zoom === 1;

  const btnStyle = (enabled: boolean): React.CSSProperties => ({
    width: 32,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--radius-md, 8px)',
    border: `1px solid ${T.glassBorder}`,
    background: T.glassBg,
    color: enabled ? T.moonlight : T.cloudMist,
    cursor: enabled ? 'pointer' : 'default',
    opacity: enabled ? 1 : 0.4,
    fontSize: 16,
    fontWeight: 700,
    transition: 'all var(--duration-normal, 250ms) var(--ease-out)',
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs, 4px)' }}>
      <button
        onClick={() => canZoomIn && onZoom(Math.min(ZOOM_MAX, zoom + ZOOM_STEP))}
        style={btnStyle(canZoomIn)}
        title={t('radar.zoomIn')}
      >
        +
      </button>
      <button
        onClick={() => canZoomOut && onZoom(Math.max(ZOOM_MIN, zoom - ZOOM_STEP))}
        style={btnStyle(canZoomOut)}
        title={t('radar.zoomOut')}
      >
        −
      </button>
      {!isDefault && (
        <button
          onClick={() => onZoom(1)}
          style={{
            ...btnStyle(true),
            width: 'auto',
            padding: '0 var(--spacing-sm, 8px)',
            fontSize: 'var(--font-size-caption, 12px)',
          }}
          title={t('radar.reset')}
        >
          {t('radar.reset')}
        </button>
      )}
    </div>
  );
}

// ── Adopt Table ────────────────────────────────────────────────────────────────

function AdoptTable({ items }: { items: TrendItem[] }) {
  const { t } = useI18n();
  const adoptItems = items.filter((i) => i.ring === 'adopt');
  if (adoptItems.length === 0) return null;

  return (
    <div style={{ marginTop: 'var(--spacing-lg, 24px)' }}>
      <h4
        style={{
          fontSize: 'var(--font-size-body-sm, 14px)',
          fontWeight: 700,
          color: T.moonlight,
          marginBottom: 'var(--spacing-sm, 8px)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm, 8px)',
        }}
      >
        <span
          style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: 'var(--radius-full, 9999px)',
            background: RING_COLORS.adopt,
          }}
        />
        {t('radar.ring.adopt')}
      </h4>
      <div
        style={{
          borderRadius: 'var(--radius-lg, 12px)',
          border: `1px solid ${T.glassBorder}`,
          overflow: 'hidden',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: T.glassBg }}>
              <th style={thStyle}>{t('radar.table.name')}</th>
              <th style={thStyle}>{t('radar.table.quadrant')}</th>
              <th style={thStyle}>{t('radar.table.trend')}</th>
              <th style={thStyle}>{t('radar.table.confidence')}</th>
            </tr>
          </thead>
          <tbody>
            {adoptItems.map((item, i) => (
              <tr
                key={`${item.name}-${i}`}
                style={{ borderTop: `1px solid color-mix(in srgb, var(--color-sakura-pink) 15%, transparent)` }}
              >
                <td style={{ ...tdStyle, color: T.moonlight, fontWeight: 600 }}>
                  {item.name}
                </td>
                <td style={tdStyle}>{t(QUADRANT_LABEL_KEYS[item.quadrant])}</td>
                <td style={tdStyle}>
                  <span style={{ color: item.trendDirection === 'rising' ? RING_COLORS.adopt : item.trendDirection === 'declining' ? RING_COLORS.hold : T.morningMist }}>
                    {t(TREND_LABEL_KEYS[item.trendDirection])}
                  </span>
                </td>
                <td style={tdStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm, 8px)' }}>
                    <div style={{ flex: 1, height: 4, borderRadius: 'var(--radius-full, 9999px)', background: `${SVG.gridStroke}80`, overflow: 'hidden', minWidth: 40 }}>
                      <div style={{ width: `${Math.round(item.confidence * 100)}%`, height: '100%', borderRadius: 'var(--radius-full, 9999px)', background: RING_COLORS.adopt }} />
                    </div>
                    <span style={{ fontSize: 'var(--font-size-caption, 12px)', fontWeight: 700, color: RING_COLORS.adopt, minWidth: 32, textAlign: 'right' }}>
                      {Math.round(item.confidence * 100)}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: 'var(--spacing-sm, 8px) var(--spacing-lg, 24px)',
  fontSize: 'var(--font-size-caption, 12px)',
  fontWeight: 600,
  color: 'var(--color-cloud-mist, #6d5091)',
  textAlign: 'left',
};

const tdStyle: React.CSSProperties = {
  padding: 'var(--spacing-sm, 8px) var(--spacing-lg, 24px)',
  fontSize: 'var(--font-size-body-sm, 14px)',
  color: 'var(--color-morning-mist, #a78bfa)',
};

// ── Main TechRadar Component ───────────────────────────────────────────────────

export interface TechRadarProps {
  items: TrendItem[];
  className?: string;
}

export function TechRadar({ items, className }: TechRadarProps) {
  const { t } = useI18n();
  const chartData = useMemo(() => toChartData(items), [items]);
  const [zoom, setZoom] = useState(1);

  const half = 2 / zoom;
  const xDomain: [number, number] = [2 - half, 2 + half];
  const yDomain: [number, number] = [2 - half, 2 + half];
  const xTicks = [0.5, 1.5, 2.5, 3.5].filter((v) => v >= xDomain[0] && v <= xDomain[1]);
  const yTicks = [0.5, 1.5, 2.5, 3.5].filter((v) => v >= yDomain[0] && v <= yDomain[1]);

  return (
    <div
      className={className}
      style={{
        background: T.smokePurple,
        borderRadius: 'var(--radius-lg, 12px)',
        border: `1px solid ${T.glassBorder}`,
        padding: 'var(--spacing-lg, 24px)',
      }}
    >
      {/* Header + Zoom */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-sm, 8px)' }}>
        <h3 style={{ fontSize: 'var(--font-size-body, 16px)', fontWeight: 700, color: T.moonlight, margin: 0 }}>
          {t('radar.title')}
        </h3>
        <ZoomControls zoom={zoom} onZoom={setZoom} />
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-sm, 8px)', marginBottom: 'var(--spacing-sm, 8px)' }}>
        {(['adopt', 'trial', 'assess', 'hold'] as const).map((ring) => (
          <span
            key={ring}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--spacing-xs, 4px)',
              fontSize: 'var(--font-size-caption, 12px)',
              color: T.morningMist,
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: 'var(--radius-full, 9999px)', background: RING_COLORS[ring], display: 'inline-block' }} />
            {t(RING_LABEL_KEYS[ring])}
          </span>
        ))}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={380}>
        <ScatterChart margin={{ top: 12, right: 24, bottom: 12, left: 12 }} style={{ background: SVG.gridStroke + '30' }}>
          <CartesianGrid strokeDasharray="3 3" stroke={SVG.gridStroke} opacity={0.4} />
          <XAxis
            type="number"
            dataKey="x"
            domain={xDomain}
            ticks={xTicks}
            tickFormatter={(v: number) => {
              const idx = Math.floor(v);
              return QUADRANTS[idx] ? t(QUADRANT_LABEL_KEYS[QUADRANTS[idx]]) : '';
            }}
            tick={{ fill: SVG.axisText, fontSize: 12, fontWeight: 700 }}
            axisLine={{ stroke: SVG.axisStroke }}
            tickLine={false}
            allowDataOverflow
          />
          <YAxis
            type="number"
            dataKey="y"
            domain={yDomain}
            ticks={yTicks}
            tickFormatter={(v: number) => {
              const idx = Math.floor(v);
              const rings: TrendItem['ring'][] = ['hold', 'assess', 'trial', 'adopt'];
              return rings[idx] ? t(RING_LABEL_KEYS[rings[idx]]) : '';
            }}
            tick={{ fill: SVG.axisText, fontSize: 11, fontWeight: 600 }}
            axisLine={{ stroke: SVG.axisStroke }}
            tickLine={false}
            width={64}
            allowDataOverflow
          />
          <ZAxis type="number" dataKey="z" range={[60, 600]} />
          <Tooltip
            content={<BubbleTooltip />}
            cursor={false}
            wrapperStyle={{ pointerEvents: 'none', zIndex: 50 }}
            offset={20}
            allowEscapeViewBox={{ x: true, y: true }}
          />
          <Scatter data={chartData} shape={<BubbleShape />}>
            {chartData.map((d, i) => (
              <Cell key={`${d.item.name}-${i}`} fill={RING_COLORS[d.item.ring]} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>

      {/* Adopt Table */}
      <AdoptTable items={items} />
    </div>
  );
}

// ── Helper: Convert AnalysisInsights to TrendItem[] ────────────────────────────

/**
 * Convert AnalysisInsights (with rich items[] or legacy string arrays) into TrendItem[]
 * for the TechRadar visualization.
 */
export function insightsToTrendItems(insights: {
  items?: BaseTrendItem[];
  adopt?: string[];
  trial?: string[];
  assess?: string[];
  hold?: string[];
}): TrendItem[] {
  if (insights.items && insights.items.length > 0) {
    return insights.items.map((item, i) => ({
      ...item,
      isNew: i === 0,
    }));
  }

  const result: TrendItem[] = [];

  const ringConfig: Array<{
    ring: TrendItem['ring'];
    names: string[];
    trendDirection: TrendItem['trendDirection'];
    baseConfidence: number;
    signal: string;
  }> = [
    { ring: 'adopt', names: insights.adopt ?? [], trendDirection: 'rising', baseConfidence: 0.7, signal: '建議採用' },
    { ring: 'trial', names: insights.trial ?? [], trendDirection: 'rising', baseConfidence: 0.6, signal: '值得試驗' },
    { ring: 'assess', names: insights.assess ?? [], trendDirection: 'stable', baseConfidence: 0.4, signal: '持續觀察中' },
    { ring: 'hold', names: insights.hold ?? [], trendDirection: 'declining', baseConfidence: 0.2, signal: '建議考慮替代方案' },
  ];

  for (const config of ringConfig) {
    config.names.forEach((name, i) => {
      result.push({
        name,
        ring: config.ring,
        quadrant: QUADRANTS[hashString(name) % QUADRANTS.length],
        trendDirection: config.trendDirection,
        confidence: config.baseConfidence + (hashString(name) % 30) / 100,
        signal: config.signal,
        isNew: config.ring === 'adopt' && i === 0,
      });
    });
  }

  return result;
}
