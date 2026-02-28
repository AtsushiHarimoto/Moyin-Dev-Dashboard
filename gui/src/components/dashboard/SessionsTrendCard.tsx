/**
 * SessionsTrendCard Component
 * Displays session statistics with line chart
 */

import { motion } from 'framer-motion';
import { LineChart, Line, ResponsiveContainer, Tooltip, YAxis } from 'recharts';

interface SessionsTrendCardProps {
  data: {
    totalSessions: number;
    totalMessages: number;
    thisWeek: number;
    trend: number[];
  };
}

/**
 * SessionsTrendCard component shows session statistics with trend
 * @param data - Sessions statistics data
 */
export function SessionsTrendCard({ data }: SessionsTrendCardProps) {
  const chartData = data.trend.map((count: number, index: number) => ({
    day: `Day ${index + 1}`,
    sessions: count,
  }));

  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="glass-card rounded-2xl p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
            <span className="material-icons text-primary">history</span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-[var(--color-moonlight)]">會話統計</h3>
            <p className="text-xs text-[var(--color-morning-mist)]">最近 7 天</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-2xl font-bold text-[var(--color-moonlight)]">{data.totalSessions}</div>
          <div className="text-xs text-[var(--color-morning-mist)]">總會話數</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-[var(--color-moonlight)]">{data.totalMessages}</div>
          <div className="text-xs text-[var(--color-morning-mist)]">總消息數</div>
        </div>
      </div>

      {chartData.length > 0 && (
        <ResponsiveContainer width="100%" height={120}>
          <LineChart data={chartData}>
            <YAxis hide />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
              }}
            />
            <Line
              type="monotone"
              dataKey="sessions"
              stroke="var(--color-sakura-pink)"
              strokeWidth={3}
              dot={{ fill: 'var(--color-sakura-pink)', r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </motion.div>
  );
}
