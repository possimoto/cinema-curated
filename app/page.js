import CinemaApp from '../components/CinemaApp';
import curated from '../data/curated.json';
import { loadRuntimeData } from '../lib/runtimeData';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const runtime = await loadRuntimeData();
  const archive = runtime.archive || [];
  const stats = {
    total: archive.length,
    movies: archive.filter((item) => item.type === '영화').length,
    series: archive.filter((item) => item.type === '시리즈').length,
  };
  return <CinemaApp archive={archive} curated={curated} stats={stats} tmdb={runtime.tmdb} overrides={runtime.overrides} runtimeSource={runtime.source} />;
}
