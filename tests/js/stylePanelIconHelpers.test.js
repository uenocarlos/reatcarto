import { describe, expect, it } from 'vitest';
import { ICON_NAME_FALLBACK } from '@/lib/icons/constants';
import {
  cleanIconLabelForElementName,
  resolveElementNameFromIcon,
  resolveSuggestedIconEditorName,
  shouldSyncElementNameFromIcon,
} from '@/lib/icons/stylePanelIconHelpers';

const builtInIcons = [
  { name: 'pin', label: 'Pin Padrão' },
  { name: 'circle', label: 'Círculo' },
];

const libraryIcons = [
  { id: '1', name: 'Farol', url: '/php/icons/get.php?id=1' },
];

describe('resolveSuggestedIconEditorName', () => {
  it('uses the selected library icon name', () => {
    expect(
      resolveSuggestedIconEditorName({
        customIconUrl: '/php/icons/get.php?id=1',
        iconName: 'pin',
        libraryIcons,
        builtInIcons,
      }),
    ).toBe('Farol');
  });

  it('uses the built-in icon label when no custom icon is selected', () => {
    expect(
      resolveSuggestedIconEditorName({
        customIconUrl: '',
        iconName: 'circle',
        libraryIcons,
        builtInIcons,
      }),
    ).toBe('Círculo');
  });

  it('falls back when nothing is selected', () => {
    expect(resolveSuggestedIconEditorName()).toBe(ICON_NAME_FALLBACK);
  });

  it('cleans SVG suffix and derives casa.svg / home labels', () => {
    expect(cleanIconLabelForElementName('Casa (SVG)')).toBe('Casa');
    expect(
      resolveElementNameFromIcon({
        iconName: '/icons/casa.svg',
        builtInIcons: [{ name: '/icons/casa.svg', label: 'Casa (SVG)' }],
      }),
    ).toBe('Casa');
    expect(
      resolveElementNameFromIcon({
        iconName: 'home',
        builtInIcons: [{ name: 'home', label: 'Casa' }],
      }),
    ).toBe('Casa');
    expect(
      resolveElementNameFromIcon({
        libraryIcon: { name: 'casa' },
      }),
    ).toBe('casa');
  });

  it('syncs placeholder Element but keeps a custom typed name', () => {
    expect(shouldSyncElementNameFromIcon('Element', 'Pin Padrão')).toBe(true);
    expect(shouldSyncElementNameFromIcon('', 'Casa')).toBe(true);
    expect(shouldSyncElementNameFromIcon('Casa', 'Casa')).toBe(true);
    expect(shouldSyncElementNameFromIcon('Minha casa', 'Casa')).toBe(false);
  });
});
