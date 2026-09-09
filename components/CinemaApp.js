'use client';

import { useEffect, useMemo, useState } from 'react';

const quickMoods = [
  '지쳤는데 조용히 회복하고 싶어',
  '답답해서 강한 카타르시스가 필요해',
  '연인과 보고 오래 이야기하고 싶어',
  '아이와 함께 볼 수 있는 영화',
  '아무 생각 없이 재미있는 영화',
  '영화를 보고 삶을 좀 정리하고 싶어'
];

const lenses = [
  ['선택과 책임','인간은 무엇을 선택하고 그 결과에 어떻게 응답하는가'],
  ['욕망과 자기파괴','욕망이 끝까지 밀려갔을 때 무엇이 남는가'],
  ['삶의 태도','변하는 세계에서 내가 붙잡을 수 있는 삶의 방식'],
  ['폭력과 역사','지배와 죽음이 반복되는 역사 속 개인의 위치'],
  ['장르적 성취','장르의 문법을 이해하고 제대로 밀어붙였는가']
];

const uniq = arr => [...new Set(arr.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'ko'));
const excerpt = (s,n=170) => { const x=String(s||'').replace(/\s+/g,' ').trim(); return x.slice(0,n)+(x.length>n?'…':''); };
const byTitleMap = list => new Map(list.map(x=>[x.title,x]));
const byIdMap = list => new Map(list.map(x=>[x.id,x]));

function randomRank(value,seed){
  let h=(2166136261^seed)>>>0;
  const text=String(value||'');
  for(let i=0;i<text.length;i++) h=Math.imul(h^text.charCodeAt(i),16777619)>>>0;
  h^=h>>>16;h=Math.imul(h,2246822507)>>>0;h^=h>>>13;h=Math.imul(h,3266489909)>>>0;h^=h>>>16;
  return h>>>0;
}

function normalizeMood(q){
  const rules=[
    {keys:['지쳐','지쳤','피곤','무기력','힘들','번아웃','회복'],themes:['삶의 태도'],outcomes:['회복','위로','정돈']},
    {keys:['답답','열받','분노','화나','스트레스'],themes:['장르적 성취'],outcomes:['카타르시스','몰입']},
    {keys:['외롭','쓸쓸','혼자'],themes:['관계와 사랑'],outcomes:['위로','여운']},
    {keys:['연인','데이트','애인','커플'],audiences:['연인'],themes:['관계와 사랑'],outcomes:['여운','생각']},
    {keys:['아이','자녀','어린이'],audiences:['아이와','가족'],outcomes:['즐거움','감동']},
    {keys:['가족','부모'],audiences:['가족'],themes:['관계와 사랑'],outcomes:['감동','여운']},
    {keys:['생각','정리','철학','고민','복잡'],outcomes:['생각','정돈','여운']},
    {keys:['액션','전율','강렬','몰입'],themes:['장르적 성취'],outcomes:['몰입','카타르시스']},
    {keys:['AI','인공지능','기술','로봇'],themes:['기술과 인간'],outcomes:['생각']},
    {keys:['욕망','집착','자기파괴'],themes:['욕망과 자기파괴'],outcomes:['생각']},
    {keys:['전쟁','역사','폭력'],themes:['폭력과 역사'],outcomes:['생각','몰입']}
  ];
  const r={themes:[],outcomes:[],audiences:[]};
  for(const x of rules){if(x.keys.some(k=>q.includes(k))){for(const k of ['themes','outcomes','audiences']) if(x[k]) r[k].push(...x[k]);}}
  return r;
}

function localScore(m,q,intent,isCurated){
  const blob=[m.title,m.comment,m.fullComment,m.why,...(m.themes||[]),...(m.critiqueTags||[]),...(m.moods||[]),...(m.outcomes||[]),...(m.audiences||[])].join(' ').toLowerCase();
  let s=isCurated?46:30;
  q.toLowerCase().split(/\s+/).filter(t=>t.length>1).forEach(t=>{if(blob.includes(t))s+=3;});
  intent.themes.forEach(t=>m.themes?.includes(t)&&(s+=11));
  intent.outcomes.forEach(t=>m.outcomes?.includes(t)&&(s+=9));
  intent.audiences.forEach(t=>m.audiences?.includes(t)&&(s+=12));
  if(!isCurated){s+=((m.toneScore??50)-50)*0.1;if((m.toneScore??50)<35)s-=10;}
  return Math.max(20,Math.min(99,Math.round(s)));
}

function Poster({item,meta}){
  const url=meta?.posterPath?`https://image.tmdb.org/t/p/w500${meta.posterPath}`:null;
  if(url) return <img className="poster-img" src={url} alt={`${item.title} 포스터`} />;
  return <div className="poster-fallback"><span>{item.type} · {item.year}</span><strong>{item.title}</strong></div>;
}

function Card({item,curated,meta,scoreValue,onOpen,reason,evidence}){
  const base=curated||item;
  return <button className="movie-card" onClick={onOpen}>
    <div className="poster-wrap"><Poster item={item} meta={meta}/>{meta?.confidence&&<span className={`meta-dot ${meta.confidence}`}>{meta.confidence}</span>}</div>
    <div className="card-body">
      <div className="eyebrow">{reason?'RECOMMENDED':curated?'CURATED':'ARCHIVE'} · {item.year}</div>
      <h3>{item.title}</h3>
      <p>{reason||curated?.why||excerpt(item.comment)}</p>
      {evidence&&<div className="evidence-line">“{excerpt(evidence,108)}”</div>}
      <div className="tags">{(base.themes||item.themes||[]).slice(0,3).map(t=><span key={t}>#{t}</span>)}</div>
      <div className="card-foot"><span>{scoreValue?`${scoreValue}%`:item.type}</span><span>자세히 →</span></div>
    </div>
  </button>;
}

function EngineBadge({result,health}){
  if(!result && !health) return null;
  const mode=result?.mode;
  const label = mode==='rag-supabase'?'VECTOR RAG · SUPABASE':mode==='rag-local-vector'?'VECTOR RAG · LOCAL':mode==='grounded-ai'?'GROUNDED AI':mode==='grounded-keyword'?'SOURCE SEARCH':health?.openai?'AI READY':'LOCAL READY';
  return <span className={`engine-badge ${mode||''}`}>{label}</span>;
}

function buildRuntimeCatalog(archive, curated, tmdb, overrides){
  const curatedById=new Map();
  for(const c of curated) for(const id of c.archiveIds||[]) curatedById.set(id,c);
  const visible=[]; const effectiveCurated=[];
  for(const raw of archive){
    const ov=overrides?.[raw.id]||{};
    if(ov.hidden) continue;
    const c=curatedById.get(raw.id)||null;
    const has=k=>Array.isArray(ov[k])&&ov[k].length>0;
    const meta=tmdb?.[raw.id]||null;
    const item={
      ...raw,
      themes:has('themes')?ov.themes:raw.themes,
      moods:has('moods')?ov.moods:raw.moods,
      outcomes:has('outcomes')?ov.outcomes:raw.outcomes,
      audiences:has('audiences')?ov.audiences:raw.audiences,
      intensity:ov.intensity??raw.intensity,
      directors:uniq([...(meta?.directors||[]),...(c?.director?[c.director]:[])]),
      actors:uniq([...(meta?.cast||[]).map(x=>x.name),...(c?.actors||[])]),
      genres:uniq([...(meta?.genres||[]),...(c?.genres||[])]),
    };
    item.directors=uniq(item.directors||[]);
    visible.push(item);
    if(c||ov.why||ov.quote||has('audiences')) effectiveCurated.push({
      ...(c||{id:`override-${raw.id}`,title:raw.title,year:raw.year,type:raw.type,archiveIds:[raw.id]}),
      why:ov.why||c?.why||'', quote:ov.quote||c?.quote||'',
      themes:has('themes')?ov.themes:c?.themes||item.themes,
      moods:has('moods')?ov.moods:c?.moods||item.moods,
      outcomes:has('outcomes')?ov.outcomes:c?.outcomes||item.outcomes,
      audiences:has('audiences')?ov.audiences:c?.audiences||item.audiences,
      intensity:ov.intensity??c?.intensity??item.intensity,
      director:c?.director||item.directors?.[0]||'', actors:item.actors, genres:item.genres,
    });
  }
  return {archive:visible,curated:effectiveCurated};
}

export default function CinemaApp({archive,curated,stats,tmdb,overrides={},runtimeSource='local'}){
  const runtime=useMemo(()=>buildRuntimeCatalog(archive,curated,tmdb,overrides),[archive,curated,tmdb,overrides]);
  const liveArchive=runtime.archive, liveCurated=runtime.curated;
  const [mode,setMode]=useState('all');
  const [query,setQuery]=useState('');
  const [selectedFacets,setSelectedFacets]=useState([]);
  const [shuffleSeed,setShuffleSeed]=useState(0);
  const [limit,setLimit]=useState(48);
  const [mood,setMood]=useState('');
  const [recommendations,setRecommendations]=useState([]);
  const [recommendResult,setRecommendResult]=useState(null);
  const [recommendStatus,setRecommendStatus]=useState('');
  const [health,setHealth]=useState(null);
  const [selected,setSelected]=useState(null);
  const [liveMeta,setLiveMeta]=useState(null);
  const [metaStatus,setMetaStatus]=useState('');
  const curatedByTitle=useMemo(()=>byTitleMap(liveCurated),[liveCurated]);
  const archiveByTitle=useMemo(()=>byTitleMap(liveArchive),[liveArchive]);
  const archiveById=useMemo(()=>byIdMap(liveArchive),[liveArchive]);
  const metadataCount=useMemo(()=>Object.values(tmdb||{}).filter(x=>x?.status==='matched').length,[tmdb]);

  useEffect(()=>{ fetch('/api/health').then(r=>r.ok?r.json():null).then(setHealth).catch(()=>{}); },[]);
  useEffect(()=>{ setShuffleSeed(Math.floor(Math.random()*2147483647)+1); },[]);

  const facets=useMemo(()=>{
    if(mode==='theme') return uniq(liveArchive.flatMap(x=>x.themes||[]));
    if(mode==='type') return uniq(liveArchive.map(x=>x.type));
    if(mode==='year') return uniq(liveArchive.map(x=>x.year)).sort((a,b)=>b-a);
    if(mode==='director') return uniq(liveArchive.flatMap(x=>x.directors||[]));
    if(mode==='actor') return uniq(liveArchive.flatMap(x=>x.actors||[]));
    if(mode==='genre') return uniq(liveArchive.flatMap(x=>x.genres||[]));
    if(mode==='audience') return uniq(liveArchive.flatMap(x=>x.audiences||[]));
    return [];
  },[mode,liveArchive]);

  function toggleFacet(value){
    const key=String(value);
    setSelectedFacets(current=>current.includes(key)?current.filter(x=>x!==key):[...current,key]);
    setLimit(48);
  }

  const filtered=useMemo(()=>{
    const q=query.trim().toLowerCase();
    return liveArchive.filter(m=>{
      let ok=true;
      if(selectedFacets.length){
        if(mode==='theme') ok=(m.themes||[]).some(x=>selectedFacets.includes(String(x)));
        else if(mode==='type') ok=selectedFacets.includes(String(m.type));
        else if(mode==='year') ok=selectedFacets.includes(String(m.year));
        else if(mode==='director') ok=(m.directors||[]).some(x=>selectedFacets.includes(String(x)));
        else if(mode==='actor') ok=(m.actors||[]).some(x=>selectedFacets.includes(String(x)));
        else if(mode==='genre') ok=(m.genres||[]).some(x=>selectedFacets.includes(String(x)));
        else if(mode==='audience') ok=(m.audiences||[]).some(x=>selectedFacets.includes(String(x)));
      }
      if(!ok) return false;
      if(!q) return true;
      return [m.title,m.comment,...(m.directors||[]),...(m.actors||[]),...(m.genres||[]),...(m.themes||[])].join(' ').toLowerCase().includes(q);
    }).sort((a,b)=>randomRank(a.id,shuffleSeed)-randomRank(b.id,shuffleSeed));
  },[mode,liveArchive,query,selectedFacets,shuffleSeed]);

  function localFallback(q){
    const intent=normalizeMood(q); const used=new Set(); const candidates=[];
    liveCurated.forEach(m=>{const item=archiveByTitle.get(m.title)||m;candidates.push({item,curated:m,score:localScore({...item,...m},q,intent,true),reason:m.why,evidence:m.quote});used.add(m.title);});
    liveArchive.forEach(m=>{if(!used.has(m.title))candidates.push({item:m,curated:null,score:localScore(m,q,intent,false),reason:null,evidence:excerpt(m.comment,130)});});
    return candidates.sort((a,b)=>b.score-a.score).slice(0,6);
  }

  async function runRecommend(text=mood){
    const q=text.trim(); if(!q)return;
    setRecommendStatus('549개의 감상 기록에서 근거를 찾는 중…'); setRecommendResult(null); setRecommendations([]);
    try{
      const res=await fetch('/api/recommend',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:q})});
      const data=await res.json(); if(!res.ok) throw new Error(data.error||'추천 요청 실패');
      const hydrated=(data.recommendations||[]).map(rec=>{const item=archiveById.get(rec.id);if(!item)return null;return {item,curated:curatedByTitle.get(item.title)||null,score:rec.score,reason:rec.why,evidence:rec.evidence,semanticSimilarity:rec.semanticSimilarity};}).filter(Boolean);
      setRecommendations(hydrated);setRecommendResult(data);setRecommendStatus('');
    }catch(e){setRecommendations(localFallback(q));setRecommendResult({mode:'grounded-keyword',intro:'서버 추천 엔진에 연결하지 못해 브라우저 내부의 549개 기록 검색으로 전환했습니다.',notice:e.message});setRecommendStatus('');}
  }

  async function loadLiveMeta(item){
    setMetaStatus('불러오는 중…');setLiveMeta(null);
    try{const res=await fetch(`/api/tmdb/search?query=${encodeURIComponent(item.title)}&type=${encodeURIComponent(item.type)}&year=${item.year}`);const data=await res.json();if(!res.ok)throw new Error(data.error||'메타데이터 조회 실패');setLiveMeta(data.match);setMetaStatus(data.match?'TMDB 메타데이터를 불러왔습니다.':'일치하는 작품을 찾지 못했습니다.');}catch(e){setMetaStatus(e.message);}
  }

  function open(item,curatedItem){setSelected({item,curated:curatedItem||curatedByTitle.get(item.title)||null});setLiveMeta(null);setMetaStatus('');}
  const selectedMeta=selected?liveMeta||tmdb?.[selected.item.id]||null:null;

  return <main>
    <header className="hero">
      <div className="topline"><span>CINEMA, CURATED</span><span>v1.0 · PERSONAL CINEMA CURATION</span></div>
      <div className="hero-grid">
        <div><p className="kicker">A PERSONAL CINEMA CURATION ENGINE</p><h1>영화를 고르는 것이 아니라,<br/><em>영화를 읽는 방식</em>을 추천합니다.</h1><p className="lead">549개의 감상 기록과 반복되는 비평의 문법에서 출발한 개인 시네마 큐레이션. 자연어 질문을 실제 코멘트와 연결해 추천 이유를 근거와 함께 제시합니다.</p></div>
        <div className="hero-stat"><strong>{stats.total}</strong><span>개의 감상 기록</span><div><b>{stats.movies}</b> 영화 · <b>{stats.series}</b> 시리즈</div>{health&&<div className="healthline"><EngineBadge health={health}/><small>{health.localVector?.available?`${health.localVector.count} vector indexed`:health.openai?'embedding 준비 가능':'API 없이도 검색 가능'} · metadata {metadataCount}</small></div>}</div>
      </div>
    </header>

    <section className="recommend-panel">
      <div className="section-head"><div><span>01</span><h2>오늘의 나에게</h2></div><p>현재 기분과 보고 난 뒤 원하는 상태를 자연어로 적어보세요.</p></div>
      <div className="mood-box"><textarea value={mood} onChange={e=>setMood(e.target.value)} placeholder="예: 오늘 너무 지쳤는데 감상적인 위로보다는 삶을 다시 정돈하고 싶어."/><button disabled={Boolean(recommendStatus)} onClick={()=>runRecommend()}>{recommendStatus?'찾는 중…':'추천 받기'}</button></div>
      <div className="quick-row">{quickMoods.map(x=><button key={x} onClick={()=>{setMood(x);runRecommend(x)}}>{x}</button>)}</div>
      <p className="privacy-note">OpenAI가 연결된 운영 환경에서는 추천 질문이 서버를 통해 모델 API에 전달될 수 있습니다. 원문 감상 기록은 후보 근거로만 사용되며, 비밀 API 키는 브라우저에 노출하지 않습니다.</p>
      {recommendStatus&&<div className="recommend-loading"><span></span>{recommendStatus}</div>}
      {recommendResult&&<div className="ai-answer"><div className="ai-answer-head"><EngineBadge result={recommendResult}/><span>{recommendResult.model||'source-grounded'}</span></div><p>{recommendResult.intro}</p>{recommendResult.notice&&<small>{recommendResult.notice}</small>}</div>}
      {recommendations.length>0&&<div className="recommend-results"><div className="result-note">추천 문장 아래의 인용은 실제 감상 기록에서 가져온 근거입니다. AI가 외부 줄거리나 평론을 리뷰어의 생각처럼 덧붙이지 않도록 제한했습니다.</div><div className="grid">{recommendations.map(x=><Card key={x.item.id} item={x.item} curated={x.curated} meta={tmdb?.[x.item.id]} scoreValue={x.score} reason={x.reason} evidence={x.evidence} onOpen={()=>open(x.item,x.curated)}/>)}</div></div>}
    </section>

    <section className="archive-section">
      <div className="section-head"><div><span>02</span><h2>아카이브 탐색</h2></div><p>페이지를 열 때마다 작품 순서는 새롭게 섞입니다. 세부 필터는 여러 개를 동시에 선택할 수 있습니다.</p></div>
      <div className="tabs">{[['all','전체'],['theme','주제'],['type','유형'],['year','연도'],['genre','장르'],['director','감독'],['actor','배우'],['audience','관람상황']].map(([k,l])=><button className={mode===k?'active':''} key={k} onClick={()=>{setMode(k);setSelectedFacets([]);setLimit(48)}}>{l}</button>)}</div>
      <div className="searchline"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="영화, 코멘트, 감독, 배우, 주제 검색"/><span>{filtered.length} titles{selectedFacets.length?` · ${selectedFacets.length} filters`:''}</span></div>
      {facets.length>0&&<><div className="facets">{facets.map(f=>{const active=selectedFacets.includes(String(f));return <button className={active?'active':''} aria-pressed={active} key={f} onClick={()=>toggleFacet(f)}>{f}</button>;})}</div>{selectedFacets.length>0&&<p className="subnote">복수 선택 중 · 선택한 조건 중 하나라도 포함된 작품을 표시합니다. <button onClick={()=>setSelectedFacets([])} style={{border:0,background:'transparent',color:'inherit',textDecoration:'underline',cursor:'pointer',padding:0}}>전체 해제</button></p>}</>}
      {['genre','director','actor'].includes(mode)&&metadataCount<liveArchive.length&&<p className="subnote">현재 {metadataCount}편에 외부 작품 메타데이터가 연결되어 있습니다. TMDB 보강이 진행될수록 필터 범위가 자동으로 넓어집니다.</p>}
      <div className="grid">{filtered.slice(0,limit).map(item=>{const c=curatedByTitle.get(item.title);return <Card key={item.id} item={item} curated={c} meta={tmdb?.[item.id]} onOpen={()=>open(item,c)}/>;})}</div>
      {limit<filtered.length&&<button className="load-more" onClick={()=>setLimit(x=>x+48)}>더 보기</button>}
    </section>

    <section className="lens-section">
      <div className="section-head"><div><span>03</span><h2>김정웅의 비평 렌즈</h2></div><p>장르와 별점보다 먼저 반복적으로 등장하는 사유의 축.</p></div>
      <div className="lens-grid">{lenses.map(([t,d],i)=><article key={t}><b>0{i+1}</b><h3>{t}</h3><p>{d}</p></article>)}</div>
    </section>

    <section className="credits-section"><div><span>CREDITS</span><h2>기록이 먼저이고, AI는 그 다음입니다.</h2><p>추천의 해석 근거는 이 아카이브에 보존된 개인 감상 기록입니다. 포스터·감독·배우·장르 등 객관적 작품 메타데이터가 연결된 경우 TMDB를 사용합니다.</p></div><div className="tmdb-credit"><img src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_square_1-5bdc75aaebeb75dc7ae79426ddd9be3b2be1e342510f8202baf6bffa71d7f5c4.svg" alt="TMDB"/><p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p></div></section>

    <footer><span>CINEMA, CURATED</span><p>Source-grounded personal cinema archive · runtime {runtimeSource}</p></footer>

    {selected&&<div className="modal-backdrop" onClick={()=>setSelected(null)}><article className="modal" onClick={e=>e.stopPropagation()}>
      <button className="close" onClick={()=>setSelected(null)}>×</button>
      <div className="modal-grid"><div className="modal-poster"><Poster item={selected.item} meta={selectedMeta}/></div><div>
        <p className="kicker">{selected.curated?'CURATED':'ARCHIVE'} · {selected.item.type} · {selected.item.year}</p>
        <h2>{selected.item.title}</h2>
        {selectedMeta?.originalTitle&&selectedMeta.originalTitle!==selected.item.title&&<p style={{margin:'0 0 22px',fontSize:'12px',color:'#858981'}}>{selectedMeta.originalTitle}</p>}

        {selectedMeta?.status==='matched'&&<section style={{paddingTop:'20px'}}>
          <h4>작품 정보 · TMDB</h4>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:'10px',marginTop:'14px'}}>
            <div style={{background:'#e5e6df',padding:'13px 14px'}}><small style={{display:'block',fontSize:'9px',letterSpacing:'.12em',color:'#777b75',marginBottom:'6px'}}>DIRECTOR</small><strong style={{fontSize:'13px'}}>{selectedMeta.directors?.length?selectedMeta.directors.join(', '):'—'}</strong></div>
            <div style={{background:'#e5e6df',padding:'13px 14px'}}><small style={{display:'block',fontSize:'9px',letterSpacing:'.12em',color:'#777b75',marginBottom:'6px'}}>GENRE</small><strong style={{fontSize:'13px'}}>{selectedMeta.genres?.length?selectedMeta.genres.join(' / '):'—'}</strong></div>
            <div style={{background:'#e5e6df',padding:'13px 14px'}}><small style={{display:'block',fontSize:'9px',letterSpacing:'.12em',color:'#777b75',marginBottom:'6px'}}>RUNTIME</small><strong style={{fontSize:'13px'}}>{selectedMeta.runtime?`${selectedMeta.runtime}분`:'—'}</strong></div>
            <div style={{background:'#e5e6df',padding:'13px 14px'}}><small style={{display:'block',fontSize:'9px',letterSpacing:'.12em',color:'#777b75',marginBottom:'6px'}}>CAST</small><strong style={{fontSize:'13px',lineHeight:'1.55'}}>{selectedMeta.cast?.length?selectedMeta.cast.slice(0,6).map(x=>x.name).join(', '):'—'}</strong></div>
          </div>
        </section>}

        {selected.curated?.why&&<section style={{background:'#111',color:'#f1f1eb',padding:'22px',margin:'0 -10px',borderTop:'0'}}><h4 style={{color:'#d7ff61'}}>왜 이 작품인가</h4><p style={{fontSize:'16px',lineHeight:'1.75',marginBottom:0}}>{selected.curated.why}</p>{selected.curated?.quote&&<p style={{fontFamily:'Georgia,"Noto Serif KR",serif',fontSize:'13px',lineHeight:'1.7',color:'#bfc2ba',marginTop:'16px'}}>“{selected.curated.quote}”</p>}</section>}

        <section><h4>김정웅의 코멘트</h4><blockquote>{selected.item.comment||selected.curated?.fullComment}</blockquote></section>
        <section><h4>주제 신호</h4><div className="tags large">{(selected.item.themes||selected.curated?.themes||[]).map(t=><span key={t}>#{t}</span>)}</div></section>
        {selectedMeta?.overview&&<section><h4>작품 소개 · TMDB</h4><p>{selectedMeta.overview}</p></section>}
        {!selectedMeta?.posterPath&&<section className="metadata-box"><h4>메타데이터 보강</h4><p>TMDB 토큰이 설정되어 있으면 서버에서 포스터·감독·배우·장르를 조회할 수 있습니다.</p><button onClick={()=>loadLiveMeta(selected.item)}>TMDB 정보 불러오기</button>{metaStatus&&<small>{metaStatus}</small>}</section>}
      </div></div>
    </article></div>}
  </main>;
}
