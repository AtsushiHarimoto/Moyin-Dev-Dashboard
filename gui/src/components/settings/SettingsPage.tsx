import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
  type Modifier,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useNavigationStore, DEFAULT_SIDEBAR_ORDER, THEMES, type NavigationMode, type ThemeId } from '../../stores/useNavigationStore';
import { useI18n, type Locale } from '../../i18n';
import { useEmailStatus, useSendTestEmail } from '../../hooks/useAnalysis';
import { toast } from '../common/Toast';

const restrictToVerticalAxis: Modifier = ({ transform }) => ({
  ...transform,
  x: 0,
});

// ── Nav item metadata ───────────────────────────────────────────────────────

const NAV_META: Record<string, { icon: string; labelKey: string }> = {
  dashboard:     { icon: 'dashboard',        labelKey: 'sidebar.dashboard' },
  progress:      { icon: 'trending_up',      labelKey: 'sidebar.progress' },
  'skills-docs': { icon: 'auto_stories',     labelKey: 'sidebar.skillsDocs' },
  skills:        { icon: 'tune',             labelKey: 'sidebar.skills' },
  sessions:      { icon: 'history',          labelKey: 'sidebar.sessions' },
  reports:       { icon: 'tips_and_updates', labelKey: 'sidebar.reports' },
  insights:      { icon: 'insights',         labelKey: 'sidebar.insights' },
  issues:        { icon: 'task_alt',         labelKey: 'sidebar.issues' },
  wiki:          { icon: 'menu_book',        labelKey: 'sidebar.wiki' },
  knowledge:     { icon: 'school',           labelKey: 'sidebar.knowledge' },
};

// ── Sortable Item ───────────────────────────────────────────────────────────

function SortableNavItem({ id, icon, label, index }: { id: string; icon: string; label: string; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.25 : 1,
      }}
      className="flex items-center gap-3 px-3 py-2 rounded-lg transition-all group"
      {...attributes}
      {...listeners}
    >
      <span
        className="text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded shrink-0"
        style={{ color: 'var(--color-cloud-mist)', background: 'color-mix(in srgb, var(--color-sakura-pink) 8%, transparent)' }}
      >
        {index + 1}
      </span>
      <span
        className="material-icons text-sm cursor-grab active:cursor-grabbing shrink-0 opacity-30 group-hover:opacity-80 transition-opacity"
        style={{ color: 'var(--color-morning-mist)' }}
      >
        drag_indicator
      </span>
      <span className="material-icons text-base shrink-0" style={{ color: 'var(--color-sakura-pink)' }}>
        {icon}
      </span>
      <span className="text-sm" style={{ color: 'var(--color-moonlight)' }}>
        {label}
      </span>
    </div>
  );
}

// ── Static row for overlay (no hooks) ───────────────────────────────────────

function OverlayRow({ icon, label }: { icon: string; label: string }) {
  return (
    <div
      className="flex items-center gap-3 px-3 py-2 rounded-lg"
      style={{
        background: 'color-mix(in srgb, var(--color-sakura-pink) 20%, transparent)',
        border: '1.5px solid color-mix(in srgb, var(--color-sakura-pink) 50%, transparent)',
        boxShadow: '0 8px 24px color-mix(in srgb, var(--color-sakura-pink) 30%, transparent)',
      }}
    >
      <span className="text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded shrink-0"
        style={{ color: 'var(--color-moonlight)', background: 'color-mix(in srgb, var(--color-sakura-pink) 30%, transparent)' }}>⠿</span>
      <span className="material-icons text-sm" style={{ color: 'var(--color-sakura-pink)' }}>drag_indicator</span>
      <span className="material-icons text-base" style={{ color: 'var(--color-sakura-pink)' }}>{icon}</span>
      <span className="text-sm font-semibold" style={{ color: 'var(--color-moonlight)' }}>{label}</span>
    </div>
  );
}

// ── Preview Sidebar ─────────────────────────────────────────────────────────

function SidebarPreview({ order, t }: { order: NavigationMode[]; t: (key: string) => string }) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'color-mix(in srgb, var(--color-surface-dark) 70%, transparent)', border: '1px solid var(--color-glass-border)', width: 200 }}
    >
      <div className="px-3 py-2 flex items-center gap-2" style={{ borderBottom: '1px solid var(--color-glass-border)' }}>
        <div className="w-5 h-5 rounded-full" style={{ background: 'color-mix(in srgb, var(--color-sakura-pink) 30%, transparent)' }} />
        <span className="text-[11px] font-bold" style={{ color: 'var(--color-moonlight)' }}>{t('sidebar.brand')}</span>
      </div>
      <div className="py-1.5 px-1.5">
        {order.map((id) => {
          const meta = NAV_META[id];
          if (!meta) return null;
          return (
            <div key={id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-md" style={{ transition: 'all 0.15s ease' }}>
              <span className="material-icons" style={{ color: 'var(--color-morning-mist)', fontSize: 14 }}>{meta.icon}</span>
              <span className="text-[11px]" style={{ color: 'var(--color-morning-mist)' }}>{t(meta.labelKey)}</span>
            </div>
          );
        })}
      </div>
      <div className="px-1.5 py-1.5" style={{ borderTop: '1px solid var(--color-glass-border)' }}>
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md">
          <span className="material-icons" style={{ color: 'var(--color-cloud-mist)', fontSize: 14 }}>settings</span>
          <span className="text-[11px]" style={{ color: 'var(--color-cloud-mist)' }}>{t('sidebar.settings')}</span>
        </div>
      </div>
    </div>
  );
}

// ── Email Settings Section ──────────────────────────────────────────────────

function EmailSettingsSection() {
  const { t } = useI18n();
  const { data: emailStatus, isLoading } = useEmailStatus();
  const { mutate: sendTest, isPending } = useSendTestEmail();

  const handleTest = () => {
    sendTest(undefined, {
      onSuccess: () => toast.success(t('settings.email.testSent')),
      onError: () => toast.error(t('settings.email.testFailed')),
    });
  };

  return (
    <section
      className="rounded-2xl p-6"
      style={{ background: 'var(--color-glass-bg)', border: '1px solid var(--color-glass-border)' }}
    >
      <div className="flex items-center gap-2 mb-4">
        <span className="material-icons text-base" style={{ color: 'var(--color-sakura-pink)' }}>email</span>
        <h2 className="text-sm font-bold" style={{ color: 'var(--color-moonlight)' }}>{t('settings.email')}</h2>
      </div>

      {isLoading ? (
        <p className="text-xs" style={{ color: 'var(--color-cloud-mist)' }}>Loading...</p>
      ) : emailStatus?.configured ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-sakura-pink)' }}>
            <span className="material-icons text-sm">check_circle</span>
            <span>Gmail: {emailStatus.from} → {emailStatus.to}</span>
            <span className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: 'color-mix(in srgb, var(--color-sakura-pink) 15%, transparent)' }}>
              {t('settings.email.configured')}
            </span>
          </div>
          <button
            type="button"
            onClick={handleTest}
            disabled={isPending}
            className="px-4 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              background: isPending ? 'var(--color-mist-purple)' : 'color-mix(in srgb, var(--color-sakura-pink) 15%, transparent)',
              border: '1px solid color-mix(in srgb, var(--color-sakura-pink) 30%, transparent)',
              color: 'var(--color-morning-mist)',
              cursor: isPending ? 'not-allowed' : 'pointer',
            }}
          >
            {isPending ? '...' : t('settings.email.sendTest')}
          </button>
        </div>
      ) : (
        <div className="text-xs" style={{ color: 'var(--color-cloud-mist)' }}>
          <span className="material-icons text-sm align-middle mr-1">error_outline</span>
          {t('settings.email.notConfigured')}
        </div>
      )}

      <p className="text-[10px] mt-3" style={{ color: 'var(--color-cloud-mist)' }}>
        {t('settings.email.hint')}
      </p>
    </section>
  );
}

// ── Settings Page ───────────────────────────────────────────────────────────

export function SettingsPage() {
  const { sidebarOrder, setSidebarOrder, resetSidebarOrder, theme, setTheme } = useNavigationStore();
  const { t, locale, setLocale } = useI18n();
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = sidebarOrder.indexOf(active.id as NavigationMode);
    const newIdx = sidebarOrder.indexOf(over.id as NavigationMode);
    if (oldIdx === -1 || newIdx === -1) return;
    setSidebarOrder(arrayMove(sidebarOrder, oldIdx, newIdx));
  };

  const isDefault = sidebarOrder.every((id, i) => id === DEFAULT_SIDEBAR_ORDER[i]);
  const activeMeta = activeId ? NAV_META[activeId] : null;

  return (
    <div className="h-full overflow-y-auto" style={{ minHeight: 'calc(100vh - 64px)' }}>
      <div className="p-8 lg:p-12 max-w-5xl mx-auto space-y-8">

        {/* Page Header */}
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="material-icons text-xl" style={{ color: 'var(--color-sakura-pink)' }}>settings</span>
            <h1 className="text-xl font-bold" style={{ color: 'var(--color-moonlight)', fontFamily: 'var(--font-serif)' }}>
              {t('sidebar.settings')}
            </h1>
          </div>
          <p className="text-xs" style={{ color: 'var(--color-cloud-mist)' }}>{t('settings.subtitle')}</p>
        </div>

        {/* ── Sidebar Order ── */}
        <section
          className="rounded-2xl p-6"
          style={{ background: 'var(--color-glass-bg)', border: '1px solid var(--color-glass-border)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="material-icons text-base" style={{ color: 'var(--color-sakura-pink)' }}>reorder</span>
              <h2 className="text-sm font-bold" style={{ color: 'var(--color-moonlight)' }}>{t('settings.sidebarOrder')}</h2>
              <span className="text-xs" style={{ color: 'var(--color-cloud-mist)' }}>{t('settings.sidebarOrderHint')}</span>
            </div>
            <button
              onClick={resetSidebarOrder}
              disabled={isDefault}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition-all"
              style={{
                background: isDefault ? 'transparent' : 'color-mix(in srgb, var(--color-sakura-pink) 10%, transparent)',
                border: `1px solid ${isDefault ? 'var(--color-glass-border)' : 'color-mix(in srgb, var(--color-sakura-pink) 30%, transparent)'}`,
                color: isDefault ? 'var(--color-cloud-mist)' : 'var(--color-morning-mist)',
                cursor: isDefault ? 'default' : 'pointer',
                opacity: isDefault ? 0.4 : 1,
              }}
            >
              <span className="material-icons text-xs">restart_alt</span>
              {t('settings.reset')}
            </button>
          </div>

          <div className="flex gap-6 items-start">
            {/* Left: Drag list */}
            <div className="flex-1 min-w-0">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={[restrictToVerticalAxis]}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={sidebarOrder} strategy={verticalListSortingStrategy}>
                  <div
                    className="rounded-xl p-1.5 space-y-0.5"
                    style={{ background: 'color-mix(in srgb, var(--color-dark-purple) 40%, transparent)', border: '1px solid color-mix(in srgb, var(--color-sakura-pink) 8%, transparent)' }}
                  >
                    {sidebarOrder.map((id, idx) => {
                      const meta = NAV_META[id];
                      if (!meta) return null;
                      return <SortableNavItem key={id} id={id} icon={meta.icon} label={t(meta.labelKey)} index={idx} />;
                    })}
                  </div>
                </SortableContext>

                {/* Portal the overlay to document.body so backdrop-filter doesn't break positioning */}
                {createPortal(
                  <DragOverlay dropAnimation={null}>
                    {activeMeta ? <OverlayRow icon={activeMeta.icon} label={t(activeMeta.labelKey)} /> : null}
                  </DragOverlay>,
                  document.body,
                )}
              </DndContext>
            </div>

            {/* Right: Live preview */}
            <div className="shrink-0 hidden lg:block">
              <p className="text-[10px] mb-2 text-center" style={{ color: 'var(--color-cloud-mist)' }}>{t('settings.livePreview')}</p>
              <SidebarPreview order={sidebarOrder} t={t} />
            </div>
          </div>
        </section>

        {/* ── Theme ── */}
        <section
          className="rounded-2xl p-6"
          style={{ background: 'var(--color-glass-bg)', border: '1px solid var(--color-glass-border)' }}
        >
          <div className="flex items-center gap-2 mb-5">
            <span className="material-icons text-base" style={{ color: 'var(--color-sakura-pink)' }}>palette</span>
            <h2 className="text-sm font-bold" style={{ color: 'var(--color-moonlight)' }}>{t('settings.theme')}</h2>
            <span className="text-xs" style={{ color: 'var(--color-cloud-mist)' }}>{t('settings.themeHint')}</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {THEMES.map((themeItem) => {
              const active = theme === themeItem.id;
              return (
                <button
                  key={themeItem.id}
                  onClick={() => setTheme(themeItem.id as ThemeId)}
                  className="relative flex flex-col items-center gap-2 p-4 rounded-xl transition-all group"
                  style={{
                    background: active ? `${themeItem.primary}18` : 'color-mix(in srgb, var(--color-dark-purple) 40%, transparent)',
                    border: `1.5px solid ${active ? `${themeItem.primary}80` : 'color-mix(in srgb, var(--color-sakura-pink) 8%, transparent)'}`,
                    cursor: 'pointer',
                  }}
                >
                  {/* Color preview circle */}
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center transition-transform group-hover:scale-110"
                    style={{
                      background: themeItem.bg,
                      border: `2px solid ${themeItem.primary}`,
                      boxShadow: active ? `0 0 16px ${themeItem.primary}60` : 'none',
                    }}
                  >
                    <span className="material-icons text-lg" style={{ color: themeItem.primary }}>{themeItem.icon}</span>
                  </div>
                  {/* Label */}
                  <span
                    className="text-xs font-medium"
                    style={{ color: active ? themeItem.primary : 'var(--color-morning-mist)' }}
                  >
                    {t(`settings.theme.${themeItem.id}`)}
                  </span>
                  {/* Active check */}
                  {active && (
                    <span
                      className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: themeItem.primary }}
                    >
                      <span className="material-icons text-xs" style={{ color: themeItem.bg }}>check</span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Language ── */}
        <section
          className="rounded-2xl p-6"
          style={{ background: 'var(--color-glass-bg)', border: '1px solid var(--color-glass-border)' }}
        >
          <div className="flex items-center gap-2 mb-4">
            <span className="material-icons text-base" style={{ color: 'var(--color-sakura-pink)' }}>translate</span>
            <h2 className="text-sm font-bold" style={{ color: 'var(--color-moonlight)' }}>{t('settings.language')}</h2>
          </div>
          <div className="flex gap-3">
            {([['zh-TW', '繁體中文', '🇹🇼'], ['en', 'English', '🇺🇸']] as const).map(([code, label, flag]) => {
              const active = locale === code;
              return (
                <button
                  key={code}
                  onClick={() => setLocale(code as Locale)}
                  className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm transition-all"
                  style={{
                    background: active ? 'color-mix(in srgb, var(--color-sakura-pink) 15%, transparent)' : 'color-mix(in srgb, var(--color-dark-purple) 40%, transparent)',
                    border: `1.5px solid ${active ? 'color-mix(in srgb, var(--color-sakura-pink) 50%, transparent)' : 'color-mix(in srgb, var(--color-sakura-pink) 8%, transparent)'}`,
                    color: active ? 'var(--color-moonlight)' : 'var(--color-morning-mist)',
                    cursor: 'pointer',
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  <span>{flag}</span>
                  {label}
                  {active && <span className="material-icons text-xs" style={{ color: 'var(--color-sakura-pink)' }}>check</span>}
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Email ── */}
        <EmailSettingsSection />

        {/* ── About ── */}
        <section
          className="rounded-2xl p-6"
          style={{ background: 'var(--color-glass-bg)', border: '1px solid var(--color-glass-border)' }}
        >
          <div className="flex items-center gap-2 mb-4">
            <span className="material-icons text-base" style={{ color: 'var(--color-sakura-pink)' }}>info</span>
            <h2 className="text-sm font-bold" style={{ color: 'var(--color-moonlight)' }}>{t('settings.about')}</h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {[[t('settings.about.appName'), t('settings.about.appValue')], [t('settings.about.version'), 'v1.0.0'], [t('settings.about.techStack'), 'React + TypeScript + Vite']].map(([l, v]) => (
              <div key={l}>
                <p className="text-[10px] mb-0.5" style={{ color: 'var(--color-cloud-mist)' }}>{l}</p>
                <p className="text-xs font-medium" style={{ color: 'var(--color-morning-mist)' }}>{v}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
