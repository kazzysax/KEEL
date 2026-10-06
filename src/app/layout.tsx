import './globals.css';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Keel: hedged stock pools on BNB Chain', description: 'Curated pairs and trios of tokenized stocks and gold, chosen so one leg softens the other\'s falls. Bought in one confirmation.' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><head>
    <link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
    <link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
  </head><body>{children}</body></html>);
}
