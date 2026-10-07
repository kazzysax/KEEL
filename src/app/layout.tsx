import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/jetbrains-mono';
import './globals.css';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Keel: hedged stock pools on BNB Chain', description: 'Curated pairs and trios of tokenized stocks and gold, chosen so one leg softens the other\'s falls. Bought in one confirmation.' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body>{children}</body></html>);
}
