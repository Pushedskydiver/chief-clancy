/**
 * Ticket fixtures for rubric fitness testing.
 *
 * 10 known-good tickets (should grade green) and 10 known-bad tickets
 * (should grade yellow or red). Used by rubric-fitness.test.ts with a
 * deterministic mock grader.
 */

type TicketFixture = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly expected: 'green' | 'not-green';
};

// ─── Known-good tickets (should grade green) ────────────────────────────────

const GOOD_TICKETS: readonly TicketFixture[] = [
  {
    id: 'GOOD-1',
    title: 'feat: add email validation to signup form',
    description:
      'Add client-side email validation to the signup form in src/components/SignupForm.tsx. ' +
      'Accept: form shows inline error for invalid emails. Test: signupForm.test.tsx asserts ' +
      'error message appears for "not-an-email" input. Touches SignupForm.tsx only.',
    expected: 'green',
  },
  {
    id: 'GOOD-2',
    title: 'fix: correct off-by-one in pagination offset',
    description:
      'The pagination helper in src/utils/paginate.ts uses `offset = page * size` but should ' +
      'use `offset = (page - 1) * size`. Accept: paginate(2, 10) returns offset 10 not 20. ' +
      'Test: paginate.test.ts. Single file fix.',
    expected: 'green',
  },
  {
    id: 'GOOD-3',
    title: 'chore: bump axios from 1.6.0 to 1.7.0',
    description:
      'Update axios dependency in package.json from 1.6.0 to 1.7.0 for security patch CVE-2024-1234. ' +
      'Accept: `pnpm install` succeeds, `pnpm test` passes. Touches package.json and pnpm-lock.yaml.',
    expected: 'green',
  },
  {
    id: 'GOOD-4',
    title: 'feat: add dark mode toggle to settings page',
    description:
      'Add a toggle switch to src/pages/Settings.tsx that sets `theme` in localStorage. ' +
      'Accept: clicking toggle switches between "light" and "dark" classes on <body>. ' +
      'Test: settings.test.tsx checks toggle flips the class. Touches Settings.tsx.',
    expected: 'green',
  },
  {
    id: 'GOOD-5',
    title: 'refactor: extract formatCurrency into shared util',
    description:
      'Move the formatCurrency function from src/components/PriceDisplay.tsx to src/utils/format.ts. ' +
      'Update imports in PriceDisplay.tsx. Accept: existing tests pass without changes. ' +
      'Test: format.test.ts asserts formatCurrency(1234.5) returns "$1,234.50". Two files.',
    expected: 'green',
  },
  {
    id: 'GOOD-6',
    title: 'fix: prevent double-submit on checkout button',
    description:
      'Add disabled state to the checkout button in src/components/Checkout.tsx after first click. ' +
      'Accept: rapid double-click only triggers one API call. Test: checkout.test.tsx mocks fetch ' +
      'and asserts single call. Single file.',
    expected: 'green',
  },
  {
    id: 'GOOD-7',
    title: 'test: add missing tests for date-range picker',
    description:
      'Add unit tests for the DateRangePicker component in src/components/DateRangePicker.tsx. ' +
      'Test cases: default range, custom range selection, invalid range rejected. ' +
      'Accept: ≥80% branch coverage. New file: DateRangePicker.test.tsx.',
    expected: 'green',
  },
  {
    id: 'GOOD-8',
    title: 'feat: add retry logic to webhook sender',
    description:
      'Add exponential backoff retry (max 3 attempts) to src/services/webhook.ts sendWebhook(). ' +
      'Accept: transient 503 retries succeed on 2nd attempt. Test: webhook.test.ts with mock ' +
      'fetch that fails once then succeeds. Single file.',
    expected: 'green',
  },
  {
    id: 'GOOD-9',
    title: 'docs: update API response examples in README',
    description:
      'Update the "API Response" section in README.md to match the current schema (added `createdAt` ' +
      'field in v2.3). Accept: examples in README match actual /api/users response. Single file.',
    expected: 'green',
  },
  {
    id: 'GOOD-10',
    title: 'fix: handle null avatarUrl in user profile',
    description:
      'The UserProfile component in src/components/UserProfile.tsx crashes when user.avatarUrl is null. ' +
      'Add a fallback to a default avatar. Accept: profile renders without error when avatarUrl is null. ' +
      'Test: userProfile.test.tsx. Single file.',
    expected: 'green',
  },
];

// ─── Known-bad tickets (should grade yellow or red) ─────────────────────────

const BAD_TICKETS: readonly TicketFixture[] = [
  {
    id: 'BAD-1',
    title: 'feat: do the thing',
    description: '',
    expected: 'not-green',
  },
  {
    id: 'BAD-2',
    title: 'fix: it',
    description: 'Fix the bug.',
    expected: 'not-green',
  },
  {
    id: 'BAD-3',
    title: 'refactor: improve code quality',
    description:
      'Go through the entire codebase and improve code quality. ' +
      'Refactor anything that looks messy. Update everywhere.',
    expected: 'not-green',
  },
  {
    id: 'BAD-4',
    title: 'feat: build the new dashboard',
    description:
      'Build a complete analytics dashboard with: 1) user activity charts, ' +
      '2) revenue tracking, 3) conversion funnels, 4) A/B test results, ' +
      '5) real-time metrics, 6) export to PDF. This is a big one.',
    expected: 'not-green',
  },
  {
    id: 'BAD-5',
    title: 'chore: update dependencies',
    description: 'Update all dependencies to latest versions.',
    expected: 'not-green',
  },
  {
    id: 'BAD-6',
    title: 'feat: add authentication',
    description:
      'Add authentication to the app. Should work correctly and be secure.',
    expected: 'not-green',
  },
  {
    id: 'BAD-7',
    title: '',
    description: 'Something needs to be done here.',
    expected: 'not-green',
  },
  {
    id: 'BAD-8',
    title: 'performance',
    description: 'The app is slow. Make it faster. Should load quickly.',
    expected: 'not-green',
  },
  {
    id: 'BAD-9',
    title: 'feat: migrate to new API',
    description:
      'Migrate all API calls from v1 to v2. Update every component that ' +
      'makes API calls. Update all tests. Update documentation. Update CI.',
    expected: 'not-green',
  },
  {
    id: 'BAD-10',
    title: 'fix: AuthMiddleware',
    description: 'Fix the auth middleware issue reported in Slack.',
    expected: 'not-green',
  },
];

export { BAD_TICKETS, GOOD_TICKETS };
export type { TicketFixture };
