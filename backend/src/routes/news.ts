import express from 'express';
import prisma from '../lib/prisma';
import { getNewsScheduler } from '../services/scheduler';

const router = express.Router();

// GET /api/news - Get all news articles
router.get('/', async (req, res) => {
  try {
    const { keyword, limit = '50', offset = '0' } = req.query;

    const where = keyword ? { keyword: keyword as string } : {};

    const articles = await prisma.newsArticle.findMany({
      where,
      orderBy: { collectedAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    const total = await prisma.newsArticle.count({ where });

    res.json({
      articles,
      total,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });
  } catch (error) {
    console.error('Error fetching news articles:', error);
    res.status(500).json({ error: 'Failed to fetch news articles' });
  }
});

// GET /api/news/:id - Get a specific news article
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const article = await prisma.newsArticle.findUnique({
      where: { id },
    });

    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    res.json(article);
  } catch (error) {
    console.error('Error fetching news article:', error);
    res.status(500).json({ error: 'Failed to fetch news article' });
  }
});

// GET /api/news/by-keyword/:keyword - Get articles by keyword
router.get('/by-keyword/:keyword', async (req, res) => {
  try {
    const { keyword } = req.params;
    const { limit = '50', offset = '0' } = req.query;

    const articles = await prisma.newsArticle.findMany({
      where: { keyword },
      orderBy: { collectedAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    const total = await prisma.newsArticle.count({ where: { keyword } });

    res.json({
      keyword,
      articles,
      total,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });
  } catch (error) {
    console.error('Error fetching news articles by keyword:', error);
    res.status(500).json({ error: 'Failed to fetch news articles' });
  }
});

// POST /api/news/trigger - Manually trigger news collection
router.post('/trigger', async (req, res) => {
  try {
    const scheduler = getNewsScheduler();

    // 非同期で実行（レスポンスを待たない）
    scheduler.runNow().catch(error => {
      console.error('Error during manual news collection:', error);
    });

    res.json({
      message: 'News collection triggered successfully',
      status: 'started',
    });
  } catch (error) {
    console.error('Error triggering news collection:', error);
    res.status(500).json({ error: 'Failed to trigger news collection' });
  }
});

// GET /api/news/stats/summary - Get statistics summary
router.get('/stats/summary', async (req, res) => {
  try {
    const total = await prisma.newsArticle.count();

    const byKeyword = await prisma.newsArticle.groupBy({
      by: ['keyword'],
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayCount = await prisma.newsArticle.count({
      where: {
        collectedAt: {
          gte: today,
        },
      },
    });

    const latest = await prisma.newsArticle.findFirst({
      orderBy: { collectedAt: 'desc' },
      select: {
        collectedAt: true,
      },
    });

    res.json({
      total,
      todayCount,
      byKeyword: byKeyword.map(item => ({
        keyword: item.keyword,
        count: item._count.id,
      })),
      latestCollection: latest?.collectedAt || null,
    });
  } catch (error) {
    console.error('Error fetching news statistics:', error);
    res.status(500).json({ error: 'Failed to fetch news statistics' });
  }
});

// DELETE /api/news/:id - Delete a news article
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.newsArticle.delete({
      where: { id },
    });

    res.json({ message: 'Article deleted successfully' });
  } catch (error) {
    console.error('Error deleting news article:', error);
    res.status(500).json({ error: 'Failed to delete news article' });
  }
});

export default router;
