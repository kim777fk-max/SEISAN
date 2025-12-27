import express from 'express';
import prisma from '../lib/prisma';
import { validateStateTransition } from '../services/stateTransition';
import { EventType, ReasonCode } from '@prisma/client';

const router = express.Router();

// POST /api/events - Create a new event
router.post('/', async (req, res) => {
  try {
    const { machine_code, date, event_type, reason_code, operator_name, memo, qty } = req.body;

    if (!machine_code || !date || !event_type) {
      return res.status(400).json({
        error: 'machine_code, date, and event_type are required',
      });
    }

    // Validate event_type
    if (!['START_RUN', 'STOP', 'RESUME', 'END'].includes(event_type)) {
      return res.status(400).json({
        error: 'Invalid event_type. Must be START_RUN, STOP, RESUME, or END',
      });
    }

    const sessionDate = new Date(date);

    // Find machine
    const machine = await prisma.machine.findUnique({
      where: { machineCode: machine_code },
    });

    if (!machine) {
      return res.status(404).json({ error: 'Machine not found' });
    }

    // Find or create session for this date
    let session = await prisma.workSession.findFirst({
      where: {
        machineId: machine.id,
        date: sessionDate,
      },
      include: {
        events: {
          orderBy: { eventTime: 'desc' },
          take: 1,
        },
      },
    });

    // If no session exists and event is START_RUN, create session
    if (!session && event_type === 'START_RUN') {
      session = await prisma.workSession.create({
        data: {
          machineId: machine.id,
          date: sessionDate,
          status: 'RUNNING',
        },
        include: {
          events: true,
        },
      });
    }

    if (!session) {
      return res.status(400).json({
        error: 'No active session found. Please start a session first with START_RUN event.',
      });
    }

    // Get last event
    const lastEvent = session.events[0] || null;

    // Validate state transition
    const transitionResult = validateStateTransition(
      session.status,
      lastEvent?.eventType || null,
      event_type as EventType,
      !!reason_code
    );

    if (!transitionResult.valid) {
      return res.status(400).json({
        error: 'Invalid state transition',
        message: transitionResult.error,
        currentStatus: session.status,
        lastEventType: lastEvent?.eventType || null,
        attemptedEventType: event_type,
      });
    }

    // Validate reason_code for STOP events
    if (event_type === 'STOP' && !reason_code) {
      return res.status(400).json({
        error: 'reason_code is required for STOP events',
        validReasonCodes: ['SETUP', 'FAILURE', 'MATERIAL', 'QC', 'OTHER'],
      });
    }

    // Validate reason_code value
    if (reason_code && !['SETUP', 'FAILURE', 'MATERIAL', 'QC', 'OTHER'].includes(reason_code)) {
      return res.status(400).json({
        error: 'Invalid reason_code',
        validReasonCodes: ['SETUP', 'FAILURE', 'MATERIAL', 'QC', 'OTHER'],
      });
    }

    // Create event
    const event = await prisma.event.create({
      data: {
        sessionId: session.id,
        machineId: machine.id,
        eventType: event_type as EventType,
        reasonCode: reason_code ? (reason_code as ReasonCode) : null,
        operatorName: operator_name || null,
        memo: memo || null,
        qty: qty ? parseInt(qty) : null,
      },
    });

    // Update session status
    await prisma.workSession.update({
      where: { id: session.id },
      data: { status: transitionResult.newStatus },
    });

    res.status(201).json({
      event,
      newStatus: transitionResult.newStatus,
    });
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

export default router;
