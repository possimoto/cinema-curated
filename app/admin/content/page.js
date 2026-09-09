import AdminContentManager from '../../../components/AdminContentManager';

export const metadata = { title: 'Content Manager · Cinema, Curated', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default function AdminContentPage() { return <AdminContentManager />; }
