import React, { useState } from 'react';
import { buildInstitutionalFooterContent, LOGO_PATH } from '@/lib/export/institutionalFooter';

export default function InstitutionalFooter({ settings, boundaryMeta, narrow = false }) {
  const content = boundaryMeta ?? buildInstitutionalFooterContent(settings);
  const [logoFailed, setLogoFailed] = useState(false);

  return (
    <div
      className="px-2 sm:px-4 py-1 sm:py-2 bg-white flex-shrink-0 flex justify-between items-end border-t border-amber-500/20"
      data-testid="export-institutional-footer"
    >
      <div
        className={`${narrow ? 'text-[6px]' : 'text-[6px] sm:text-[8px]'} text-gray-600 leading-tight max-w-[70%]`}
      >
        {content.institutionalLines.map((line) => (
          <p key={line} className={line.includes('ReatCarto') ? 'font-bold text-blue-600 mb-0.5 sm:mb-1' : ''}>
            {line}
          </p>
        ))}
        {content.ibgeCreditLine && <p data-testid="export-ibge-credit">{content.ibgeCreditLine}</p>}
        {content.fallbackWarningLine && (
          <p className="text-amber-700" data-testid="export-ibge-fallback-warning">
            {content.fallbackWarningLine}
          </p>
        )}
        {content.boundaryErrorLine && (
          <p className="text-destructive" data-testid="export-boundary-error">
            {content.boundaryErrorLine}
          </p>
        )}
        {content.authorLine && (
          <p className="mt-0.5 sm:mt-1">
            <strong>Autoria:</strong> {content.authorLine.replace(/^Autoria:\s*/, '')}
          </p>
        )}
        {content.responsibleLine && (
          <p>
            <strong>Resp. Técnico:</strong> {content.responsibleLine.replace(/^Resp\. Técnico:\s*/, '')}
          </p>
        )}
      </div>
      <div className="flex flex-col items-center" data-testid="export-logo-block">
        {!logoFailed ? (
          <img
            src={LOGO_PATH}
            alt="(R)EAT Carto"
            className="w-6 h-6 sm:w-10 sm:h-10 object-contain mb-0.5 sm:mb-1"
            onError={() => setLogoFailed(true)}
            data-testid="export-logo-image"
          />
        ) : (
          <div
            className="w-6 h-6 sm:w-10 sm:h-10 bg-amber-500 rounded-full flex items-center justify-center text-white font-bold text-[6px] sm:text-[10px] mb-0.5 sm:mb-1"
            data-testid="export-logo-fallback"
          >
            (R)EAT
          </div>
        )}
        <p className="text-[6px] sm:text-[8px] font-bold text-gray-700 leading-none">IRIEAT</p>
        <p className="text-[4px] sm:text-[6px] text-gray-500 tracking-widest uppercase leading-none">Carto</p>
      </div>
    </div>
  );
}
