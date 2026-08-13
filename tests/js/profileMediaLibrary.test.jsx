import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProfileMediaLibrary from '@/components/profile/ProfileMediaLibrary';

const listPhotosMock = vi.fn();
const listVideosMock = vi.fn();
const deletePhotoMock = vi.fn();
const deleteVideoMock = vi.fn();
const listIconsMock = vi.fn();
const removeIconMock = vi.fn();
const isOnlineMock = vi.fn(() => true);

vi.mock('@/lib/offline/connectivity', () => ({
  isOnline: (...args) => isOnlineMock(...args),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/api/apiClient', () => ({
  api: {
    media: {
      listPhotos: (...args) => listPhotosMock(...args),
      listVideos: (...args) => listVideosMock(...args),
      delete: (...args) => deletePhotoMock(...args),
      deleteVideo: (...args) => deleteVideoMock(...args),
      url: (id) => `/php/photos/get.php?id=${encodeURIComponent(id)}`,
      videoUrl: (id) => `/php/videos/get.php?id=${encodeURIComponent(id)}`,
    },
    icons: {
      list: (...args) => listIconsMock(...args),
      remove: (...args) => removeIconMock(...args),
    },
  },
  ApiError: class ApiError extends Error {
    constructor(code, message, status = 400) {
      super(message);
      this.code = code;
      this.status = status;
    }
  },
}));

const PHOTO = {
  id: 'photo-1',
  version: 1,
  byte_size: 2048,
  created_at: '2026-08-01T12:00:00.000Z',
  url: '/php/photos/get.php?id=photo-1',
  element_id: 'el-1',
  element_name: 'Farol',
  map_id: 'map-1',
  map_name: 'Ilha',
};

const VIDEO = {
  id: 'video-1',
  version: 1,
  byte_size: 1024 * 1024,
  created_at: '2026-08-02T12:00:00.000Z',
  url: '/php/videos/get.php?id=video-1',
  element_id: 'el-2',
  element_name: 'Doca',
  map_id: 'map-2',
  map_name: 'Porto',
};

const ICON = {
  id: 'icon-1',
  name: 'Boia',
  byte_size: 128,
  created_at: '2026-08-03T12:00:00.000Z',
  url: '/php/icons/get.php?id=icon-1',
};

function renderLibrary() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ProfileMediaLibrary />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ProfileMediaLibrary', () => {
  beforeEach(() => {
    isOnlineMock.mockReturnValue(true);
    listPhotosMock.mockReset();
    listVideosMock.mockReset();
    listIconsMock.mockReset();
    deletePhotoMock.mockReset();
    deleteVideoMock.mockReset();
    removeIconMock.mockReset();
    listPhotosMock.mockResolvedValue({
      photos: [PHOTO],
      pagination: { page: 1, page_size: 50, total: 1, total_pages: 1 },
    });
    listVideosMock.mockResolvedValue({
      videos: [VIDEO],
      pagination: { page: 1, page_size: 50, total: 1, total_pages: 1 },
    });
    listIconsMock.mockResolvedValue([ICON]);
    deletePhotoMock.mockResolvedValue({ success: true, deleted: true });
    deleteVideoMock.mockResolvedValue({ success: true, deleted: true });
    removeIconMock.mockResolvedValue({ success: true, removed: true });
  });

  it('lists photos, videos and icons with usage context', async () => {
    const user = userEvent.setup();
    renderLibrary();

    expect(await screen.findByText('Meus arquivos')).toBeInTheDocument();
    expect(await screen.findByText('Farol · Ilha')).toBeInTheDocument();
    expect(await screen.findByRole('tab', { name: 'Fotos (1)' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir mapa' })).toHaveAttribute('href', '/editor/map-1');

    await user.click(await screen.findByRole('tab', { name: 'Vídeos (1)' }));
    expect(await screen.findByText('Doca · Porto')).toBeInTheDocument();

    await user.click(await screen.findByRole('tab', { name: 'Ícones (1)' }));
    expect(await screen.findByText('Boia')).toBeInTheDocument();
  });

  it('shows empty states when the user has no media', async () => {
    const user = userEvent.setup();
    listPhotosMock.mockResolvedValue({
      photos: [],
      pagination: { page: 1, page_size: 50, total: 0, total_pages: 0 },
    });
    listVideosMock.mockResolvedValue({
      videos: [],
      pagination: { page: 1, page_size: 50, total: 0, total_pages: 0 },
    });
    listIconsMock.mockResolvedValue([]);

    renderLibrary();

    expect(await screen.findByText('Nenhuma foto ainda')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Vídeos (0)' }));
    expect(await screen.findByText('Nenhum vídeo ainda')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Ícones (0)' }));
    expect(await screen.findByText('Nenhum ícone na biblioteca')).toBeInTheDocument();
  });

  it('asks for confirmation before deleting a photo', async () => {
    const user = userEvent.setup();
    renderLibrary();

    const photoTitle = await screen.findByText('Farol · Ilha');
    const photoCard = photoTitle.closest('div.flex.gap-3');
    await user.click(within(photoCard).getByRole('button', { name: 'Excluir' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Excluir esta foto?')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Excluir' }));

    await waitFor(() => {
      expect(deletePhotoMock).toHaveBeenCalledWith('photo-1', 1);
    });
  });

  it('removes an icon from the library after confirmation', async () => {
    const user = userEvent.setup();
    renderLibrary();

    await user.click(await screen.findByRole('tab', { name: 'Ícones (1)' }));
    const iconTitle = await screen.findByText('Boia');
    const iconCard = iconTitle.closest('div.flex.gap-3');
    await user.click(within(iconCard).getByRole('button', { name: 'Excluir' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Remover este ícone da biblioteca?')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Excluir' }));

    await waitFor(() => {
      expect(removeIconMock).toHaveBeenCalledWith('icon-1');
    });
  });

  it('explains offline mode instead of loading media', () => {
    isOnlineMock.mockReturnValue(false);
    renderLibrary();

    expect(screen.getByText('Conecte-se à internet para gerenciar seus arquivos.')).toBeInTheDocument();
    expect(listPhotosMock).not.toHaveBeenCalled();
    expect(listVideosMock).not.toHaveBeenCalled();
    expect(listIconsMock).not.toHaveBeenCalled();
  });
});
