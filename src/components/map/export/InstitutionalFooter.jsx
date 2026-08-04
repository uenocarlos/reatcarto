import React from 'react';
import { buildFooterLines, EXPORT_LOGO_PATH } from '@/lib/export/branding';

export default function InstitutionalFooter({ authorship = '', technicalResponsible = '' }) {
  const lines = buildFooterLines({ authorship, technicalResponsible });

  return (
    <footer className="export-institutional-footer" data-testid="export-institutional-footer">
      <img
        src={EXPORT_LOGO_PATH}
        alt="REAT"
        className="export-institutional-footer__logo"
        data-testid="export-institutional-logo"
        draggable={false}
      />
      <div className="export-institutional-footer__lines">
        {lines.map((line, index) => (
          <div key={`${index}-${line.slice(0, 12)}`} className="export-institutional-footer__line">
            {line}
          </div>
        ))}
      </div>
    </footer>
  );
}
