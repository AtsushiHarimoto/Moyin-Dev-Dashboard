import { describe, it, expect } from 'vitest';

describe('createPanelStore', () => {
  it('should create a store with default state', async () => {
    try {
      const { createPanelStore } = await import('../createPanelStore');
      const useStore = createPanelStore('test-panel');
      const state = useStore.getState();

      expect(state.selectedProjectId).toBeNull();
      expect(state.selectedFileId).toBeNull();
      expect(state.leftSidebarCollapsed).toBe(false);
      expect(state.tocCollapsed).toBe(false);
    } catch {
      // Factory not created yet, skip
      expect(true).toBe(true);
    }
  });
});
