import axios from 'axios';
import * as cheerio from 'cheerio';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface NewsArticle {
  title: string;
  final_url: string;
  source_domain: string;
  published_at: string;
  content_full: string;
  key_points: string[];
  tags: string[];
  credibility_note: string;
}

interface CollectorConfig {
  keyword: string;
  targetDate?: string;
  maxResults?: number;
}

export class NewsCollectorService {
  private anthropic: Anthropic;
  private googleApiKey: string;
  private googleCseId: string;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set');
    }

    this.anthropic = new Anthropic({
      apiKey: apiKey,
    });

    this.googleApiKey = process.env.GOOGLE_API_KEY || '';
    this.googleCseId = process.env.GOOGLE_CSE_ID || '';
  }

  /**
   * ニュース記事を収集してデータベースに保存
   */
  async collectNews(config: CollectorConfig): Promise<void> {
    const { keyword, targetDate, maxResults = 10 } = config;

    console.log(`[NewsCollector] Starting collection for keyword: ${keyword}`);

    try {
      // Google検索でニュース記事を検索
      const searchResults = await this.searchNews(keyword, maxResults);
      console.log(`[NewsCollector] Found ${searchResults.length} search results`);

      // 各記事を処理
      const articles: NewsArticle[] = [];
      for (const result of searchResults) {
        try {
          // 記事の詳細を取得・分析
          const article = await this.processArticle(result, keyword);
          if (article) {
            articles.push(article);
          }
        } catch (error) {
          console.error(`[NewsCollector] Error processing article: ${result.link}`, error);
          continue;
        }
      }

      console.log(`[NewsCollector] Successfully processed ${articles.length} articles`);

      // データベースに保存
      await this.saveArticles(articles, keyword);

      console.log(`[NewsCollector] Collection completed for keyword: ${keyword}`);
    } catch (error) {
      console.error('[NewsCollector] Error during news collection:', error);
      throw error;
    }
  }

  /**
   * Google Custom Search APIでニュース記事を検索
   */
  private async searchNews(keyword: string, maxResults: number): Promise<any[]> {
    if (!this.googleApiKey || !this.googleCseId) {
      console.warn('[NewsCollector] Google API credentials not set, using fallback method');
      return this.searchNewsFallback(keyword, maxResults);
    }

    const url = 'https://www.googleapis.com/customsearch/v1';
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 2);
    const dateRestrict = 'd2'; // 直近2日間

    try {
      const response = await axios.get(url, {
        params: {
          key: this.googleApiKey,
          cx: this.googleCseId,
          q: `${keyword} ニュース`,
          lr: 'lang_ja',
          dateRestrict: dateRestrict,
          num: Math.min(maxResults, 10),
          sort: 'date',
        },
      });

      return response.data.items || [];
    } catch (error) {
      console.error('[NewsCollector] Google Search API error:', error);
      return this.searchNewsFallback(keyword, maxResults);
    }
  }

  /**
   * フォールバック：Googleニュース検索（スクレイピング）
   */
  private async searchNewsFallback(keyword: string, maxResults: number): Promise<any[]> {
    console.log('[NewsCollector] Using fallback search method');

    const searchUrl = `https://news.google.com/search?q=${encodeURIComponent(keyword + ' キャンプ OR アウトドア')}&hl=ja&gl=JP&ceid=JP:ja`;

    try {
      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      const $ = cheerio.load(response.data);
      const results: any[] = [];

      $('article').each((i, elem) => {
        if (results.length >= maxResults) return false;

        const titleElem = $(elem).find('h3, h4').first();
        const linkElem = $(elem).find('a').first();
        const title = titleElem.text().trim();
        const relativeLink = linkElem.attr('href');

        if (title && relativeLink) {
          // Google Newsの相対URLを処理
          let link = relativeLink;
          if (relativeLink.startsWith('./articles/')) {
            link = `https://news.google.com${relativeLink.substring(1)}`;
          }

          results.push({
            title,
            link,
            snippet: '',
          });
        }
      });

      return results;
    } catch (error) {
      console.error('[NewsCollector] Fallback search error:', error);
      return [];
    }
  }

  /**
   * 記事のコンテンツを取得
   */
  private async fetchArticleContent(url: string): Promise<string> {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        timeout: 10000,
      });

      const $ = cheerio.load(response.data);

      // 不要な要素を削除
      $('script, style, nav, header, footer, aside, .ad, .advertisement').remove();

      // 記事本文を抽出（一般的なセレクタ）
      const articleSelectors = [
        'article',
        '.article-body',
        '.article-content',
        '.post-content',
        '.entry-content',
        'main',
        '.main-content',
      ];

      let content = '';
      for (const selector of articleSelectors) {
        const elem = $(selector).first();
        if (elem.length > 0) {
          content = elem.text().trim();
          if (content.length > 200) {
            break;
          }
        }
      }

      // セレクタで見つからない場合は body から取得
      if (content.length < 200) {
        content = $('body').text().trim();
      }

      // 空白を整理
      content = content.replace(/\s+/g, ' ').trim();

      return content.substring(0, 10000); // 最大10,000文字
    } catch (error) {
      console.error(`[NewsCollector] Error fetching content from ${url}:`, error);
      return '';
    }
  }

  /**
   * Claude APIを使って記事を分析
   */
  private async analyzeArticleWithClaude(
    title: string,
    url: string,
    rawContent: string,
    keyword: string
  ): Promise<NewsArticle | null> {
    const today = new Date().toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const prompt = `あなたは日本語のアウトドア/キャンプ系ニュースを収集するリサーチャーです。
以下の条件で「今日（${today}日本時間）の新しいニュース記事」を調査し、記事本文を元に"ブログ記事が書ける密度"で情報をまとめてください。

【調査テーマ（キーワード）】
${keyword}

【対象期間】
直近24時間〜48時間（可能なら当日）

【言語・地域】
日本語、日本国内の話題を優先

【除外（重要）】
- 関係ない文脈の「キャンプ」「アウトドア」（比喩・ビジネス用語・求人・不動産・広告だけ等）
- 内容が薄い転載・まとめのまとめ
- 公式情報や一次情報に辿れないもの

【記事情報】
タイトル: ${title}
URL: ${url}
記事本文:
${rawContent.substring(0, 5000)}

【必須で集める情報】
1. title：記事タイトル（正確に）
2. final_url：最終的な記事URL
3. source_domain：ドメイン（例：xxx.com）
4. published_at：公開日（YYYY-MM-DD形式。不明な場合は空文字）
5. content_full：記事本文を読み、ブログ記事を書けるくらいの詳細メモ（最低600〜1200字目安）
   - 何が起きた/起きているか（要点）
   - いつ/どこで/誰が（分かる範囲で）
   - 数値・価格・日程・製品名・場所など具体情報
   - 背景/理由/今後の見通し（記事に書かれている範囲）
6. key_points：箇条書きで3〜7点（記事の引用に耐える具体性で）
7. tags：記事のタグ候補（日本語で3〜8個）
8. credibility_note：一次情報の有無（公式発表/当事者/メディア報道 等）を短く

この記事がアウトドア/キャンプ系のニュースとして適切でない場合（除外条件に該当する場合）は、"SKIP"とだけ返答してください。

適切な記事の場合は、以下のJSON形式のみで出力してください。前後に説明文は不要です。
{
  "title": "",
  "final_url": "",
  "source_domain": "",
  "published_at": "",
  "content_full": "",
  "key_points": [],
  "tags": [],
  "credibility_note": ""
}`;

    try {
      const message = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const responseText = message.content[0].type === 'text'
        ? message.content[0].text
        : '';

      if (responseText.trim() === 'SKIP') {
        console.log(`[NewsCollector] Article skipped by Claude: ${url}`);
        return null;
      }

      // JSONを抽出
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('[NewsCollector] No JSON found in Claude response');
        return null;
      }

      const article = JSON.parse(jsonMatch[0]) as NewsArticle;
      return article;
    } catch (error) {
      console.error('[NewsCollector] Error analyzing article with Claude:', error);
      return null;
    }
  }

  /**
   * 記事を処理
   */
  private async processArticle(searchResult: any, keyword: string): Promise<NewsArticle | null> {
    const url = searchResult.link;
    const title = searchResult.title;

    console.log(`[NewsCollector] Processing article: ${title}`);

    // 記事コンテンツを取得
    const rawContent = await this.fetchArticleContent(url);
    if (!rawContent || rawContent.length < 200) {
      console.log(`[NewsCollector] Insufficient content for: ${url}`);
      return null;
    }

    // Claudeで分析
    const article = await this.analyzeArticleWithClaude(title, url, rawContent, keyword);
    return article;
  }

  /**
   * 記事をデータベースに保存
   */
  private async saveArticles(articles: NewsArticle[], keyword: string): Promise<void> {
    for (const article of articles) {
      try {
        // 既存の記事をチェック（URLで重複チェック）
        const existing = await prisma.newsArticle.findUnique({
          where: { finalUrl: article.final_url },
        });

        if (existing) {
          console.log(`[NewsCollector] Article already exists: ${article.final_url}`);
          continue;
        }

        // 新規保存
        await prisma.newsArticle.create({
          data: {
            title: article.title,
            finalUrl: article.final_url,
            sourceDomain: article.source_domain,
            publishedAt: article.published_at || null,
            contentFull: article.content_full,
            keyPoints: article.key_points,
            tags: article.tags,
            credibilityNote: article.credibility_note || null,
            keyword: keyword,
          },
        });

        console.log(`[NewsCollector] Saved article: ${article.title}`);
      } catch (error) {
        console.error(`[NewsCollector] Error saving article: ${article.title}`, error);
      }
    }
  }

  /**
   * 手動実行用のメソッド
   */
  async runManual(keyword: string): Promise<void> {
    await this.collectNews({ keyword });
  }
}

// シングルトンインスタンス
let collectorInstance: NewsCollectorService | null = null;

export function getNewsCollector(): NewsCollectorService {
  if (!collectorInstance) {
    collectorInstance = new NewsCollectorService();
  }
  return collectorInstance;
}
