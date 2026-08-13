import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import StylePanel from '@/components/map/StylePanel';
import IconLibraryList from '@/components/map/IconLibraryList';
import {
  builtInIconStyleUpdate,
  clearCustomIconStyle,
  isIconLibraryEmpty,
} from '@/lib/icons/stylePanelIconHelpers';
import { canUseIconCanvasEditor } from '@/lib/icons/desktopCapability';
import { createColoredIcon } from '@/components/map/pointIcon';

const listMock = vi.fn();
const removeMock = vi.fn();

vi.mock('@/api/apiClient', () => ({
  api: {
    icons: {
      list: (...args) => listMock(...args),
      remove: (...args) => removeMock(...args),
    },
    media: {
      url: (id) => `/php/photos/get.php?id=${encodeURIComponent(id)}`,
      videoUrl: (id) => `/php/videos/get.php?id=${encodeURIComponent(id)}`,
      uploadVideo: vi.fn(),
      deleteVideo: vi.fn(),
    },
    entities: {
      MapElement: {
        delete: vi.fn(),
      },
    },
  },
}));

vi.mock('@/lib/offline/connectivity', () => ({
  isOnline: vi.fn(() => true),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const ICON_A = {
  id: 'icon-a',
  name: 'Farol',
  url: '/php/icons/get.php?id=icon-a',
};
const ICON_B = {
  id: 'icon-b',
  name: 'Barco',
  url: '/php/icons/get.php?id=icon-b',
};

function renderStylePanel(overrides = {}) {
  const onPreview = vi.fn();
  const onClose = vi.fn();
  const onSave = vi.fn();

  const view = render(
    <StylePanel
      element={{
        id: 'point-1',
        element_type: 'point',
        name: 'Ponto teste',
        style: { icon_name: 'pin', icon_color: '#F97316', custom_icon_url: '' },
        photos: [],
        ...overrides.element,
      }}
      elementCategories={[{ id: 'terra', label: 'Terra' }]}
      onPreview={onPreview}
      onClose={onClose}
      onSave={onSave}
      isMobile={overrides.isMobile ?? false}
      {...overrides.panelProps}
    />,
  );

  return { onPreview, onClose, onSave, ...view };
}

function firstMatchingText(text) {
  const matches = screen.getAllByText(text);
  expect(matches.length).toBeGreaterThan(0);
  return matches[0];
}

async function waitForFirstMatchingText(text) {
  await waitFor(() => {
    expect(screen.getAllByText(text).length).toBeGreaterThan(0);
  });
  return screen.getAllByText(text)[0];
}

function openCustomIconTab() {
  fireEvent.click(screen.getAllByRole('button', { name: 'Próprio' })[0]);
}

describe('stylePanelIconHelpers', () => {
  it('UT-023: empty library array yields empty-state flag true', () => {
    expect(isIconLibraryEmpty([])).toBe(true);
    expect(isIconLibraryEmpty(null)).toBe(true);
    expect(isIconLibraryEmpty([ICON_A])).toBe(false);
  });

  it('UT-041: built-in select helper clears custom_icon_url', () => {
    expect(builtInIconStyleUpdate('circle')).toEqual({
      icon_name: 'circle',
      custom_icon_url: '',
    });
  });

  it('UT-042: clear-custom helper preserves icon_name', () => {
    expect(
      clearCustomIconStyle({
        icon_name: 'pin',
        icon_color: '#f00',
        custom_icon_url: '/php/icons/get.php?id=abc',
      }),
    ).toEqual({
      icon_name: 'pin',
      icon_color: '#f00',
      custom_icon_url: '',
    });
  });
});

describe('IconLibraryList', () => {
  it('UT-043: accepts 200 items without throwing', () => {
    const icons = Array.from({ length: 200 }, (_, index) => ({
      id: `icon-${index}`,
      name: `Ícone ${index}`,
      url: `/php/icons/get.php?id=icon-${index}`,
    }));

    expect(() =>
      render(
        <IconLibraryList
          icons={icons}
          onSelect={() => {}}
          onRemove={() => {}}
        />,
      ),
    ).not.toThrow();

    expect(screen.getAllByRole('button', { name: /Ícone \d+/ })).toHaveLength(200);
  });
});

describe('StylePanel icon library', () => {
  beforeEach(() => {
    listMock.mockReset();
    removeMock.mockReset();
    listMock.mockResolvedValue([ICON_A, ICON_B]);
    removeMock.mockResolvedValue({ ok: true });

    window.innerWidth = 390;
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: query === '(pointer: fine)' ? false : false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  it('E2E-004: gate false hides Desenhar and shows library section', async () => {
    listMock.mockResolvedValue([]);

    renderStylePanel({ isMobile: true });

    expect(screen.queryByRole('button', { name: /desenhar/i })).not.toBeInTheDocument();
    expect(await waitForFirstMatchingText('Ícones')).toBeInTheDocument();
    openCustomIconTab();
    expect(await waitForFirstMatchingText(/Nenhum ícone salvo ainda/i)).toBeInTheDocument();
    expect(canUseIconCanvasEditor()).toBe(false);
  });

  it('fills Detalhamento name from selected SVG/PNG when current name is Element', async () => {
    const view = renderStylePanel({
      element: {
        id: 'point-1',
        element_type: 'point',
        name: 'Element',
        style: { icon_name: 'pin', icon_color: '#F97316', custom_icon_url: '' },
        photos: [],
      },
    });
    await waitFor(() => expect(listMock).toHaveBeenCalled());

    fireEvent.click(screen.getAllByTitle('Casa (SVG)')[0]);

    await waitFor(() => {
      expect(view.onPreview).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Casa', icon_name: '/icons/casa.svg' }),
      );
    });

    openCustomIconTab();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Farol' }))[0]);

    await waitFor(() => {
      expect(view.onPreview).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Farol', custom_icon_url: ICON_A.url }),
      );
    });
  });

  it('E2E-011: apply library icon sets custom_icon_url and list stays available for another point', async () => {
    const first = renderStylePanel();
    await waitFor(() => expect(listMock).toHaveBeenCalled());
    openCustomIconTab();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Farol' }))[0]);

    await waitFor(() => {
      expect(first.onPreview).toHaveBeenCalledWith(
        expect.objectContaining({
          custom_icon_url: ICON_A.url,
        }),
      );
    });

    first.onPreview.mockClear();
    listMock.mockClear();

    const second = renderStylePanel({
      panelProps: {
        element: {
          id: 'point-2',
          element_type: 'point',
          name: 'Outro ponto',
          style: { icon_name: 'pin', icon_color: '#F97316', custom_icon_url: '' },
          photos: [],
        },
      },
    });

    await waitFor(() => {
      expect(listMock).toHaveBeenCalled();
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Próprio' }).slice(-1)[0]);
    const farolButtons = screen.getAllByRole('button', { name: 'Farol' });
    fireEvent.click(farolButtons[farolButtons.length - 1]);

    await waitFor(() => {
      expect(second.onPreview).toHaveBeenCalledWith(
        expect.objectContaining({
          custom_icon_url: ICON_A.url,
        }),
      );
    });
  });

  it('E2E-012: built-in selection clears custom URL while library entry remains', async () => {
    const { onPreview } = renderStylePanel({
      element: {
        id: 'point-1',
        element_type: 'point',
        name: 'Ponto teste',
        style: {
          icon_name: 'pin',
          icon_color: '#F97316',
          custom_icon_url: ICON_A.url,
        },
        photos: [],
      },
    });

    await waitFor(() => expect(listMock).toHaveBeenCalled());
    fireEvent.click(screen.getAllByRole('button', { name: 'Padrão' })[0]);

    const circleButtons = screen.getAllByTitle('Círculo');
    fireEvent.click(circleButtons[0]);

    await waitFor(() => {
      expect(onPreview).toHaveBeenCalledWith(
        expect.objectContaining({
          icon_name: 'circle',
          custom_icon_url: '',
        }),
      );
    });

    openCustomIconTab();
    expect(screen.getAllByRole('button', { name: 'Farol' }).length).toBeGreaterThan(0);

    const previewCalls = onPreview.mock.calls.map(([payload]) => payload);
    const lastPreview = previewCalls[previewCalls.length - 1];
    const previewIcon = createColoredIcon(lastPreview.icon_color, lastPreview.icon_name, lastPreview.custom_icon_url);
    expect(previewIcon.html).not.toContain('<img');
    expect(previewIcon.html).toContain('<svg');
  });

  it('shows hint and disables icon color when custom icon is applied', async () => {
    renderStylePanel({
      element: {
        id: 'point-1',
        element_type: 'point',
        name: 'Ponto teste',
        style: {
          icon_name: 'pin',
          icon_color: '#F97316',
          custom_icon_url: ICON_A.url,
        },
        photos: [],
      },
    });

    await waitFor(() => expect(listMock).toHaveBeenCalled());
    expect(
      screen.getAllByText(/mantêm as cores originais/i).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByLabelText('Cor #F97316')[0]).toBeDisabled();
  });

  it('E2E-013: remove hides icon from library but keeps applied preview URL', async () => {
    const { onPreview } = renderStylePanel({
      element: {
        id: 'point-1',
        element_type: 'point',
        name: 'Ponto teste',
        style: {
          icon_name: 'pin',
          icon_color: '#F97316',
          custom_icon_url: ICON_A.url,
        },
        photos: [],
      },
    });

    await waitFor(() => expect(listMock).toHaveBeenCalled());
    openCustomIconTab();

    const farolButton = screen.getAllByRole('button', { name: 'Farol' })[0];
    const iconCell = farolButton.parentElement;
    expect(iconCell).toBeTruthy();
    const removeButton = within(iconCell).getByTitle('Remover da biblioteca');
    fireEvent.click(removeButton);

    await waitFor(() => {
      expect(removeMock).toHaveBeenCalledWith(ICON_A.id);
    });

    await waitFor(() => {
      expect(screen.queryAllByRole('button', { name: 'Farol' })).toHaveLength(0);
    });

    const previewCalls = onPreview.mock.calls.map(([payload]) => payload);
    const lastPreview = previewCalls[previewCalls.length - 1];
    expect(lastPreview.custom_icon_url).toBe(ICON_A.url);
  });
});
