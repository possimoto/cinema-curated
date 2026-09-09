const state = { mode: "all", facet: null, query: "", limit: 48 };
const els = {
  movieGrid: document.querySelector("#movieGrid"), facetBar: document.querySelector("#facetBar"), searchInput: document.querySelector("#searchInput"), resultCount: document.querySelector("#resultCount"), modeNote: document.querySelector("#modeNote"), loadMore: document.querySelector("#loadMore"),
  moodInput: document.querySelector("#moodInput"), recommendBtn: document.querySelector("#recommendBtn"), quickMoods: document.querySelector("#quickMoods"), recGrid: document.querySelector("#recommendationGrid"), recIntro: document.querySelector("#recommendationIntro"),
  lensGrid: document.querySelector("#lensGrid"), dialog: document.querySelector("#movieDialog"), dialogContent: document.querySelector("#dialogContent"), dialogClose: document.querySelector("#dialogClose")
};
const uniq = arr => [...new Set(arr)].filter(Boolean).sort((a,b)=>String(a).localeCompare(String(b),"ko"));
const esc = s => String(s??"").replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const excerpt=(s,n=170)=>{s=String(s||"").replace(/\s+/g," ").trim();return s.length>n?s.slice(0,n).trim()+"…":s;};
const hashColors = str => { let h=0; for(const ch of str) h=(h*31+ch.charCodeAt(0))>>>0; const hue=h%360; return [`hsl(${hue} 24% 34%)`,`hsl(${(hue+28)%360} 18% 13%)`]; };
const curatedByTitle=new Map(CINEMA_DATA.map(x=>[x.title,x]));
const archiveById=new Map(FULL_ARCHIVE.map(x=>[x.id,x]));
function archiveText(m){return [m.title,m.year,m.type,m.comment,...m.themes,...m.critiqueTags,...m.moods,...m.outcomes,...m.audiences,...m.connections].join(" ").toLowerCase();}
function curatedText(m){return [m.title,m.director,...m.actors,...m.genres,...m.audiences,...m.themes,...m.moods,...m.outcomes,m.why,m.fullComment||m.quote,...m.connections].join(" ").toLowerCase();}

function archiveCard(m,score=null){
  const colors=hashColors(m.title); const badge=score!==null?`${score}%`:m.year;
  return `<article class="movie-card archive-card" data-kind="archive" data-id="${esc(m.id)}" tabindex="0" role="button" aria-label="${esc(m.title)} 원문 보기">
    <div class="poster" style="--poster-a:${colors[0]};--poster-b:${colors[1]}"><span class="poster-code">${esc(m.type.toUpperCase())} · ${m.year}</span><div class="poster-title">${esc(m.title)}</div></div>
    <div class="card-body"><div class="meta"><span>${esc(m.tone)}</span><span>·</span><span>자동 태깅</span></div><h3 class="card-title">${esc(m.title)}</h3><div class="card-why">${esc(excerpt(m.comment))}</div><div class="tags">${m.themes.slice(0,3).map(t=>`<span class="tag">#${esc(t)}</span>`).join("")}</div><div class="card-action"><span class="score">${badge}</span><span class="more">원문과 태그 보기 →</span></div></div>
  </article>`;
}
function curatedCard(m,score=null){
  return `<article class="movie-card" data-kind="curated" data-id="${esc(m.id)}" tabindex="0" role="button" aria-label="${esc(m.title)} 상세보기"><div class="poster" style="--poster-a:${m.colors[0]};--poster-b:${m.colors[1]}"><span class="poster-code">${esc(m.type.toUpperCase())} · ${m.year}</span><div class="poster-title">${esc(m.title)}</div></div><div class="card-body"><div class="meta"><span>${esc(m.director)}</span><span>·</span><span>${esc(m.genres.slice(0,2).join(" / "))}</span></div><h3 class="card-title">${esc(m.title)}</h3><div class="card-why">${esc(m.why)}</div><div class="tags">${m.themes.slice(0,3).map(t=>`<span class="tag">#${esc(t)}</span>`).join("")}</div><div class="card-action"><span class="score">${score!==null?score+"%":m.year}</span><span class="more">왜 추천했을까 →</span></div></div></article>`;
}
function bindCards(scope=document){scope.querySelectorAll(".movie-card").forEach(card=>{const go=()=>openMovie(card.dataset.kind,card.dataset.id);card.addEventListener("click",go);card.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();go();}});});}
function openMovie(kind,id){
  if(kind==="curated"){
    const m=CINEMA_DATA.find(x=>x.id===id); if(!m)return;
    els.dialogContent.innerHTML=`<div class="dialog-inner"><div class="dialog-kicker">CURATED · ${m.type.toUpperCase()} · ${m.year}</div><h3>${esc(m.title)}</h3><div class="dialog-meta">${esc(m.director)} · ${esc(m.actors.join(", "))} · ${esc(m.genres.join(" / "))}</div><div class="dialog-section"><h4>왜 이 작품인가</h4><p>${esc(m.why)}</p></div><div class="dialog-section"><h4>내 코멘트 원문</h4><p class="quote full-comment">${esc(m.fullComment||m.quote).replace(/\n/g,"<br>")}</p></div><div class="dialog-section"><h4>잘 맞는 상황</h4><div class="connection-list">${m.audiences.map(x=>`<span>${esc(x)}</span>`).join("")}</div></div><div class="dialog-section"><h4>주제 태그</h4><div class="connection-list">${m.themes.map(x=>`<span>#${esc(x)}</span>`).join("")}</div></div><div class="dialog-section"><h4>함께 연결해 볼 작품</h4><div class="connection-list">${m.connections.map(x=>`<span>${esc(x)}</span>`).join("")}</div></div></div>`;
  } else {
    const m=archiveById.get(id); if(!m)return;
    els.dialogContent.innerHTML=`<div class="dialog-inner"><div class="dialog-kicker">ARCHIVE · ${m.type.toUpperCase()} · ${m.year}</div><h3>${esc(m.title)}</h3><div class="dialog-meta">원문 코멘트 + 추천용 자동 추론 태그</div><div class="dialog-section"><h4>내 코멘트 원문</h4><p class="quote full-comment">${esc(m.comment).replace(/\n/g,"<br>")}</p></div><div class="dialog-section"><h4>주제 신호 <small>자동 추론</small></h4><div class="connection-list">${m.themes.map(x=>`<span>#${esc(x)}</span>`).join("")||"<span>미분류</span>"}</div></div><div class="dialog-section"><h4>비평 기준 <small>자동 추론</small></h4><div class="connection-list">${m.critiqueTags.map(x=>`<span>${esc(x)}</span>`).join("")||"<span>미분류</span>"}</div></div><div class="dialog-section"><h4>코멘트 안에서 연결된 작품</h4><div class="connection-list">${m.connections.length?m.connections.map(x=>`<span>${esc(x)}</span>`).join(""):"<span>명시적 연결 없음</span>"}</div></div><p class="auto-note">※ 주제·감정·관람상황 태그는 원문을 바꾸지 않고 추천을 위해 자동 추론한 값입니다.</p></div>`;
  }
  els.dialog.showModal();
}
els.dialogClose.addEventListener("click",()=>els.dialog.close()); els.dialog.addEventListener("click",e=>{if(e.target===els.dialog)els.dialog.close();});

function sourceForMode(){return ["genre","director","actor","audience","curated"].includes(state.mode)?CINEMA_DATA:FULL_ARCHIVE;}
function facetsFor(mode){
  if(mode==="theme") return uniq(FULL_ARCHIVE.flatMap(x=>x.themes));
  if(mode==="type") return uniq(FULL_ARCHIVE.map(x=>x.type));
  if(mode==="year") return uniq(FULL_ARCHIVE.map(x=>x.year)).sort((a,b)=>b-a);
  if(mode==="genre") return uniq(CINEMA_DATA.flatMap(x=>x.genres));
  if(mode==="director") return uniq(CINEMA_DATA.map(x=>x.director));
  if(mode==="actor") return uniq(CINEMA_DATA.flatMap(x=>x.actors));
  if(mode==="audience") return uniq(CINEMA_DATA.flatMap(x=>x.audiences));
  return [];
}
function matchesFacet(m){if(!state.facet)return true; if(state.mode==="theme")return m.themes.includes(state.facet);if(state.mode==="type")return m.type===state.facet;if(state.mode==="year")return String(m.year)===String(state.facet);if(state.mode==="genre")return m.genres.includes(state.facet);if(state.mode==="director")return m.director===state.facet;if(state.mode==="actor")return m.actors.includes(state.facet);if(state.mode==="audience")return m.audiences.includes(state.facet);return true;}
function renderFacets(){const f=facetsFor(state.mode);els.facetBar.innerHTML=f.map(x=>`<button class="facet ${String(state.facet)===String(x)?'active':''}" data-facet="${esc(x)}">${esc(x)}</button>`).join("");els.facetBar.querySelectorAll(".facet").forEach(btn=>btn.addEventListener("click",()=>{state.facet=String(state.facet)===btn.dataset.facet?null:btn.dataset.facet;state.limit=48;renderFacets();renderMovies();}));}
function renderMovies(){
  const src=sourceForMode(), q=state.query.trim().toLowerCase();
  let list=src.filter(m=>matchesFacet(m)&&(!q||(src===FULL_ARCHIVE?archiveText(m):curatedText(m)).includes(q)));
  if(src===FULL_ARCHIVE) list=list.sort((a,b)=>b.year-a.year||a.title.localeCompare(b.title,"ko"));
  els.resultCount.textContent=`${list.length} titles`;
  const curatedMeta=["genre","director","actor","audience"].includes(state.mode);
  els.modeNote.textContent=curatedMeta?"* 감독·배우·장르·관람상황은 현재 정교한 메타데이터가 입력된 큐레이션 28편 기준입니다.":state.mode==="all"?"549개 원문 코멘트 전체를 검색합니다. 주제 태그는 원문으로부터 자동 추론했습니다.":"";
  const shown=list.slice(0,state.limit); const card=src===FULL_ARCHIVE?archiveCard:curatedCard;
  els.movieGrid.innerHTML=shown.length?shown.map(m=>card(m)).join(""):`<div class="empty">조건에 맞는 작품이 없습니다.</div>`; bindCards(els.movieGrid);
  els.loadMore.classList.toggle("hidden",shown.length>=list.length); els.loadMore.onclick=()=>{state.limit+=48;renderMovies();};
}
document.querySelectorAll(".filter-tab").forEach(btn=>btn.addEventListener("click",()=>{document.querySelectorAll(".filter-tab").forEach(x=>x.classList.remove("active"));btn.classList.add("active");state.mode=btn.dataset.mode;state.facet=null;state.limit=48;renderFacets();renderMovies();}));
els.searchInput.addEventListener("input",e=>{state.query=e.target.value;state.limit=48;renderMovies();});

function normalizeMood(q){
  const rules=[
    {keys:["지쳐","지쳤","피곤","무기력","힘들","번아웃","회복"],moods:["지침","무기력"],outcomes:["회복","위로","여유","정돈"],themes:["삶의 태도"]},
    {keys:["답답","열받","분노","화나","스트레스"],moods:["답답함","분노"],outcomes:["카타르시스","각성","몰입"]},
    {keys:["외롭","쓸쓸","혼자"],moods:["외로움"],outcomes:["위로","다정함","여운"],themes:["관계와 사랑"]},
    {keys:["연인","데이트","애인","커플"],audience:["연인"],outcomes:["여운","즐거움","생각"],themes:["관계와 사랑"]},
    {keys:["아이","자녀","어린이"],audience:["아이와","가족"],outcomes:["즐거움","감동"]},
    {keys:["가족","부모"],audience:["가족"],outcomes:["감동","여운"],themes:["관계와 사랑"]},
    {keys:["생각","정리","철학","고민","복잡"],outcomes:["생각","여운","정돈"]},
    {keys:["강렬","쾌감","액션","전율","몰입"],outcomes:["카타르시스","전율","몰입"],themes:["장르적 성취"],intensity:4},
    {keys:["가볍","편하","편안","잔잔","조용"],outcomes:["즐거움","여유","위로"],maxIntensity:2},
    {keys:["울고","눈물","감동"],outcomes:["감동","여운"]},
    {keys:["예술","미장센","예쁜","미감"],outcomes:["미감","여운"],themes:["예술과 창작"]},
    {keys:["기술","AI","인공지능","로봇"],outcomes:["생각","자극"],themes:["기술과 인간"]},
    {keys:["욕망","집착","자기파괴"],themes:["욕망과 자기파괴"],outcomes:["생각"]},
    {keys:["전쟁","역사","폭력"],themes:["폭력과 역사"],outcomes:["생각","몰입"]}
  ];
  const r={moods:[],outcomes:[],audience:[],themes:[],intensity:null,maxIntensity:null};rules.forEach(x=>{if(x.keys.some(k=>q.includes(k))){["moods","outcomes","audience","themes"].forEach(k=>x[k]&&r[k].push(...x[k]));if(x.intensity)r.intensity=x.intensity;if(x.maxIntensity)r.maxIntensity=x.maxIntensity;}});return r;
}
function scoreCandidate(m,q,intent,curated=false){
  const lower=curated?curatedText(m):archiveText(m); let s=curated?44:30; const tokens=q.toLowerCase().split(/\s+/).filter(x=>x.length>1);tokens.forEach(t=>{if(lower.includes(t))s+=3;});
  intent.moods.forEach(x=>m.moods?.includes(x)&&(s+=7)); intent.outcomes.forEach(x=>m.outcomes?.includes(x)&&(s+=8)); intent.audience.forEach(x=>m.audiences?.includes(x)&&(s+=10)); intent.themes.forEach(x=>m.themes?.includes(x)&&(s+=10));
  if(intent.intensity!==null)s+=Math.max(0,7-Math.abs((m.intensity||2)-intent.intensity)*2); if(intent.maxIntensity!==null&&(m.intensity||2)>intent.maxIntensity)s-=12;
  if(!curated){s+=(m.toneScore-50)*0.12;if(m.toneScore<35)s-=12;} if(q.includes("영화관")&&m.audiences?.includes("영화관"))s+=8; return Math.max(20,Math.min(99,Math.round(s)));
}
function recommend(){
  const q=els.moodInput.value.trim();if(!q){els.moodInput.focus();return;}const intent=normalizeMood(q);
  const merged=[]; const used=new Set();
  CINEMA_DATA.forEach(m=>{merged.push({kind:"curated",m,score:scoreCandidate(m,q,intent,true)});used.add(m.title);});
  FULL_ARCHIVE.forEach(m=>{if(!used.has(m.title))merged.push({kind:"archive",m,score:scoreCandidate(m,q,intent,false)});});
  const sorted=merged.sort((a,b)=>b.score-a.score); let ranked=sorted.slice(0,6);
  // v0.2의 목적이 전체 549 기록을 실제 추천 후보로 쓰는 것이므로, 점수가 충분히 가까운 경우 아카이브 후보를 최대 2편까지 섞는다.
  const archiveCandidates=sorted.filter(x=>x.kind==="archive" && (x.m.toneScore??50)>=45 && x.score>=Math.max(45,sorted[0].score-15));
  let archiveCount=ranked.filter(x=>x.kind==="archive").length;
  for(const candidate of archiveCandidates){
    if(archiveCount>=2) break; if(ranked.some(x=>x.m.title===candidate.m.title)) continue;
    const replace=[...ranked].map((x,i)=>({x,i})).filter(z=>z.x.kind==="curated").sort((a,b)=>a.x.score-b.x.score)[0];
    if(!replace) break; ranked[replace.i]=candidate; archiveCount++;
  }
  ranked.sort((a,b)=>b.score-a.score);
  const signal=[...new Set([...intent.themes,...intent.outcomes,...intent.audience,...intent.moods])].slice(0,5);
  els.recIntro.classList.remove("hidden");els.recIntro.innerHTML=`<strong>이렇게 읽었어요.</strong> ${signal.length?signal.map(esc).join(" · "):"입력 문장과 코멘트의 직접적인 단어·의미 신호"}를 기준으로 549개의 기록을 검색했습니다. 정교한 수기 큐레이션 28편에는 추가 가중치를 주되, 점수가 가까우면 전체 아카이브에서 새 후보도 함께 보여줍니다.`;
  els.recGrid.innerHTML=ranked.map(x=>x.kind==="curated"?curatedCard(x.m,x.score):archiveCard(x.m,x.score)).join("");bindCards(els.recGrid);
}
els.recommendBtn.addEventListener("click",recommend);els.moodInput.addEventListener("keydown",e=>{if((e.metaKey||e.ctrlKey)&&e.key==="Enter")recommend();});QUICK_MOODS.forEach(q=>{const b=document.createElement("button");b.className="quick-mood";b.textContent=q;b.addEventListener("click",()=>{els.moodInput.value=q;recommend();});els.quickMoods.appendChild(b);});
els.lensGrid.innerHTML=CURATOR_LENSES.map((l,i)=>`<article class="lens-card"><div class="lens-num">0${i+1}</div><h3>${esc(l.title)}</h3><p>${esc(l.desc)}</p><div class="lens-films">${l.films.map(esc).join(" · ")}</div></article>`).join("");
renderFacets();renderMovies();
