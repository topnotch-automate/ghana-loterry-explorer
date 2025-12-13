/**
 * SEO Utility Functions
 * Handles dynamic meta tags, structured data, and SEO optimization
 */

export interface SEOData {
  title?: string;
  description?: string;
  keywords?: string[];
  image?: string;
  url?: string;
  type?: 'website' | 'article';
  author?: string;
  publishedTime?: string;
  modifiedTime?: string;
  canonical?: string;
}

const defaultSEO: SEOData = {
  title: 'Ghana Lottery Explorer - Search, Analyze & Predict Lottery Results',
  description: 'Explore Ghana Lottery 5/90 draw results. Search historical draws, analyze number patterns, get hot/cold numbers, and access AI-powered predictions. Free analytics dashboard for lottery enthusiasts.',
  keywords: [
    'Ghana Lottery',
    '5/90 Lottery',
    'Lottery Results',
    'Lottery Analysis',
    'Lottery Predictions',
    'Ghana Lotto',
    'NLA Results',
    'Lottery Statistics',
    'Number Frequency',
    'Lottery Patterns',
    'Ghana Lottery Explorer',
    'Lottery Search',
    'Lottery Analytics'
  ],
  image: '/og-image.png',
  type: 'website',
  canonical: typeof window !== 'undefined' ? window.location.href : '',
};

/**
 * Update document title
 */
export const updateTitle = (title: string): void => {
  if (typeof document !== 'undefined') {
    const fullTitle = title.includes('Ghana Lottery Explorer')
      ? title
      : `${title} | Ghana Lottery Explorer`;
    document.title = fullTitle;
  }
};

/**
 * Update or create meta tag
 */
export const updateMetaTag = (name: string, content: string, attribute: 'name' | 'property' = 'name'): void => {
  if (typeof document === 'undefined') return;

  let element = document.querySelector(`meta[${attribute}="${name}"]`) as HTMLMetaElement;
  
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, name);
    document.head.appendChild(element);
  }
  
  element.setAttribute('content', content);
};

/**
 * Remove meta tag
 */
export const removeMetaTag = (name: string, attribute: 'name' | 'property' = 'name'): void => {
  if (typeof document === 'undefined') return;
  
  const element = document.querySelector(`meta[${attribute}="${name}"]`);
  if (element) {
    element.remove();
  }
};

/**
 * Update canonical URL
 */
export const updateCanonical = (url: string): void => {
  if (typeof document === 'undefined') return;

  let element = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
  
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', 'canonical');
    document.head.appendChild(element);
  }
  
  element.setAttribute('href', url);
};

/**
 * Add structured data (JSON-LD)
 */
export const addStructuredData = (data: object): void => {
  if (typeof document === 'undefined') return;

  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.text = JSON.stringify(data);
  script.id = 'structured-data';
  
  // Remove existing structured data
  const existing = document.getElementById('structured-data');
  if (existing) {
    existing.remove();
  }
  
  document.head.appendChild(script);
};

/**
 * Apply SEO data to the page
 */
export const applySEO = (data: SEOData): void => {
  const seo = { ...defaultSEO, ...data };
  const baseUrl = typeof window !== 'undefined' 
    ? `${window.location.protocol}//${window.location.host}`
    : 'https://yourdomain.com';
  
  // Title
  if (seo.title) {
    updateTitle(seo.title);
  }

  // Basic meta tags
  if (seo.description) {
    updateMetaTag('description', seo.description);
  }

  if (seo.keywords && seo.keywords.length > 0) {
    updateMetaTag('keywords', seo.keywords.join(', '));
  }

  // Open Graph tags
  updateMetaTag('og:title', seo.title || defaultSEO.title!, 'property');
  updateMetaTag('og:description', seo.description || defaultSEO.description!, 'property');
  updateMetaTag('og:type', seo.type || 'website', 'property');
  updateMetaTag('og:url', seo.url || seo.canonical || window.location.href, 'property');
  updateMetaTag('og:image', seo.image ? `${baseUrl}${seo.image}` : `${baseUrl}${defaultSEO.image}`, 'property');
  updateMetaTag('og:site_name', 'Ghana Lottery Explorer', 'property');
  updateMetaTag('og:locale', 'en_US', 'property');

  // Twitter Card tags
  updateMetaTag('twitter:card', 'summary_large_image');
  updateMetaTag('twitter:title', seo.title || defaultSEO.title!);
  updateMetaTag('twitter:description', seo.description || defaultSEO.description!);
  updateMetaTag('twitter:image', seo.image ? `${baseUrl}${seo.image}` : `${baseUrl}${defaultSEO.image}`);

  // Article meta tags (if type is article)
  if (seo.type === 'article') {
    if (seo.author) {
      updateMetaTag('article:author', seo.author, 'property');
    }
    if (seo.publishedTime) {
      updateMetaTag('article:published_time', seo.publishedTime, 'property');
    }
    if (seo.modifiedTime) {
      updateMetaTag('article:modified_time', seo.modifiedTime, 'property');
    }
  }

  // Canonical URL
  if (seo.canonical) {
    updateCanonical(seo.canonical);
  } else if (typeof window !== 'undefined') {
    updateCanonical(window.location.href);
  }

  // Structured Data
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': seo.type === 'article' ? 'Article' : 'WebApplication',
    name: seo.title || defaultSEO.title,
    description: seo.description || defaultSEO.description,
    url: seo.url || seo.canonical || (typeof window !== 'undefined' ? window.location.href : ''),
    applicationCategory: 'UtilityApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    ...(seo.type === 'article' && {
      headline: seo.title,
      author: {
        '@type': 'Organization',
        name: seo.author || 'Ghana Lottery Explorer',
      },
      datePublished: seo.publishedTime,
      dateModified: seo.modifiedTime || seo.publishedTime,
    }),
  };

  addStructuredData(structuredData);
};

/**
 * Generate page-specific SEO data
 */
export const getPageSEO = (pathname: string): SEOData => {
  const baseUrl = typeof window !== 'undefined' 
    ? `${window.location.protocol}//${window.location.host}`
    : 'https://yourdomain.com';

  const seoMap: Record<string, SEOData> = {
    '/': {
      title: 'Ghana Lottery Explorer - Search, Analyze & Predict Lottery Results',
      description: 'Explore Ghana Lottery 5/90 draw results. Search historical draws, analyze number patterns, get hot/cold numbers, and access AI-powered predictions. Free analytics dashboard for lottery enthusiasts.',
      keywords: ['Ghana Lottery', '5/90 Lottery', 'Lottery Results', 'Lottery Analysis', 'Lottery Predictions'],
      url: `${baseUrl}/`,
      canonical: `${baseUrl}/`,
    },
    '/dashboard': {
      title: 'Dashboard - Ghana Lottery Explorer',
      description: 'View latest Ghana Lottery draws, recent results, and analytics dashboard. Get insights into number frequency and patterns.',
      keywords: ['Lottery Dashboard', 'Latest Draws', 'Lottery Statistics', 'Ghana Lottery Results'],
      url: `${baseUrl}/dashboard`,
      canonical: `${baseUrl}/dashboard`,
    },
    '/search': {
      title: 'Search Lottery Draws - Ghana Lottery Explorer',
      description: 'Search Ghana Lottery draws by numbers. Find exact matches, partial matches, or search by winning/machine numbers. Export results to CSV or JSON.',
      keywords: ['Lottery Search', 'Search Draws', 'Find Numbers', 'Lottery Results Search'],
      url: `${baseUrl}/search`,
      canonical: `${baseUrl}/search`,
    },
    '/analytics': {
      title: 'Lottery Analytics - Number Frequency & Patterns',
      description: 'Analyze Ghana Lottery number frequency, hot/cold numbers, sleeping numbers, and co-occurrence patterns. Comprehensive analytics dashboard.',
      keywords: ['Lottery Analytics', 'Number Frequency', 'Hot Numbers', 'Cold Numbers', 'Lottery Patterns'],
      url: `${baseUrl}/analytics`,
      canonical: `${baseUrl}/analytics`,
    },
    '/predictions': {
      title: 'AI-Powered Lottery Predictions - Pro Feature',
      description: 'Get AI-powered lottery predictions using machine learning, genetic algorithms, and pattern analysis. Advanced prediction strategies for Ghana Lottery 5/90.',
      keywords: ['Lottery Predictions', 'AI Predictions', 'ML Predictions', 'Lottery Forecast', 'Predict Numbers'],
      url: `${baseUrl}/predictions`,
      canonical: `${baseUrl}/predictions`,
    },
    '/import': {
      title: 'Import Lottery Draws - Ghana Lottery Explorer',
      description: 'Import Ghana Lottery draw results from CSV files. Bulk import historical data with automatic duplicate detection.',
      keywords: ['Import Draws', 'CSV Import', 'Bulk Import', 'Lottery Data Import'],
      url: `${baseUrl}/import`,
      canonical: `${baseUrl}/import`,
    },
  };

  return seoMap[pathname] || defaultSEO;
};

