import { EventType, SessionStatus } from '@prisma/client';

/**
 * State transition validator
 * Ensures that events follow the correct state machine:
 * INITIAL -> START_RUN -> RUNNING
 * RUNNING -> STOP -> STOPPED (requires reason_code)
 * STOPPED -> RESUME -> RUNNING
 * RUNNING/STOPPED -> END -> ENDED
 * ENDED -> No more events allowed
 */

export interface StateTransitionError {
  valid: false;
  error: string;
}

export interface StateTransitionSuccess {
  valid: true;
  newStatus: SessionStatus;
}

export type StateTransitionResult = StateTransitionError | StateTransitionSuccess;

export function validateStateTransition(
  currentStatus: SessionStatus | null,
  lastEventType: EventType | null,
  newEventType: EventType,
  hasReasonCode: boolean
): StateTransitionResult {
  // If session ended, no more events allowed
  if (currentStatus === 'ENDED') {
    return {
      valid: false,
      error: 'Session has ended. No more events can be added. Please start a new session.',
    };
  }

  // Initial state (no events yet)
  if (!lastEventType) {
    if (newEventType === 'START_RUN') {
      return { valid: true, newStatus: 'RUNNING' };
    }
    return {
      valid: false,
      error: 'First event must be START_RUN',
    };
  }

  // State machine validation
  switch (currentStatus) {
    case 'RUNNING':
      if (newEventType === 'STOP') {
        if (!hasReasonCode) {
          return {
            valid: false,
            error: 'STOP event requires reason_code',
          };
        }
        return { valid: true, newStatus: 'STOPPED' };
      }
      if (newEventType === 'END') {
        return { valid: true, newStatus: 'ENDED' };
      }
      return {
        valid: false,
        error: `Invalid transition: Cannot ${newEventType} while RUNNING. Only STOP or END allowed.`,
      };

    case 'STOPPED':
      if (newEventType === 'RESUME') {
        return { valid: true, newStatus: 'RUNNING' };
      }
      if (newEventType === 'END') {
        return { valid: true, newStatus: 'ENDED' };
      }
      return {
        valid: false,
        error: `Invalid transition: Cannot ${newEventType} while STOPPED. Only RESUME or END allowed.`,
      };

    default:
      return {
        valid: false,
        error: 'Invalid session status',
      };
  }
}
