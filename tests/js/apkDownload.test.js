import { describe, expect, it } from 'vitest';
import { APK_DOWNLOAD_PATH, APK_PUBLIC_ORIGIN, getApkDownloadUrl, getApkQrUrl } from '@/lib/apkDownload';

describe('apkDownload urls', () => {
  it('keeps a relative download path for same-origin requests', () => {
    expect(getApkDownloadUrl('')).toBe(APK_DOWNLOAD_PATH);
    expect(getApkDownloadUrl('https://reatcarto.furg.br:8443')).toBe(
      `https://reatcarto.furg.br:8443${APK_DOWNLOAD_PATH}`
    );
  });

  it('points the QR code at production when the page is local', () => {
    expect(getApkQrUrl('http://localhost:5173')).toBe(`${APK_PUBLIC_ORIGIN}${APK_DOWNLOAD_PATH}`);
    expect(getApkQrUrl('https://reatcarto.furg.br:8443')).toBe(
      `https://reatcarto.furg.br:8443${APK_DOWNLOAD_PATH}`
    );
  });
});
