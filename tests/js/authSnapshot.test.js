import { afterEach, describe, expect, it } from 'vitest';
import {
  clearAuthSnapshot,
  loadAuthSnapshot,
  saveAuthSnapshot,
  shouldKeepLocalSession,
} from '@/lib/offline/authSnapshot';

describe('auth snapshot', () => {
  afterEach(() => {
    clearAuthSnapshot();
  });

  it('persists the user until explicit logout', () => {
    saveAuthSnapshot({ id: 'u1', username: 'ana' });
    expect(loadAuthSnapshot()).toEqual({ id: 'u1', username: 'ana' });
    expect(shouldKeepLocalSession(loadAuthSnapshot())).toBe(true);
  });

  it('keeps the local session even when the next auth check would 401', () => {
    const snapshot = { id: 'u1', username: 'ana' };
    expect(shouldKeepLocalSession(snapshot)).toBe(true);
    expect(shouldKeepLocalSession(null)).toBe(false);
  });

  it('clears only when the user clicks Sair', () => {
    saveAuthSnapshot({ id: 'u1' });
    clearAuthSnapshot();
    expect(loadAuthSnapshot()).toBeNull();
    expect(shouldKeepLocalSession(loadAuthSnapshot())).toBe(false);
  });
});
