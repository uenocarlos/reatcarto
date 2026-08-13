import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = ResizeObserverStub;
}

if (typeof screen !== 'undefined' && !screen.orientation) {
  screen.orientation = {
    lock: () => Promise.resolve(),
    unlock: () => {},
  };
}

if (typeof Element.prototype.hasPointerCapture === 'undefined') {
  Element.prototype.hasPointerCapture = () => false;
}
if (typeof Element.prototype.setPointerCapture === 'undefined') {
  Element.prototype.setPointerCapture = () => {};
}
if (typeof Element.prototype.releasePointerCapture === 'undefined') {
  Element.prototype.releasePointerCapture = () => {};
}

afterEach(() => {
  cleanup();
  if (typeof window !== 'undefined') {
    window.innerWidth = 1024;
    window.innerHeight = 768;
  }
});

// Vitest setup for export library and composition integration tests.
