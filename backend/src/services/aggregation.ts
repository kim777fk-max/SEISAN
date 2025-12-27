import { Event, EventType, ReasonCode } from '@prisma/client';

export interface TimeAggregation {
  runningMinutes: number;
  stoppedMinutes: number;
  stopReasonBreakdown: Record<string, number>;
}

/**
 * Calculate running and stopped time from events
 *
 * Logic:
 * - RUN period: START_RUN/RESUME ~ STOP/END
 * - STOP period: STOP ~ RESUME/END
 *
 * MVP limitation: Only calculates events within the same day
 */
export function calculateTimeAggregation(events: Event[]): TimeAggregation {
  const result: TimeAggregation = {
    runningMinutes: 0,
    stoppedMinutes: 0,
    stopReasonBreakdown: {},
  };

  if (events.length === 0) {
    return result;
  }

  // Sort events by time
  const sortedEvents = [...events].sort(
    (a, b) => a.eventTime.getTime() - b.eventTime.getTime()
  );

  let currentState: 'RUNNING' | 'STOPPED' | null = null;
  let stateStartTime: Date | null = null;
  let currentStopReason: ReasonCode | null = null;

  for (const event of sortedEvents) {
    if (currentState && stateStartTime) {
      const durationMs = event.eventTime.getTime() - stateStartTime.getTime();
      const durationMinutes = Math.floor(durationMs / 60000);

      if (currentState === 'RUNNING') {
        result.runningMinutes += durationMinutes;
      } else if (currentState === 'STOPPED' && currentStopReason) {
        result.stoppedMinutes += durationMinutes;
        const reason = currentStopReason;
        result.stopReasonBreakdown[reason] =
          (result.stopReasonBreakdown[reason] || 0) + durationMinutes;
      }
    }

    // Update state based on event type
    if (event.eventType === 'START_RUN' || event.eventType === 'RESUME') {
      currentState = 'RUNNING';
      stateStartTime = event.eventTime;
      currentStopReason = null;
    } else if (event.eventType === 'STOP') {
      currentState = 'STOPPED';
      stateStartTime = event.eventTime;
      currentStopReason = event.reasonCode;
    } else if (event.eventType === 'END') {
      // Calculate final period before ending
      currentState = null;
      stateStartTime = null;
      currentStopReason = null;
    }
  }

  // If still in a state (not ended), calculate time up to now
  if (currentState && stateStartTime) {
    const now = new Date();
    const durationMs = now.getTime() - stateStartTime.getTime();
    const durationMinutes = Math.floor(durationMs / 60000);

    if (currentState === 'RUNNING') {
      result.runningMinutes += durationMinutes;
    } else if (currentState === 'STOPPED' && currentStopReason) {
      result.stoppedMinutes += durationMinutes;
      const reason = currentStopReason;
      result.stopReasonBreakdown[reason] =
        (result.stopReasonBreakdown[reason] || 0) + durationMinutes;
    }
  }

  return result;
}
