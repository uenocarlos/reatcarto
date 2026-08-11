import React from 'react';
import { buildFooterLines, EXPORT_LOGO_PATH, isReatCartoBrandingLine } from '@/lib/export/branding';

export default function InstitutionalFooter({ authorship = '', technicalResponsible = '' }) {
  const lines = buildFooterLines({ authorship, technicalResponsible });

  return (
    <footer className="export-institutional-footer" data-testid="export-institutional-footer">
      <div className="export-institutional-footer__lines">
        {lines.map((line, index) => (
          <div
            key={`${index}-${line.slice(0, 12)}`}
            className={[
              'export-institutional-footer__line',
              isReatCartoBrandingLine(line) ? 'export-institutional-footer__line--brand' : '',
            ].filter(Boolean).join(' ')}
          >
            {line}
          </div>
        ))}
      </div>
      <img
        src={EXPORT_LOGO_PATH}
        alt="REAT"
        className="export-institutional-footer__logo"
        data-testid="export-institutional-logo"
        draggable={false}
      />
    </footer>
  );
}
