import type {Metadata} from 'next';
import './globals.css';
import SiteShell from '@/components/site/SiteShell';
export const metadata:Metadata={title:{default:'Bistro Bambi',template:'%s | Bistro Bambi'},description:'ビストロバンビの記録と受付',robots:{index:false,follow:false},referrer:'no-referrer'};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="ja"><body><SiteShell>{children}</SiteShell></body></html>}
