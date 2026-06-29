/**
 * Boundary tests for on-chain finalize timing vs UI helpers.
 * Usage: node scripts/test-dispute-phase.mjs
 */
import assert from 'node:assert/strict';

const REVEAL_END_MIN = 16;

function getRevealEndSec(createdAtSec) {
  return createdAtSec + REVEAL_END_MIN * 60;
}

function isRevealWindowClosed(createdAtSec, nowSec) {
  return nowSec > getRevealEndSec(createdAtSec);
}

function secondsUntilFinalizeAllowed(createdAtSec, nowSec) {
  const revealEndSec = getRevealEndSec(createdAtSec);
  return nowSec > revealEndSec ? 0 : revealEndSec - nowSec + 1;
}

const created = 1_700_000_000;
const revealEnd = getRevealEndSec(created);

assert.equal(isRevealWindowClosed(created, revealEnd), false, 'at revealEnd: still VotingStillActive');
assert.equal(isRevealWindowClosed(created, revealEnd + 1), true, 'after revealEnd: finalize allowed');
assert.equal(secondsUntilFinalizeAllowed(created, revealEnd), 1);
assert.equal(secondsUntilFinalizeAllowed(created, revealEnd + 1), 0);

console.log('test-dispute-phase: OK');
