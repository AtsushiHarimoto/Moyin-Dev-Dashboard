/**
 * StatCard Component
 * Generic card component for displaying statistics
 */

import { motion } from 'framer-motion';
import clsx from 'clsx';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: string;
  trend?: {
    value: number;
    direction: 'up' | 'down';
  };
  color?: 'primary' | 'success' | 'warning' | 'danger';
  onClick?: () => void;
  className?: string;
}

/**
 * StatCard component for displaying a single statistic
 * @param title - Card title
 * @param value - Main value to display
 * @param icon - Material icon name
 * @param trend - Optional trend indicator
 * @param color - Color theme
 * @param onClick - Optional click handler
 * @param className - Additional CSS classes
 */
export function StatCard({ title, value, icon, trend, color = 'primary', onClick, className }: StatCardProps) {
  const colorClasses = {
    primary: 'bg-primary/20 text-primary',
    success: 'bg-green-500/20 text-green-400',
    warning: 'bg-orange-500/20 text-orange-400',
    danger: 'bg-red-500/20 text-red-400',
  };

  return (
    <motion.div
      whileHover={{ y: onClick ? -4 : 0 }}
      className={clsx(
        'glass-card rounded-2xl p-6',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center', colorClasses[color])}>
            <span className="material-icons">{icon}</span>
          </div>
          <h3 className="text-sm text-[var(--color-morning-mist)]">{title}</h3>
        </div>

        {trend && (
          <div className={clsx(
            'flex items-center gap-1',
            trend.direction === 'up' ? 'text-green-400' : 'text-red-400'
          )}>
            <span className="material-icons text-xs">
              {trend.direction === 'up' ? 'trending_up' : 'trending_down'}
            </span>
            <span className="text-xs font-bold">{Math.abs(trend.value)}%</span>
          </div>
        )}
      </div>

      <div className="text-3xl font-bold text-[var(--color-moonlight)]">{value}</div>
    </motion.div>
  );
}
