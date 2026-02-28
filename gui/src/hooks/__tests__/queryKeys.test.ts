import { describe, it, expect } from 'vitest';
import { queryKeys } from '../queryKeys';

describe('queryKeys', () => {
  it('should generate unique session keys', () => {
    const key1 = queryKeys.sessions.detail('abc');
    const key2 = queryKeys.sessions.detail('def');
    expect(key1).not.toEqual(key2);
    expect(key1[0]).toBe('sessions');
    expect(key1[1]).toBe('detail');
    expect(key1[2]).toBe('abc');
  });

  it('should generate skills keys', () => {
    const all = queryKeys.skills.all;
    expect(all).toEqual(['skills']);

    const list = queryKeys.skills.list();
    expect(list).toEqual(['skills', 'list']);
  });

  it('should support report filters', () => {
    const active = queryKeys.reports.list(false);
    const archived = queryKeys.reports.list(true);
    expect(active).not.toEqual(archived);
    expect(active[2]).toEqual({ archived: false });
    expect(archived[2]).toEqual({ archived: true });
  });

  it('should generate wiki keys', () => {
    const tree = queryKeys.wiki.tree('guides');
    expect(tree).toEqual(['wiki', 'tree', 'guides']);

    const content = queryKeys.wiki.content('page-1');
    expect(content).toEqual(['wiki', 'content', 'page-1']);
  });

  it('should generate dashboard keys', () => {
    expect(queryKeys.dashboard.stats()).toEqual(['dashboard', 'stats']);
    expect(queryKeys.dashboard.health()).toEqual(['dashboard', 'health']);
  });

  it('should generate message keys', () => {
    expect(queryKeys.messages.all).toEqual(['messages']);
    expect(queryKeys.messages.bySession('s1')).toEqual(['messages', 's1']);
    expect(queryKeys.messages.search('hello')).toEqual(['messages', 'search', 'hello']);
  });

  it('should generate session list keys with filters', () => {
    const withFilter = queryKeys.sessions.list({ status: 'active' });
    const noFilter = queryKeys.sessions.list();
    expect(withFilter).not.toEqual(noFilter);
    expect(withFilter[0]).toBe('sessions');
    expect(withFilter[1]).toBe('list');
  });
});
