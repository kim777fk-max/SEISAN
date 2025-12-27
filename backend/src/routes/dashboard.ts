import express from 'express';
import prisma from '../lib/prisma';
import { calculateTimeAggregation } from '../services/aggregation';

const router = express.Router();

// GET /api/dashboard/today - Get today's dashboard data
router.get('/today', async (req, res) => {
  try {
    const dateStr = req.query.date as string;

    if (!dateStr) {
      return res.status(400).json({ error: 'date parameter is required (YYYY-MM-DD)' });
    }

    const date = new Date(dateStr);

    // Get all machines
    const machines = await prisma.machine.findMany({
      where: { isActive: true },
      orderBy: { machineCode: 'asc' },
    });

    // Get sessions and events for each machine on this date
    const dashboardData = await Promise.all(
      machines.map(async (machine) => {
        const session = await prisma.workSession.findFirst({
          where: {
            machineId: machine.id,
            date: date,
          },
          include: {
            events: {
              orderBy: { eventTime: 'asc' },
            },
          },
        });

        if (!session) {
          return {
            machineCode: machine.machineCode,
            machineName: machine.name,
            status: 'NO_SESSION',
            runningMinutes: 0,
            stoppedMinutes: 0,
            stopReasonBreakdown: {},
            shift: null,
            productCode: null,
            process: null,
          };
        }

        const aggregation = calculateTimeAggregation(session.events);

        // Get latest event for operator info
        const latestEvent = session.events.length > 0
          ? session.events[session.events.length - 1]
          : null;

        return {
          machineCode: machine.machineCode,
          machineName: machine.name,
          status: session.status,
          runningMinutes: aggregation.runningMinutes,
          stoppedMinutes: aggregation.stoppedMinutes,
          stopReasonBreakdown: aggregation.stopReasonBreakdown,
          shift: session.shift,
          productCode: session.productCode,
          process: session.process,
          latestOperator: latestEvent?.operatorName || null,
        };
      })
    );

    // Calculate totals
    const totals = dashboardData.reduce(
      (acc, item) => {
        acc.totalRunningMinutes += item.runningMinutes;
        acc.totalStoppedMinutes += item.stoppedMinutes;

        Object.entries(item.stopReasonBreakdown).forEach(([reason, minutes]) => {
          acc.stopReasonBreakdown[reason] =
            (acc.stopReasonBreakdown[reason] || 0) + minutes;
        });

        return acc;
      },
      {
        totalRunningMinutes: 0,
        totalStoppedMinutes: 0,
        stopReasonBreakdown: {} as Record<string, number>,
      }
    );

    res.json({
      date: dateStr,
      machines: dashboardData,
      totals,
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

export default router;
