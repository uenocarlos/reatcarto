import React from 'react';
import { Capacitor } from '@capacitor/core';
import { Download, Smartphone } from 'lucide-react';
import { APK_DOWNLOAD_PATH, APK_QR_IMAGE_PATH } from '@/lib/apkDownload';

export default function ApkDownloadCard() {
  if (Capacitor.isNativePlatform()) {
    return null;
  }

  return (
    <div className="mt-6 pt-5 border-t text-center space-y-3">
      <p className="text-sm font-medium flex items-center justify-center gap-2">
        <Smartphone className="w-4 h-4" aria-hidden="true" />
        App Android
      </p>
      <img
        src={APK_QR_IMAGE_PATH}
        alt="QR Code para baixar o aplicativo Android"
        width={168}
        height={168}
        className="mx-auto rounded-md bg-white p-1 border hidden sm:block"
      />
      <p className="text-xs text-muted-foreground hidden sm:block">
        Aponte a câmera do celular para instalar
      </p>
      <a
        href={APK_DOWNLOAD_PATH}
        download="ReatCarto.apk"
        className="inline-flex items-center justify-center gap-2 text-sm font-medium text-primary underline"
      >
        <Download className="w-4 h-4" aria-hidden="true" />
        Baixar aplicativo Android
      </a>
    </div>
  );
}
