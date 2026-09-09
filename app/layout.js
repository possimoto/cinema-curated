import './globals.css';

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: { default: 'Cinema, Curated', template: '%s · Cinema, Curated' },
  description: '549개의 실제 감상 기록에서 출발하는 개인 시네마 큐레이션',
  applicationName: 'Cinema, Curated',
  openGraph: {
    title: 'Cinema, Curated',
    description: '영화를 고르는 것이 아니라, 영화를 읽는 방식을 추천합니다.',
    type: 'website',
    locale: 'ko_KR'
  },
  twitter: { card: 'summary', title: 'Cinema, Curated', description: '549개의 실제 감상 기록에서 출발하는 개인 시네마 큐레이션' }
};

export default function RootLayout({ children }) {
  return <html lang="ko"><body>{children}</body></html>;
}
