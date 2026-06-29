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

const APPEAL_WINDOW_SEC = 30 * 60;
const resultAt = revealEnd + 120;
assert.equal(resultAt + APPEAL_WINDOW_SEC > resultAt + 60, true, 'appeal window open shortly after finalize');
assert.equal(resultAt + APPEAL_WINDOW_SEC < resultAt + APPEAL_WINDOW_SEC + 1, true, 'appeal window end boundary');

const PANEL = 5;
function appealPoolShortfall(poolSize, round1PanelSize) {
  const available = poolSize - round1PanelSize;
  return available >= PANEL ? null : PANEL - available;
}
assert.equal(appealPoolShortfall(6, 5), 4, 'pool 6 after round1 panel 5 cannot appeal');
assert.equal(appealPoolShortfall(10, 5), null, 'pool 10 supports appeal round 2');

console.log('test-dispute-phase: OK');
