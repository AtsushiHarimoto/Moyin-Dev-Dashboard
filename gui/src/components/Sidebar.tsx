import React from 'react';
import { useNavigationStore, NavigationMode } from '../stores/useNavigationStore';
import { useI18n } from '../i18n';
import { motion } from 'framer-motion';
import { useReports } from '../hooks/useReports';
import '../styles/sidebar.css';

interface NavItem {
  id: NavigationMode;
  icon: string;
  labelKey: string;
}

const navItems: NavItem[] = [
  { id: 'dashboard', icon: 'dashboard', labelKey: 'sidebar.dashboard' },
  { id: 'progress', icon: 'trending_up', labelKey: 'sidebar.progress' },
  { id: 'skills-docs', icon: 'auto_stories', labelKey: 'sidebar.skillsDocs' },
  { id: 'skills', icon: 'tune', labelKey: 'sidebar.skills' },
  { id: 'sessions', icon: 'history', labelKey: 'sidebar.sessions' },
  { id: 'reports', icon: 'tips_and_updates', labelKey: 'sidebar.reports' },
  { id: 'insights', icon: 'insights', labelKey: 'sidebar.insights' },
  { id: 'issues', icon: 'task_alt', labelKey: 'sidebar.issues' },
  { id: 'wiki', icon: 'menu_book', labelKey: 'sidebar.wiki' },
  { id: 'knowledge', icon: 'school', labelKey: 'sidebar.knowledge' },
];

export function Sidebar() {
  const { currentMode, setMode, sidebarCollapsed, toggleSidebar, sidebarOrder } = useNavigationStore();
  const { t } = useI18n();
  const [showText, setShowText] = React.useState(!sidebarCollapsed);

  // Sort navItems by user-defined order
  const sortedNavItems = React.useMemo(() => {
    const orderMap = new Map(sidebarOrder.map((id, i) => [id, i]));
    return [...navItems].sort((a, b) => (orderMap.get(a.id) ?? 99) - (orderMap.get(b.id) ?? 99));
  }, [sidebarOrder]);

  // Check for unread reports
  const { data: reports = [] } = useReports(false); // active reports only
  const hasUnreadReports = React.useMemo(
    () => reports.some(report => !report.isRead),
    [reports]
  );

  // 控制文字顯示時機
  React.useEffect(() => {
    if (sidebarCollapsed) {
      // 折疊：立即隱藏文字
      setShowText(false);
    } else {
      // 展開：動畫完成後顯示文字
      const timer = setTimeout(() => setShowText(true), 300);
      return () => clearTimeout(timer);
    }
  }, [sidebarCollapsed]);

  return (
    <motion.aside
      className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}
      style={{ minWidth: sidebarCollapsed ? 80 : 260 }}
      animate={{ width: sidebarCollapsed ? 80 : 260, minWidth: sidebarCollapsed ? 80 : 260 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <div className="sidebar-header">
        <div className="sidebar-logo-container">
          <img src="/sakura-logo.svg" alt="Moyin Logo" className="sidebar-logo-img" />
          {showText && (
            <div className="sidebar-logo-text">
              {t('sidebar.brand')}
            </div>
          )}
        </div>

        {/* Toggle Button */}
        <button
          onClick={toggleSidebar}
          className="sidebar-toggle-btn"
          title={sidebarCollapsed ? t('sidebar.expand') : t('sidebar.collapse')}
        >
          <span className="material-icons">
            {sidebarCollapsed ? 'chevron_right' : 'chevron_left'}
          </span>
        </button>
      </div>

      {/* Navigation Section */}
      <nav className="sidebar-nav">
        {sortedNavItems.map((item) => (
          <button
            key={item.id}
            className={`sidebar-nav-item ${currentMode === item.id ? 'active' : ''} ${item.id === 'reports' && hasUnreadReports ? 'has-badge' : ''}`}
            onClick={() => setMode(item.id)}
            title={sidebarCollapsed ? t(item.labelKey) : undefined}
          >
            <span className="material-icons sidebar-nav-icon">{item.icon}</span>
            {showText && (
              <>
                <span className="sidebar-nav-label">{t(item.labelKey)}</span>
                {item.id === 'reports' && hasUnreadReports && (
                  <span className="ml-auto w-1.5 h-1.5 bg-primary rounded-full shadow-[0_0_8px_var(--color-sakura-pink)] hidden lg:block"></span>
                )}
              </>
            )}
            {/* Badge for collapsed state */}
            {sidebarCollapsed && item.id === 'reports' && hasUnreadReports && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full shadow-[0_0_8px_var(--color-sakura-pink)]"></span>
            )}
          </button>
        ))}
      </nav>

      {/* Footer Area - simplified */}
      <div className="sidebar-footer">
        <button
          className={`sidebar-nav-item w-full ${currentMode === 'settings' ? 'active' : ''}`}
          onClick={() => setMode('settings')}
          title={sidebarCollapsed ? t('sidebar.settings') : undefined}
        >
          <span className="material-icons sidebar-nav-icon">settings</span>
          {showText && (
            <span className="sidebar-nav-label">{t('sidebar.settings')}</span>
          )}
        </button>
      </div>
    </motion.aside>
  );
}
