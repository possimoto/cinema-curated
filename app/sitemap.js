export default function sitemap() {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com').replace(/\/$/,'');
  return [{ url: base, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 }];
}
