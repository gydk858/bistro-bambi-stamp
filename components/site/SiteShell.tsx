"use client";
import {usePathname} from 'next/navigation';
import {useState} from 'react';
const links=[['/admin','ホーム'],['/admin/hunters','ハンティング'],['/admin/events','イベント'],['/admin/stamp','スタンプ'],['/admin/bingo','ビンゴ'],['/admin/staff','従業員'],['/admin/system','設定']];
export default function SiteShell({children}:{children:React.ReactNode}){
 const path=usePathname()||'/';
 const admin=path.startsWith('/admin')&&path!=='/admin/login';
 const restricted=/^\/(hunter-access|hunter-user|event-access)\//.test(path);
 const home=path==='/'||path==='/admin';
 const hunting=path.startsWith('/admin/hunters')||path.startsWith('/hunter-access/');
 const [collapsed,setCollapsed]=useState(false);
 return <div className="bambi-site">
 <header className="site-masthead"><div className="site-wordmark"><span className="site-seal" aria-hidden="true">鹿</span><div><span className="site-wordmark-en">BISTRO BAMBI</span><small>ビストロ・バンビ</small></div></div><span className="site-context">{restricted?'スタッフ・ユーザー専用ページ':admin?'STAFF & MANAGEMENT':'GIBIER & COMMUNITY'}</span></header>
 {(home||hunting)&&<><section className="site-hero" hidden={collapsed}><div className="site-hero-copy"><p className="site-kicker">{hunting?'HUNTING DESK':'BISTRO BAMBI'}</p><h1>森の恵みを、記録に。</h1><h2>{hunting?'ハンティング受付':'バンビで紡ぐ、日々の記録。'}</h2><p>{hunting?'素材の買取から、ハンターの記録まで。':'森と、人と、食卓と。'}</p></div><div className="site-hero-photo" role="img" aria-label="木漏れ日の森と鹿"/><span className="site-vertical" aria-hidden="true">森と、人と、食卓と。</span></section><div className="site-banner-toggle"><button type="button" onClick={()=>setCollapsed(v=>!v)} aria-expanded={!collapsed}>{collapsed?'表紙を表示 ＋':'表紙を閉じて受付を広く −'}</button></div></>}
 {admin&&<nav className="site-nav" aria-label="管理ナビゲーション">{links.map(([href,label])=><a href={href} key={href} aria-current={(href==='/admin'?path===href:path.startsWith(href))?'page':undefined}>{label}</a>)}</nav>}
 <div className="site-content">{children}</div><footer className="site-footer"><span>BISTRO BAMBI</span><small>森の恵みと、ともに。</small></footer></div>
}
