// Pure, dependency-free subscription logic: given the current state and a verified event, what should
// the new state be? No database, no HTTP, no payment provider in here - which is exactly what makes it
// unit-testable (see tests/unit/stateMachine.test.ts) and what the rest of the system trusts as the
// single definition of "does this shop have access right now".

export type SubStatus = 'incomplete' | 'trial' | 'active' | 'past_due' | 'cancelled' | 'expired';

export interface SubState {
  status: SubStatus;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  accessUntil: Date | null;        // shop management works while now() < accessUntil - this is the ONLY field access checks read
  cancelAtPeriodEnd: boolean;
  cancelledAt: Date | null;
  trialEndsAt: Date | null;
}

export const initialState: SubState = {
  status: 'incomplete', currentPeriodStart: null, currentPeriodEnd: null,
  accessUntil: null, cancelAtPeriodEnd: false, cancelledAt: null, trialEndsAt: null,
};

export type SubEvent =
  | { type: 'ACTIVATED'; periodStart: Date; periodEnd: Date }   // first mandate payment captured (subscription.authenticated / .activated)
  | { type: 'CHARGED'; periodStart: Date; periodEnd: Date }     // a renewal payment captured (subscription.charged)
  | { type: 'PAYMENT_FAILED' }                                  // a renewal charge failed; retries under way (subscription.pending / .halted)
  | { type: 'CANCELLED'; now: Date }                             // provider confirms the subscription is over (subscription.cancelled / .completed)
  | { type: 'START_TRIAL'; trialEnd: Date }
  | { type: 'EXPIRE_SWEEP'; now: Date };                         // the background job's periodic check

const addDays = (d: Date, days: number): Date => new Date(d.getTime() + days * 86_400_000);

export function applyEvent(state: SubState, event: SubEvent, graceDays: number): SubState {
  switch (event.type) {
    case 'START_TRIAL':
      return { ...state, status: 'trial', accessUntil: event.trialEnd, trialEndsAt: event.trialEnd };

    case 'ACTIVATED':
    case 'CHARGED': {
      // Razorpay does not guarantee delivery order, so a duplicate or late-arriving event for a period
      // we have already applied (or an older one) must never roll a shop's access backwards.
      if (state.currentPeriodEnd && event.periodEnd <= state.currentPeriodEnd) return state;
      return {
        ...state,
        status: 'active',
        currentPeriodStart: event.periodStart,
        currentPeriodEnd: event.periodEnd,
        accessUntil: addDays(event.periodEnd, graceDays),
        cancelAtPeriodEnd: false,
        cancelledAt: null,
      };
    }

    case 'PAYMENT_FAILED':
      // Access is untouched: accessUntil already carries the grace window from the last successful charge.
      // The status flip alone is what lets the app show "please update your payment method".
      return state.status === 'active' || state.status === 'trial' ? { ...state, status: 'past_due' } : state;

    case 'CANCELLED':
      // The paid-for period (already reflected in accessUntil) is honoured; access is not cut immediately.
      return { ...state, status: 'cancelled', cancelAtPeriodEnd: false, cancelledAt: event.now };

    case 'EXPIRE_SWEEP':
      if (state.accessUntil && state.accessUntil < event.now && state.status !== 'expired' && state.status !== 'incomplete') {
        return { ...state, status: 'expired' };
      }
      return state;

    default:
      return state;
  }
}

export const hasAccess = (state: Pick<SubState, 'accessUntil'>, now: Date): boolean => !!state.accessUntil && state.accessUntil > now;

/** Razorpay (and the mock provider, which mirrors its shape) webhook event names mapped onto the state machine above. */
export function eventTypeToSubEvent(
  eventType: string,
  period: { start: Date; end: Date } | null,
  now: Date,
): SubEvent | null {
  switch (eventType) {
    case 'subscription.authenticated':
    case 'subscription.activated':
      return period ? { type: 'ACTIVATED', periodStart: period.start, periodEnd: period.end } : null;
    case 'subscription.charged':
      return period ? { type: 'CHARGED', periodStart: period.start, periodEnd: period.end } : null;
    case 'subscription.pending':
    case 'subscription.halted':
      return { type: 'PAYMENT_FAILED' };
    case 'subscription.cancelled':
    case 'subscription.completed':
      return { type: 'CANCELLED', now };
    default:
      return null; // subscription.updated, .paused, .resumed, standalone payment.* events, etc.: nothing to change
  }
}
