/**
 * Shared test fixtures re-exported from core for integration tests.
 *
 * Provides `makeCtx`, `makeBoard`, and `makeBoardConfig` without requiring
 * integration tests to know core's internal path structure.
 */
export {
  makeBoard,
  makeBoardConfig,
  makeCtx,
} from '~/c/dev/pipeline/phases/test-helpers.js';
