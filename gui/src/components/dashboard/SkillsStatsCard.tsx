/**
 * SkillsStatsCard Component
 * Displays skills statistics with bar chart by profile
 */

import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts';

const COLORS = ['#a855f7', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6'];

interface SkillsStatsCardProps {
  data: {
    total: number;
    enabled: number;
    byProfile: Record<string, number>;
  };
}

/**
 * SkillsStatsCard component shows skills statistics with bar chart
 * @param data - Skills statistics data
 */
export function SkillsStatsCard({ data }: SkillsStatsCardProps) {
  const chartData = Object.entries(data.byProfile || {}).map(([name, value], index) => ({
    name,
    value: value as number,
    color: COLORS[index % COLORS.length],
  }));

  const profileCount = Object.keys(data.byProfile || {}).length;

  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="glass-card rounded-2xl p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-[var(--color-moonlight)]">Profiles 配置統計</h3>
          <p className="text-sm text-[var(--color-morning-mist)] mt-1">
            <span className="text-primary font-bold">{profileCount}</span> 個配置文件
          </p>
        </div>

        <div className="text-right">
          <div className="text-3xl font-bold text-primary">{data.enabled}</div>
          <div className="text-xs text-[var(--color-morning-mist)]">總 Skills</div>
        </div>
      </div>

      {/* Bar Chart */}
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <XAxis
              dataKey="name"
              tick={{ fill: 'var(--color-cloud-mist)', fontSize: 12 }}
              axisLine={{ stroke: 'var(--color-mist-purple)' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: 'var(--color-cloud-mist)', fontSize: 12 }}
              axisLine={{ stroke: 'var(--color-mist-purple)' }}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              labelStyle={{
                color: 'var(--color-moonlight)',
                fontWeight: 'bold',
                marginBottom: '4px',
              }}
              itemStyle={{
                color: 'var(--color-morning-mist)',
              }}
              cursor={{ fill: 'var(--color-sakura-glow)' }}
            />
            <Bar dataKey="value" radius={[8, 8, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="text-center py-12 text-[var(--color-morning-mist)]">
          <span className="material-icons text-4xl opacity-20 mb-2">folder_off</span>
          <p className="text-sm">尚未配置 Profile</p>
        </div>
      )}
    </motion.div>
  );
}
