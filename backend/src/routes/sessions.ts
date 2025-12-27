import express from 'express';
import prisma from '../lib/prisma';

const router = express.Router();

// POST /api/sessions/start - Start a new work session
router.post('/start', async (req, res) => {
  try {
    const { machine_code, date, shift, product_code, process } = req.body;

    if (!machine_code || !date) {
      return res.status(400).json({ error: 'machine_code and date are required' });
    }

    const sessionDate = new Date(date);

    // Find machine
    const machine = await prisma.machine.findUnique({
      where: { machineCode: machine_code },
    });

    if (!machine) {
      return res.status(404).json({ error: 'Machine not found' });
    }

    // Check if there's already an active session for this date
    const existingSession = await prisma.workSession.findFirst({
      where: {
        machineId: machine.id,
        date: sessionDate,
        status: { not: 'ENDED' },
      },
    });

    if (existingSession) {
      // Return existing session (idempotent behavior)
      return res.json({
        message: 'Active session already exists for this date',
        session: existingSession,
      });
    }

    // Create new session
    const session = await prisma.workSession.create({
      data: {
        machineId: machine.id,
        date: sessionDate,
        shift: shift || null,
        productCode: product_code || null,
        process: process || null,
        status: 'RUNNING',
      },
    });

    // Create START_RUN event
    const event = await prisma.event.create({
      data: {
        sessionId: session.id,
        machineId: machine.id,
        eventType: 'START_RUN',
      },
    });

    res.status(201).json({
      session,
      event,
    });
  } catch (error) {
    console.error('Error starting session:', error);
    res.status(500).json({ error: 'Failed to start session' });
  }
});

export default router;
