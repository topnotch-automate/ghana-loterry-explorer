import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { applySEO, getPageSEO } from '../utils/seo';

/**
 * SEO Component
 * Automatically updates meta tags and structured data based on current route
 */
export const SEO: React.FC<{ customSEO?: Partial<ReturnType<typeof getPageSEO>> }> = ({ customSEO }) => {
  const location = useLocation();

  useEffect(() => {
    const pageSEO = getPageSEO(location.pathname);
    const seo = customSEO ? { ...pageSEO, ...customSEO } : pageSEO;
    
    applySEO(seo);
  }, [location.pathname, customSEO]);

  return null;
};

