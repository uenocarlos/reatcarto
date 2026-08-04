import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditorExportHarness } from './helpers/exportHarness';

describe('Export entry integration', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('IT-003: auth blocked prevents shell open', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<EditorExportHarness authBlocked />);

    expect(screen.getByTestId('export-entry-button')).toBeDisabled();
    await user.click(screen.getByTestId('export-entry-button'));
    expect(screen.queryByTestId('export-map-shell')).not.toBeInTheDocument();
    expect(screen.getByTestId('export-auth-blocked')).toBeInTheDocument();
  });
});
