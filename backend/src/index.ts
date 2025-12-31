import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import machinesRouter from './routes/machines';
import sessionsRouter from './routes/sessions';
import eventsRouter from './routes/events';
import dashboardRouter from './routes/dashboard';
import newsRouter from './routes/news';
import { getNewsScheduler } from './services/scheduler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/machines', machinesRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/events', eventsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/news', newsRouter);

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);

  // Start news collection scheduler
  try {
    const scheduler = getNewsScheduler();
    scheduler.start();
    console.log('News collection scheduler started');
  } catch (error) {
    console.error('Failed to start news scheduler:', error);
    console.error('News collection will not be available. Please check ANTHROPIC_API_KEY in .env');
  }
});
