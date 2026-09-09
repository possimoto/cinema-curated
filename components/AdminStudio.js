'use client';

import { useEffect, useMemo, useState } from 'react';

const parseList = (value) => String(value || '').split(',').map((x) => x.trim()).filter(Boolean);
const joinList = (value) => (value || []).join(', ');

export default function AdminStudio() {
  const [secret, setSecret] = useState('');
  const [status, setStatus] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem('cinema-admin-secret');
    if (saved) setSecret(saved);
  }, []);

  const headers = useMemo(() => ({ 'x-admin-secret': secret, 'Content-Type': 'application/json' }), [secret]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter((x) => [x.title, x.comment, ...(x.themes || []), ...(x.metadata?.genres || []), ...(x.metadata?.directors || [])].join(' ').toLowerCase().includes(q));
  }, [catalog, query]);

  async function login() {
    setBusy(true); setMessage('');
    try {
      const res = await fetch('/api/admin/status', { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '인증 실패');
      sessionStorage.setItem('cinema-admin-secret', secret);
      setStatus(data);
      await loadCatalog();
    } catch (e) { setMessage(e.message); }
    finally { setBusy(false); }
  }

  async function loadCatalog() {
    const res = await fetch('/api/admin/catalog', { headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '목록을 불러오지 못했습니다.');
    setCatalog(data.items || []);
  }

  function choose(item) {
    setSelected(item);
    const ov = item.override || {};
    const c = item.curated || {};
    setForm({
      themes: joinList(ov.themes?.length ? ov.themes : item.themes),
      moods: joinList(ov.moods?.length ? ov.moods : c.moods || item.moods),
      outcomes: joinList(ov.outcomes?.length ? ov.outcomes : c.outcomes || item.outcomes),
      audiences: joinList(ov.audiences?.length ? ov.audiences : c.audiences || item.audiences),
      why: ov.why || c.why || '',
      quote: ov.quote || c.quote || '',
      intensity: ov.intensity ?? c.intensity ?? item.intensity ?? 2,
      hidden: Boolean(ov.hidden),
    });
    setMessage('');
  }

  async function save() {
    if (!selected || !form) return;
    setBusy(true); setMessage('');
    try {
      const res = await fetch('/api/admin/update', {
        method: 'POST', headers,
        body: JSON.stringify({
          id: selected.id,
          patch: {
            themes: parseList(form.themes), moods: parseList(form.moods), outcomes: parseList(form.outcomes), audiences: parseList(form.audiences),
            why: form.why.trim(), quote: form.quote.trim(), intensity: Number(form.intensity), hidden: form.hidden,
          }
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '저장 실패');
      setMessage('큐레이션 오버라이드를 저장했습니다.');
      await loadCatalog();
    } catch (e) { setMessage(e.message); }
    finally { setBusy(false); }
  }

  async function enrichTmdb() {
    if (!selected) return;
    setBusy(true); setMessage('');
    try {
      const res = await fetch('/api/admin/tmdb', { method: 'POST', headers, body: JSON.stringify({ ids: [selected.id] }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'TMDB 보강 실패');
      setMessage(data.results?.[0]?.error ? `TMDB 오류: ${data.results[0].error}` : 'TMDB 메타데이터를 저장했습니다.');
      await loadCatalog();
    } catch (e) { setMessage(e.message); }
    finally { setBusy(false); }
  }

  function exportJson() {
    if (!selected || !form) return;
    const blob = new Blob([JSON.stringify({ title_id: selected.id, ...form, themes: parseList(form.themes), moods: parseList(form.moods), outcomes: parseList(form.outcomes), audiences: parseList(form.audiences) }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${selected.id}-curation.json`; a.click(); URL.revokeObjectURL(a.href);
  }

  if (!status) return <main className="admin-shell"><section className="admin-login"><p className="kicker">CINEMA, CURATED · ADMIN</p><h1>CURATION STUDIO</h1><p>공개 서비스의 원문은 건드리지 않고, 추천 태그와 큐레이션 레이어만 관리합니다.</p><input type="password" value={secret} onChange={(e)=>setSecret(e.target.value)} onKeyDown={(e)=>e.key==='Enter'&&login()} placeholder="ADMIN_SECRET"/><button onClick={login} disabled={busy||!secret}>{busy?'확인 중…':'운영자 로그인'}</button>{message&&<small>{message}</small>}</section></main>;

  return <main className="admin-shell">
    <header className="admin-top"><div><p className="kicker">CINEMA, CURATED · ADMIN</p><h1>CURATION STUDIO</h1></div><div className="admin-health"><span>Supabase {status.supabase?'ON':'OFF'}</span><span>TMDB {status.tmdb?'ON':'OFF'}</span><span>OpenAI {status.openai?'ON':'OFF'}</span></div></header>
    <div className="admin-layout">
      <aside className="admin-list"><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="549개 기록 검색"/><small>{filtered.length} / {catalog.length}</small><div>{filtered.map((item)=><button key={item.id} className={selected?.id===item.id?'active':''} onClick={()=>choose(item)}><strong>{item.title}</strong><span>{item.type} · {item.year} {item.metadata?.tmdbId?'· TMDB':''}</span></button>)}</div></aside>
      <section className="admin-editor">
        {!selected?<div className="admin-empty">왼쪽에서 작품을 선택하세요.</div>:<>
          <div className="admin-title"><div><span>{selected.id}</span><h2>{selected.title}</h2><p>{selected.type} · {selected.year}</p></div>{selected.metadata?.posterPath&&<img src={`https://image.tmdb.org/t/p/w185${selected.metadata.posterPath}`} alt=""/>}</div>
          <div className="admin-source"><h3>원문 코멘트 · 읽기 전용</h3><blockquote>{selected.comment}</blockquote></div>
          <div className="admin-fields">
            <label>주제 태그<input value={form.themes} onChange={(e)=>setForm({...form,themes:e.target.value})}/></label>
            <label>기분 태그<input value={form.moods} onChange={(e)=>setForm({...form,moods:e.target.value})}/></label>
            <label>관람 후 효과<input value={form.outcomes} onChange={(e)=>setForm({...form,outcomes:e.target.value})}/></label>
            <label>관람 상황<input value={form.audiences} onChange={(e)=>setForm({...form,audiences:e.target.value})}/></label>
            <label className="wide">왜 이 작품인가<textarea value={form.why} onChange={(e)=>setForm({...form,why:e.target.value})}/></label>
            <label className="wide">대표 근거 문장<textarea value={form.quote} onChange={(e)=>setForm({...form,quote:e.target.value})}/></label>
            <label>강도 (1~5)<input type="number" min="1" max="5" value={form.intensity} onChange={(e)=>setForm({...form,intensity:e.target.value})}/></label>
            <label className="check"><input type="checkbox" checked={form.hidden} onChange={(e)=>setForm({...form,hidden:e.target.checked})}/> 공개 추천에서 숨김</label>
          </div>
          <div className="admin-actions"><button className="primary" onClick={save} disabled={busy||!status.supabase}>저장</button><button onClick={enrichTmdb} disabled={busy||!status.tmdb||!status.supabase}>TMDB 메타데이터 보강</button><button onClick={exportJson}>JSON 내보내기</button></div>
          {message&&<div className="admin-message">{message}</div>}
          {!status.supabase&&<p className="admin-warning">Supabase가 연결되지 않아 저장은 비활성화되어 있습니다. JSON 내보내기는 사용할 수 있습니다.</p>}
        </>}
      </section>
    </div>
  </main>;
}
