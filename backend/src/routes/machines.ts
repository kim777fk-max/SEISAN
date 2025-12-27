import express from 'express';
import prisma from '../lib/prisma';

const router = express.Router();

// GET /api/machines - Get all machines
router.get('/', async (req, res) => {
  try {
    const machines = await prisma.machine.findMany({
      where: { isActive: true },
      orderBy: { machineCode: 'asc' },
    });
    res.json(machines);
  } catch (error) {
    console.error('Error fetching machines:', error);
    res.status(500).json({ error: 'Failed to fetch machines' });
  }
});

// GET /api/machines/:machineCode/status - Get machine status
router.get('/:machineCode/status', async (req, res) => {
  try {
    const { machineCode } = req.params;
    const dateStr = req.query.date as string;

    if (!dateStr) {
      return res.status(400).json({ error: 'date parameter is required (YYYY-MM-DD)' });
    }

    const date = new Date(dateStr);

    const machine = await prisma.machine.findUnique({
      where: { machineCode },
    });

    if (!machine) {
      return res.status(404).json({ error: 'Machine not found' });
    }

    // Find active session for this date
    const session = await prisma.workSession.findFirst({
      where: {
        machineId: machine.id,
        date: date,
      },
      include: {
        events: {
          orderBy: { eventTime: 'desc' },
          take: 1,
        },
      },
    });

    if (!session) {
      return res.json({
        machineCode,
        machineName: machine.name,
        date: dateStr,
        status: 'NO_SESSION',
        lastEvent: null,
      });
    }

    const lastEvent = session.events[0] || null;

    res.json({
      machineCode,
      machineName: machine.name,
      date: dateStr,
      status: session.status,
      sessionId: session.id,
      lastEvent: lastEvent
        ? {
            eventType: lastEvent.eventType,
            eventTime: lastEvent.eventTime,
            reasonCode: lastEvent.reasonCode,
          }
        : null,
    });
  } catch (error) {
    console.error('Error fetching machine status:', error);
    res.status(500).json({ error: 'Failed to fetch machine status' });
  }
});

// POST /api/machines - Create a new machine (for initial setup)
router.post('/', async (req, res) => {
  try {
    const { machineCode, name, isActive } = req.body;

    if (!machineCode || !name) {
      return res.status(400).json({ error: 'machineCode and name are required' });
    }

    const machine = await prisma.machine.create({
      data: {
        machineCode,
        name,
        isActive: isActive ?? true,
      },
    });

    res.status(201).json(machine);
  } catch (error: any) {
    console.error('Error creating machine:', error);
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Machine code already exists' });
    }
    res.status(500).json({ error: 'Failed to create machine' });
  }
});

export default router;
