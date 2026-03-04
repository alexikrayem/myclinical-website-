import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary';
import * as Sentry from '@sentry/react';

vi.mock('@sentry/react', () => ({
  captureException: vi.fn(),
}));

const Boom = () => {
  throw new Error('boom');
};

describe('ErrorBoundary', () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleError.mockClear();
  });

  it('renders fallback UI and reports errors to Sentry', async () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );

    expect(await screen.findByText('حدث خطأ غير متوقع')).toBeInTheDocument();
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });

  it('renders custom fallback when provided', async () => {
    render(
      <ErrorBoundary fallback={<div>Custom fallback</div>}>
        <Boom />
      </ErrorBoundary>
    );

    expect(await screen.findByText('Custom fallback')).toBeInTheDocument();
  });
});
