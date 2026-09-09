export default function robots() {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';
  return { rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api/admin'] }], sitemap: `${base.replace(/\/$/,'')}/sitemap.xml` };
}
