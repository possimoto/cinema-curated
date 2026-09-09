import AdminStudio from '../../components/AdminStudio';

export const metadata = { title: 'Curation Studio · Cinema, Curated', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default function AdminPage() {
  return <>
    <a href="/admin/content" style={{position:'fixed',right:'18px',bottom:'18px',zIndex:100,background:'#d7ff61',color:'#111',padding:'11px 15px',borderRadius:'999px',fontSize:'12px',fontWeight:800,textDecoration:'none',boxShadow:'0 8px 30px rgba(0,0,0,.35)'}}>＋ 작품·원문 관리</a>
    <AdminStudio />
  </>;
}
