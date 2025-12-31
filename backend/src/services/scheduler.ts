import * as cron from 'node-cron';
import { getNewsCollector } from './newsCollector';

/**
 * ニュース収集のスケジューラー
 */
export class NewsScheduler {
  private tasks: cron.ScheduledTask[] = [];

  /**
   * スケジューラーを開始
   */
  start(): void {
    console.log('[NewsScheduler] Starting news collection scheduler');

    // デフォルトのキーワードリスト
    const keywords = this.getKeywords();

    // 毎日朝6時（日本時間）にニュース収集を実行
    // cron形式: 秒 分 時 日 月 曜日
    // JST (UTC+9) で朝6時は、UTCで前日21時（または当日21時、タイムゾーン設定による）
    // ここでは環境のタイムゾーンに依存する形で設定
    const cronExpression = '0 6 * * *'; // 毎日6:00

    const task = cron.schedule(
      cronExpression,
      async () => {
        console.log('[NewsScheduler] Starting scheduled news collection at', new Date().toISOString());

        try {
          const collector = getNewsCollector();

          // 各キーワードで順番にニュース収集
          for (const keyword of keywords) {
            console.log(`[NewsScheduler] Collecting news for keyword: ${keyword}`);
            await collector.collectNews({ keyword, maxResults: 10 });

            // API負荷を考慮して少し待機
            await this.sleep(5000);
          }

          console.log('[NewsScheduler] Scheduled news collection completed');
        } catch (error) {
          console.error('[NewsScheduler] Error during scheduled collection:', error);
        }
      },
      {
        scheduled: true,
        timezone: 'Asia/Tokyo', // 日本時間
      }
    );

    this.tasks.push(task);

    console.log(`[NewsScheduler] Scheduler started. Next run: ${this.getNextRun()}`);
    console.log(`[NewsScheduler] Monitoring keywords: ${keywords.join(', ')}`);

    // 起動時に一度実行するかどうか（開発時は便利）
    if (process.env.RUN_ON_STARTUP === 'true') {
      console.log('[NewsScheduler] Running initial collection on startup');
      this.runNow();
    }
  }

  /**
   * スケジューラーを停止
   */
  stop(): void {
    console.log('[NewsScheduler] Stopping scheduler');
    this.tasks.forEach(task => task.stop());
    this.tasks = [];
  }

  /**
   * 今すぐニュース収集を実行（手動トリガー用）
   */
  async runNow(): Promise<void> {
    console.log('[NewsScheduler] Manual trigger: starting news collection');

    try {
      const collector = getNewsCollector();
      const keywords = this.getKeywords();

      for (const keyword of keywords) {
        console.log(`[NewsScheduler] Collecting news for keyword: ${keyword}`);
        await collector.collectNews({ keyword, maxResults: 10 });
        await this.sleep(5000);
      }

      console.log('[NewsScheduler] Manual collection completed');
    } catch (error) {
      console.error('[NewsScheduler] Error during manual collection:', error);
      throw error;
    }
  }

  /**
   * 次回実行時刻を取得
   */
  private getNextRun(): string {
    const now = new Date();
    const next = new Date();
    next.setHours(6, 0, 0, 0);

    // 既に6時を過ぎている場合は翌日
    if (now.getHours() >= 6) {
      next.setDate(next.getDate() + 1);
    }

    return next.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
  }

  /**
   * 監視するキーワードを取得
   */
  private getKeywords(): string[] {
    // 環境変数から取得、またはデフォルト値
    const keywordsEnv = process.env.NEWS_KEYWORDS;

    if (keywordsEnv) {
      return keywordsEnv.split(',').map(k => k.trim());
    }

    // デフォルトのキーワードリスト
    return [
      'キャンプ',
      'アウトドア',
      'ソロキャンプ',
      'キャンプギア',
      '焚き火',
    ];
  }

  /**
   * 待機
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// シングルトンインスタンス
let schedulerInstance: NewsScheduler | null = null;

export function getNewsScheduler(): NewsScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new NewsScheduler();
  }
  return schedulerInstance;
}
