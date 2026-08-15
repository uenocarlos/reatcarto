export const APK_DOWNLOAD_PATH = '/php/download-apk.php';
export const APK_QR_IMAGE_PATH = '/apk/qrcode.svg';
export const APK_PUBLIC_ORIGIN = 'https://200.132.255.26';

export function getApkDownloadUrl(origin = typeof window !== 'undefined' ? window.location.origin : '') {
  const host = origin.replace(/\/$/, '');
  return host ? `${host}${APK_DOWNLOAD_PATH}` : APK_DOWNLOAD_PATH;
}

export function getApkQrUrl(origin = typeof window !== 'undefined' ? window.location.origin : APK_PUBLIC_ORIGIN) {
  const host = /localhost|127\.0\.0\.1/i.test(origin) ? APK_PUBLIC_ORIGIN : origin.replace(/\/$/, '');
  return `${host}${APK_DOWNLOAD_PATH}`;
}
