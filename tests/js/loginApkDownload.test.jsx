import React from 'react';
import { Capacitor } from '@capacitor/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from '@/page/Login';
import { APK_DOWNLOAD_PATH, APK_QR_IMAGE_PATH } from '@/lib/apkDownload';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => false),
  },
}));

describe('Login APK download', () => {
  afterEach(() => {
    Capacitor.isNativePlatform.mockReturnValue(false);
  });

  it('shows a QR code and Android download link on the web login page', () => {
    render(
      <MemoryRouter>
        <Login onLoginSuccess={vi.fn()} />
      </MemoryRouter>
    );

    const link = screen.getByRole('link', { name: 'Baixar aplicativo Android' });
    expect(link).toHaveAttribute('href', APK_DOWNLOAD_PATH);
    expect(link).toHaveAttribute('download', 'ReatCarto.apk');
    expect(screen.getByAltText('QR Code para baixar o aplicativo Android')).toHaveAttribute(
      'src',
      APK_QR_IMAGE_PATH
    );
  });

  it('hides the Android download on the native app', () => {
    Capacitor.isNativePlatform.mockReturnValue(true);

    render(
      <MemoryRouter>
        <Login onLoginSuccess={vi.fn()} />
      </MemoryRouter>
    );

    expect(screen.queryByRole('link', { name: 'Baixar aplicativo Android' })).not.toBeInTheDocument();
  });
});
