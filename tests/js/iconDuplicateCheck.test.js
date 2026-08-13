import { describe, expect, it } from 'vitest';
import {
  classifyIconDuplicate,
  duplicateWarningMessage,
  findLibraryIconByName,
  hashIconBlob,
  inspectIconDuplicates,
  iconNamesMatch,
} from '@/lib/icons/iconDuplicateCheck';

const library = [
  { id: 'a', name: 'Farol', url: '/php/icons/get.php?id=a' },
  { id: 'b', name: 'Âncora', url: '/php/icons/get.php?id=b' },
];

describe('iconDuplicateCheck', () => {
  it('matches icon names case-insensitively', () => {
    expect(iconNamesMatch('Farol', 'farol')).toBe(true);
    expect(iconNamesMatch('Farol', 'Âncora')).toBe(false);
    expect(findLibraryIconByName(library, ' FAROL ')).toMatchObject({ id: 'a' });
  });

  it('hashes equal blobs the same way', async () => {
    const left = new Blob([new Uint8Array([1, 2, 9, 9])], { type: 'image/png' });
    const right = new Blob([new Uint8Array([1, 2, 9, 9])], { type: 'image/png' });
    const other = new Blob([new Uint8Array([1, 2, 8, 9])], { type: 'image/png' });

    expect(await hashIconBlob(left)).toBe(await hashIconBlob(right));
    expect(await hashIconBlob(left)).not.toBe(await hashIconBlob(other));
  });

  it('classifies same name for different icons', () => {
    const conflict = classifyIconDuplicate({
      nameMatch: library[0],
      contentMatch: null,
    });
    expect(conflict.kind).toBe('name');
    expect(duplicateWarningMessage(conflict)).toMatch(/Já existe outro ícone chamado "Farol"/);
  });

  it('classifies same drawing under a different name', () => {
    const conflict = classifyIconDuplicate({
      nameMatch: null,
      contentMatch: library[1],
    });
    expect(conflict.kind).toBe('content');
    expect(duplicateWarningMessage(conflict, 'Bóia')).toMatch(/já está salvo como "Âncora"/);
    expect(duplicateWarningMessage(conflict, 'Bóia')).toMatch(/Bóia/);
  });

  it('inspects name and content conflicts together', async () => {
    const blobA = new Blob([new Uint8Array([10, 20])], { type: 'image/png' });
    const blobB = new Blob([new Uint8Array([30, 40])], { type: 'image/png' });
    const blobNew = new Blob([new Uint8Array([50, 60])], { type: 'image/png' });
    const blobs = {
      '/php/icons/get.php?id=a': blobA,
      '/php/icons/get.php?id=b': blobB,
    };

    const loadBlob = async (url) => blobs[url] ?? null;

    const nameOnly = await inspectIconDuplicates(library, blobNew, 'Farol', { fetchIconBlob: loadBlob });
    expect(nameOnly.kind).toBe('name');

    const contentOnly = await inspectIconDuplicates(library, blobA, 'Bóia', { fetchIconBlob: loadBlob });
    expect(contentOnly.kind).toBe('content');
    expect(contentOnly.icon.id).toBe('a');

    const exact = await inspectIconDuplicates(library, blobA, 'Farol', { fetchIconBlob: loadBlob });
    expect(exact.kind).toBe('exact');
  });
});
