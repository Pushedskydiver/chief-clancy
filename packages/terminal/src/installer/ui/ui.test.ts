import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { printBanner, printSuccess } from './ui.js';

/** Capture all console.log output as a single string. */
function captureOutput(spy: ReturnType<typeof vi.spyOn>): string {
  return spy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
}

describe('printBanner', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('prints the ASCII banner', () => {
    printBanner('1.2.3');

    expect(captureOutput(logSpy)).toContain('██████╗');
  });

  it('includes the version number', () => {
    printBanner('4.5.6');

    expect(captureOutput(logSpy)).toContain('v4.5.6');
  });

  it('includes the tagline', () => {
    printBanner('0.0.1');

    expect(captureOutput(logSpy)).toContain(
      'Autonomous, board-driven development for Claude Code.',
    );
  });

  it('includes the attribution', () => {
    printBanner('0.0.1');

    expect(captureOutput(logSpy)).toContain('Geoffrey Huntley');
  });
});

describe('printSuccess', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('prints the success message', () => {
    printSuccess(null);

    expect(captureOutput(logSpy)).toContain('Clancy installed successfully');
  });

  it('shows next steps with /clancy:init', () => {
    printSuccess(null);

    expect(captureOutput(logSpy)).toContain('/clancy:init');
  });

  it('shows all command groups when enabledRoles is null', () => {
    printSuccess(null);

    const output = captureOutput(logSpy);
    expect(output).toContain('Strategist');
    expect(output).toContain('Planner');
    expect(output).toContain('Implementer');
    expect(output).toContain('Reviewer');
    expect(output).toContain('Setup & Maintenance');
  });

  it('shows all command groups when strategist and planner roles are enabled', () => {
    printSuccess(new Set(['strategist', 'planner']));

    const output = captureOutput(logSpy);
    expect(output).toContain('Strategist');
    expect(output).toContain('Planner');
    expect(output).toContain('Implementer');
  });

  it('hides Planner group when planner role is not enabled', () => {
    printSuccess(new Set(['implementer']));

    const output = captureOutput(logSpy);
    expect(output).not.toContain('/clancy:plan');
    expect(output).not.toContain('/clancy:approve-plan');
    expect(output).toContain('Implementer');
  });

  it('hides Strategist group when strategist role is not enabled', () => {
    printSuccess(new Set(['implementer']));

    const output = captureOutput(logSpy);
    expect(output).not.toContain('/clancy:brief');
    expect(output).not.toContain('/clancy:approve-brief');
  });

  it('always shows non-optional groups regardless of enabledRoles', () => {
    printSuccess(new Set([]));

    const output = captureOutput(logSpy);
    expect(output).toContain('Implementer');
    expect(output).toContain('Reviewer');
    expect(output).toContain('Setup & Maintenance');
  });

  it('lists core implementer commands', () => {
    printSuccess(null);

    const output = captureOutput(logSpy);
    expect(output).toContain('/clancy:implement');
    expect(output).toContain('/clancy:autopilot');
    expect(output).toContain('/clancy:dry-run');
  });

  it('lists setup commands', () => {
    printSuccess(null);

    const output = captureOutput(logSpy);
    expect(output).toContain('/clancy:doctor');
    expect(output).toContain('/clancy:settings');
    expect(output).toContain('/clancy:update');
    expect(output).toContain('/clancy:uninstall-terminal');
    expect(output).toContain('/clancy:help');
  });
});
