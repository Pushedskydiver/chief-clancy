// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { App } from './App.js';

afterEach(cleanup);

describe('App', () => {
  it('renders a chat panel region', () => {
    render(<App />);

    const chatPanel = screen.queryByRole('region', { name: /chat panel/i });

    expect(chatPanel).not.toBeNull();
  });

  it('renders a variant grid region', () => {
    render(<App />);

    const variantGrid = screen.queryByRole('region', { name: /variant grid/i });

    expect(variantGrid).not.toBeNull();
  });
});
