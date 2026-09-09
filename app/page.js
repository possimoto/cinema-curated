import CinemaApp from '../components/CinemaApp';
import archive from '../data/archive.json';
import curated from '../data/curated.json';
import stats from '../data/stats.json';
import { loadRuntimeData } from '../lib/runtimeData';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const runtime = await loadRuntimeData();
  return <CinemaApp archive={archive} curated={curated} stats={stats} tmdb={runtime.tmdb} overrides={runtime.overrides} runtimeSource={runtime.source} />;
}
