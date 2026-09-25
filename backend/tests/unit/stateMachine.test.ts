import test from 'node:test';
import assert from 'node:assert/strict';
import { applyEvent, eventTypeToSubEvent, hasAccess, initialState, type SubState } from '../../src/subscriptions/stateMachine';

const GRACE = 3;
const day = (n: number) => new Date(Date.UTC(2026, 0, n));

test('a fresh subscription has no access', () => {
  assert.equal(hasAccess(initialState, new Date()), false);
});

test('ACTIVATED grants access through the period end plus the grace window', () => {
  const start = day(1), end = day(31);
  const next = applyEvent(initialState, { type: 'ACTIVATED', periodStart: start, periodEnd: end }, GRACE);
  assert.equal(next.status, 'active');
  assert.equal(next.accessUntil?.getTime(), end.getTime() + GRACE * 86_400_000);
  assert.equal(hasAccess(next, day(30)), true);
  assert.equal(hasAccess(next, day(35)), false); // past period end + grace
});

test('CHARGED extends access for a renewal', () => {
  const active = applyEvent(initialState, { type: 'ACTIVATED', periodStart: day(1), periodEnd: day(31) }, GRACE);
  const renewed = applyEvent(active, { type: 'CHARGED', periodStart: day(31), periodEnd: day(61) }, GRACE);
  assert.equal(renewed.currentPeriodEnd?.getTime(), day(61).getTime());
  assert.equal(hasAccess(renewed, day(60)), true);
});

test('a stale or duplicate renewal event never moves access backwards', () => {
  const renewed = applyEvent(
    applyEvent(initialState, { type: 'ACTIVATED', periodStart: day(1), periodEnd: day(31) }, GRACE),
    { type: 'CHARGED', periodStart: day(31), periodEnd: day(61) }, GRACE,
  );
  // A duplicate delivery of the FIRST charge arrives late, after the renewal was already applied.
  const afterStaleDuplicate = applyEvent(renewed, { type: 'ACTIVATED', periodStart: day(1), periodEnd: day(31) }, GRACE);
  assert.deepEqual(afterStaleDuplicate, renewed);
});

test('a failed renewal charge moves status to past_due but does NOT cut access early', () => {
  const active = applyEvent(initialState, { type: 'ACTIVATED', periodStart: day(1), periodEnd: day(31) }, GRACE);
  const failed = applyEvent(active, { type: 'PAYMENT_FAILED' }, GRACE);
  assert.equal(failed.status, 'past_due');
  assert.equal(failed.accessUntil?.getTime(), active.accessUntil?.getTime());
  assert.equal(hasAccess(failed, day(30)), true); // still within the grace window from the last successful charge
});

test('cancellation is honoured only once the already-paid-for period passes', () => {
  const active = applyEvent(initialState, { type: 'ACTIVATED', periodStart: day(1), periodEnd: day(31) }, GRACE);
  const cancelled = applyEvent(active, { type: 'CANCELLED', now: day(15) }, GRACE);
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(hasAccess(cancelled, day(30)), true);  // still inside the period they already paid for
  assert.equal(hasAccess(cancelled, day(35)), false); // after period end + grace
});

test('the expiry sweep flips a lapsed subscription to expired, and only then', () => {
  const active = applyEvent(initialState, { type: 'ACTIVATED', periodStart: day(1), periodEnd: day(31) }, GRACE);
  const stillFine = applyEvent(active, { type: 'EXPIRE_SWEEP', now: day(32) }, GRACE); // within grace
  assert.equal(stillFine.status, 'active');
  const expired = applyEvent(active, { type: 'EXPIRE_SWEEP', now: day(40) }, GRACE);
  assert.equal(expired.status, 'expired');
});

test('the expiry sweep never touches a subscription that was never activated', () => {
  const swept = applyEvent(initialState, { type: 'EXPIRE_SWEEP', now: day(100) }, GRACE);
  assert.equal(swept.status, 'incomplete');
});

test('Razorpay/mock event names map onto the right internal events', () => {
  const period = { start: day(1), end: day(31) };
  assert.equal(eventTypeToSubEvent('subscription.activated', period, day(1))?.type, 'ACTIVATED');
  assert.equal(eventTypeToSubEvent('subscription.authenticated', period, day(1))?.type, 'ACTIVATED');
  assert.equal(eventTypeToSubEvent('subscription.charged', period, day(1))?.type, 'CHARGED');
  assert.equal(eventTypeToSubEvent('subscription.pending', null, day(1))?.type, 'PAYMENT_FAILED');
  assert.equal(eventTypeToSubEvent('subscription.halted', null, day(1))?.type, 'PAYMENT_FAILED');
  assert.equal(eventTypeToSubEvent('subscription.cancelled', null, day(1))?.type, 'CANCELLED');
  assert.equal(eventTypeToSubEvent('subscription.completed', null, day(1))?.type, 'CANCELLED');
  assert.equal(eventTypeToSubEvent('subscription.updated', null, day(1)), null); // nothing to change, ignored safely
  assert.equal(eventTypeToSubEvent('payment.captured', null, day(1)), null);
});

test('a shopkeeper who cancels then renews gets access restored', () => {
  const active = applyEvent(initialState, { type: 'ACTIVATED', periodStart: day(1), periodEnd: day(31) }, GRACE);
  const cancelled = applyEvent(active, { type: 'CANCELLED', now: day(31) }, GRACE);
  const renewedAfterCancel = applyEvent(cancelled, { type: 'ACTIVATED', periodStart: day(40), periodEnd: day(70) }, GRACE);
  assert.equal(renewedAfterCancel.status, 'active');
  assert.equal(hasAccess(renewedAfterCancel, day(65)), true);
});
