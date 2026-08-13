import { describe, expect, it } from 'vitest';
import { iconNameFromFileName } from '@/lib/icons/prepareIconUpload';

describe('prepareIconUpload helpers', () => {
  it('derives icon name from file name without extension', () => {
    expect(iconNameFromFileName('Farol.png')).toBe('Farol');
    expect(iconNameFromFileName('meu-icone.JPEG')).toBe('meu-icone');
    expect(iconNameFromFileName('  ')).toBe('');
  });
});
