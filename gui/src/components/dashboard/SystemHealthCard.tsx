/**
 * SystemHealthCard Component
 * Displays system health status
 */

import { StatCard } from './StatCard';

interface SystemHealthCardProps {
  data: {
    status: string;
    databases: {
      sessions: boolean;
      skills: boolean;
      wiki: boolean;
    };
    uptime: number;
  };
}

/**
 * SystemHealthCard component shows system health status
 * @param data - System health data
 */
export function SystemHealthCard({ data }: SystemHealthCardProps) {
  const allHealthy = data.databases.sessions && data.databases.skills && data.databases.wiki;

  return (
    <StatCard
      title="系統健康"
      value={allHealthy ? '正常運行' : '異常'}
      icon={allHealthy ? 'check_circle' : 'error'}
      color={allHealthy ? 'success' : 'danger'}
    />
  );
}
