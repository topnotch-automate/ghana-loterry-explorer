import { Router } from 'express';
import pool from '../database/db.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * GET /sitemap.xml
 * Generate dynamic sitemap for SEO
 */
router.get('/sitemap.xml', async (req, res) => {
  try {
    const baseUrl = process.env.FRONTEND_URL || 'https://yourdomain.com';
    const currentDate = new Date().toISOString().split('T')[0];

    // Static pages
    const staticPages = [
      { url: '/', priority: '1.0', changefreq: 'daily' },
      { url: '/dashboard', priority: '0.9', changefreq: 'daily' },
      { url: '/search', priority: '0.8', changefreq: 'weekly' },
      { url: '/analytics', priority: '0.8', changefreq: 'daily' },
      { url: '/predictions', priority: '0.7', changefreq: 'weekly' },
      { url: '/import', priority: '0.5', changefreq: 'monthly' },
    ];

    // Get latest draw date for dynamic content
    let latestDrawDate = currentDate;
    try {
      const result = await pool.query(
        'SELECT MAX(draw_date) as latest_date FROM draws LIMIT 1'
      );
      if (result.rows[0]?.latest_date) {
        latestDrawDate = new Date(result.rows[0].latest_date).toISOString().split('T')[0];
      }
    } catch (error) {
      logger.warn('Could not fetch latest draw date for sitemap', error);
    }

    // Generate sitemap XML
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${staticPages
  .map(
    (page) => `  <url>
    <loc>${baseUrl}${page.url}</loc>
    <lastmod>${latestDrawDate}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

    res.set('Content-Type', 'application/xml');
    res.send(sitemap);
  } catch (error) {
    logger.error('Error generating sitemap', error);
    res.status(500).send('Error generating sitemap');
  }
});

/**
 * GET /robots.txt
 * Serve robots.txt file
 */
router.get('/robots.txt', (req, res) => {
  const baseUrl = process.env.FRONTEND_URL || 'https://yourdomain.com';
  
  const robotsTxt = `# robots.txt for Ghana Lottery Explorer
User-agent: *
Allow: /

# Disallow admin/private routes
Disallow: /api/
Disallow: /admin/

# Sitemap location
Sitemap: ${baseUrl}/sitemap.xml

# Crawl-delay (optional, be respectful)
Crawl-delay: 1
`;

  res.set('Content-Type', 'text/plain');
  res.send(robotsTxt);
});

export default router;

