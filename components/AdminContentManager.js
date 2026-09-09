'use client';

import { useEffect, useMemo, useState } from 'react';

const emptyForm = { title: '', type: '영화', year: '', comment: '', source: '직접 입력' };

export default function AdminContentManager() {
  const [secret, setSecret] = useState('');
  const [status, setStatus] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem('cinema-admin-secret');
    if (saved) setSecret(saved);
  }, []);

  const headers = useMemo(() => ({ 'x-admin-secret': secret, 'Content-Type': 'application/json' }), [secret]);
  const selected = useMemo(() => catalog.find((x) => x.id === selectedId) || null, [catalog, selectedId]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter((x) => [x.title, x.comment, x.source, x.type, x.year].join(' ').toLowerCase().includes(q));
  }, [catalog, query]);

  async function loadCatalog(preferId = null) {
    const res = await fetch('/api/admin/catalog', { headers, cache: 'no-store' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '목록을 불러오지 못했습니다.');
    const items = data.items || [];
    setCatalog(items);
    if (preferId) {
      const item = items.find((x) => x.id === preferId);
      if (item) choose(item);
    }
  }

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

  function choose(item) {
    setIsNew(false);
    setSelectedId(item.id);
    setForm({
      title: item.title || '',
      type: item.type === '시리즈' ? '시리즈' : '영화',
      year: item.year || '',
      comment: item.comment || '',
      source: item.source || '직접 입력',
    });
    setMessage('');
  }

  function startNew() {
    setIsNew(true);
    setSelectedId(null);
    setForm({ ...emptyForm, year: new Date().getFullYear() });
    setMessage('');
  }

  async function enrichTmdb(id) {
    const res = await fetch('/api/admin/tmdb', { method: 'POST', headers, body: JSON.stringify({ ids: [id] }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'TMDB 보강 실패');
    const result = data.results?.[0];
    if (result?.error) throw new Error(result.error);
    return result;
  }

  async function save() {
    setBusy(true); setMessage('');
    try {
      if (!form.title.trim()) throw new Error('작품 제목을 입력해주세요.');
      if (!form.comment.trim()) throw new Error('코멘트를 입력해주세요.');
      if (isNew) {
        const res = await fetch('/api/admin/content', {
          method: 'POST', headers,
          body: JSON.stringify({ ...form, year: Number(form.year) || null }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '작품 추가 실패');
        const id = data.item.id;
        let tmdbText = '';
        if (status?.tmdb) {
          try {
            const result = await enrichTmdb(id);
            tmdbText = result?.tmdbId ? ' · TMDB 자동 연결 완료' : '';
          } catch (e) {
            tmdbText = ` · TMDB 자동 연결은 실패 (${e.message})`;
          }
        }
        await loadCatalog(id);
        setIsNew(false);
        setMessage(`새 작품과 코멘트를 저장했습니다${tmdbText}.`);
      } else {
        if (!selectedId) return;
        const res = await fetch('/api/admin/content', {
          method: 'PATCH', headers,
          body: JSON.stringify({ id: selectedId, patch: { ...form, year: Number(form.year) || null } }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '수정 실패');
        await loadCatalog(selectedId);
        setMessage('작품 정보와 원문 코멘트를 수정했습니다. 공개 사이트에 바로 반영됩니다.');
      }
    } catch (e) { setMessage(e.message); }
    finally { setBusy(false); }
  }

  async function rematchTmdb() {
    if (!selectedId) return;
    setBusy(true); setMessage('');
    try {
      await enrichTmdb(selectedId);
      await loadCatalog(selectedId);
      setMessage('TMDB 메타데이터를 다시 연결했습니다.');
    } catch (e) { setMessage(`TMDB 오류: ${e.message}`); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!selectedId || !selected) return;
    if (!window.confirm(`“${selected.title}” 작품과 코멘트를 영구 삭제할까요?\n이 작업은 되돌릴 수 없습니다.`)) return;
    setBusy(true); setMessage('');
    try {
      const res = await fetch('/api/admin/content', { method: 'DELETE', headers, body: JSON.stringify({ id: selectedId }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '삭제 실패');
      setSelectedId(null); setIsNew(false); setForm(emptyForm);
      await loadCatalog();
      setMessage('작품과 코멘트를 영구 삭제했습니다.');
    } catch (e) { setMessage(e.message); }
    finally { setBusy(false); }
  }

  if (!status) return <main className="admin-shell"><section className="admin-login">
    <p className="kicker">CINEMA, CURATED · CONTENT</p>
    <h1>CONTENT MANAGER</h1>
    <p>새 영화·시리즈와 코멘트를 추가하거나 기존 원문을 수정합니다. 기존 큐레이션 편집과 같은 운영자 비밀번호를 사용합니다.</p>
    <input type="password" value={secret} onChange={(e)=>setSecret(e.target.value)} onKeyDown={(e)=>e.key==='Enter'&&login()} placeholder="ADMIN_SECRET"/>
    <button onClick={login} disabled={busy||!secret}>{busy?'확인 중…':'운영자 로그인'}</button>
    <a href="/admin" style={{display:'inline-block',marginTop:'18px',color:'#a8aaa5'}}>← 큐레이션 스튜디오로</a>
    {message&&<small>{message}</small>}
  </section></main>;

  return <main className="admin-shell">
    <header className="admin-top">
      <div><p className="kicker">CINEMA, CURATED · CONTENT</p><h1>CONTENT MANAGER</h1></div>
      <div className="admin-health"><span>{catalog.length} 작품</span><span>Supabase {status.supabase?'ON':'OFF'}</span><span>TMDB {status.tmdb?'ON':'OFF'}</span><a href="/admin" style={{border:'1px solid #3e423e',borderRadius:'999px',padding:'7px 10px',fontSize:'10px',color:'#d7ff61',textDecoration:'none'}}>큐레이션 편집 →</a></div>
    </header>
    <div className="admin-layout">
      <aside className="admin-list">
        <button onClick={startNew} disabled={busy} style={{background:'#d7ff61',color:'#111',fontWeight:800}}>＋ 새 작품 추가</button>
        <input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="제목·코멘트 검색"/>
        <small>{filtered.length} / {catalog.length}</small>
        <div>{filtered.map((item)=><button key={item.id} className={!isNew&&selectedId===item.id?'active':''} onClick={()=>choose(item)}>
          <strong>{item.title}</strong><span>{item.type} · {item.year || '연도 미상'} {item.metadata?.tmdbId?'· TMDB':''}</span>
        </button>)}</div>
      </aside>
      <section className="admin-editor">
        {!isNew&&!selected?<div className="admin-empty">왼쪽에서 작품을 선택하거나 ‘새 작품 추가’를 누르세요.</div>:<>
          <div className="admin-title"><div><span>{isNew?'NEW TITLE':selected?.id}</span><h2>{isNew?'새 작품 추가':selected?.title}</h2><p>{isNew?'저장 후 TMDB를 자동으로 연결합니다.':'제목·연도·원문 코멘트를 직접 수정할 수 있습니다.'}</p></div>{!isNew&&selected?.metadata?.posterPath&&<img src={`https://image.tmdb.org/t/p/w185${selected.metadata.posterPath}`} alt=""/>}</div>
          <div className="admin-fields">
            <label className="wide">작품 제목<input value={form.title} onChange={(e)=>setForm({...form,title:e.target.value})}/></label>
            <label>유형<select value={form.type} onChange={(e)=>setForm({...form,type:e.target.value})} style={{width:'100%',padding:'12px',background:'#171918',color:'#fff',border:'1px solid #3a3d3a'}}><option value="영화">영화</option><option value="시리즈">시리즈</option></select></label>
            <label>연도<input type="number" min="1888" max="2100" value={form.year} onChange={(e)=>setForm({...form,year:e.target.value})}/></label>
            <label className="wide">출처<input value={form.source} onChange={(e)=>setForm({...form,source:e.target.value})} placeholder="예: 왓챠피디아, 직접 입력"/></label>
            <label className="wide">김정웅의 코멘트 · 원문<textarea value={form.comment} onChange={(e)=>setForm({...form,comment:e.target.value})} style={{minHeight:'260px'}}/></label>
          </div>
          <div className="admin-actions">
            <button className="primary" onClick={save} disabled={busy||!status.supabase}>{busy?'처리 중…':isNew?'작품 + 코멘트 저장':'원문 수정 저장'}</button>
            {!isNew&&<button onClick={rematchTmdb} disabled={busy||!status.tmdb}>TMDB 다시 매칭</button>}
            {!isNew&&<a href="/admin" style={{display:'inline-flex',alignItems:'center',padding:'10px 14px',border:'1px solid #444',color:'#fff',textDecoration:'none'}}>큐레이션 태그 편집</a>}
            {!isNew&&<button onClick={remove} disabled={busy} style={{borderColor:'#7c3f3f',color:'#ff9b90'}}>영구 삭제</button>}
          </div>
          {message&&<div className="admin-message">{message}</div>}
          {!isNew&&<p className="admin-warning">공개에서만 숨기고 싶다면 영구 삭제 대신 큐레이션 스튜디오의 ‘공개 추천에서 숨김’을 사용하세요.</p>}
        </>}
      </section>
    </div>
  </main>;
}
