import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EditorActionsPanel from '@/components/map/EditorActionsPanel';

describe('EditorActionsPanel offline prepare', () => {
  it('places Usar o mapa offline below Publicar na galeria and calls prepare', async () => {
    const user = userEvent.setup();
    const onPrepareOffline = vi.fn();
    render(
      <EditorActionsPanel
        mapName="Mapa teste"
        onPublish={() => {}}
        onPrepareOffline={onPrepareOffline}
      />
    );

    const publish = screen.getByRole('button', { name: /Publicar na galeria/i });
    const prepare = screen.getByTestId('prepare-offline-entry');
    expect(publish.compareDocumentPosition(prepare) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(prepare).toHaveTextContent('Usar o mapa offline');
    expect(prepare).toHaveTextContent('Baixar este mapa para editar sem internet');

    await user.click(prepare);
    expect(onPrepareOffline).toHaveBeenCalledTimes(1);
  });

  it('shows already-prepared copy and stays below Despublicar da galeria', () => {
    render(
      <EditorActionsPanel
        isPublished
        offlinePrepared
        onUnpublish={() => {}}
        onPrepareOffline={() => {}}
      />
    );

    const unpublish = screen.getByRole('button', { name: /Despublicar da galeria/i });
    const prepare = screen.getByTestId('prepare-offline-entry');
    expect(unpublish.compareDocumentPosition(prepare) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(prepare).toHaveTextContent('Já disponível offline — toque para atualizar');
  });

  it('disables prepare while offline', () => {
    render(
      <EditorActionsPanel
        prepareOfflineDisabled
        prepareOfflineDisabledReason="Conecte-se à internet para preparar o mapa"
        onPrepareOffline={() => {}}
      />
    );

    expect(screen.getByTestId('prepare-offline-entry')).toBeDisabled();
  });
});
