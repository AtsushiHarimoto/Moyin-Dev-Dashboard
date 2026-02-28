import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock document for Node environment
vi.stubGlobal('document', {
  documentElement: {
    setAttribute: vi.fn(),
  },
});

describe('useNavigationStore', () => {
  it('should have default sidebar order', async () => {
    const { useNavigationStore, DEFAULT_SIDEBAR_ORDER } = await import('../useNavigationStore');
    const state = useNavigationStore.getState();
    expect(state.sidebarOrder).toBeDefined();
    expect(Array.isArray(state.sidebarOrder)).toBe(true);
    expect(state.sidebarOrder.length).toBeGreaterThan(0);
    expect(state.sidebarOrder).toEqual(DEFAULT_SIDEBAR_ORDER);
  });

  it('should have theme state defaulting to dark', async () => {
    const { useNavigationStore } = await import('../useNavigationStore');
    const state = useNavigationStore.getState();
    expect(state.theme).toBeDefined();
    expect(state.theme).toBe('dark');
  });

  it('should set theme', async () => {
    const { useNavigationStore } = await import('../useNavigationStore');
    useNavigationStore.getState().setTheme('sakura');
    expect(useNavigationStore.getState().theme).toBe('sakura');
    // Reset
    useNavigationStore.getState().setTheme('dark');
  });

  it('should toggle sidebar', async () => {
    const { useNavigationStore } = await import('../useNavigationStore');
    const initial = useNavigationStore.getState().sidebarCollapsed;
    useNavigationStore.getState().toggleSidebar();
    expect(useNavigationStore.getState().sidebarCollapsed).toBe(!initial);
    // Reset
    useNavigationStore.getState().toggleSidebar();
  });

  it('should set mode', async () => {
    const { useNavigationStore } = await import('../useNavigationStore');
    useNavigationStore.getState().setMode('dashboard');
    expect(useNavigationStore.getState().currentMode).toBe('dashboard');
    // Reset
    useNavigationStore.getState().setMode('skills');
  });

  it('should reset sidebar order', async () => {
    const { useNavigationStore, DEFAULT_SIDEBAR_ORDER } = await import('../useNavigationStore');
    useNavigationStore.getState().setSidebarOrder([]);
    expect(useNavigationStore.getState().sidebarOrder).toEqual([]);
    useNavigationStore.getState().resetSidebarOrder();
    expect(useNavigationStore.getState().sidebarOrder).toEqual(DEFAULT_SIDEBAR_ORDER);
  });
});
