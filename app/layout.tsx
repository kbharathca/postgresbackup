import type {Metadata} from 'next';
import { Inter } from 'next/font/google';
import './globals.css'; // Global styles

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Postgres Backup Generator',
  description: 'Generate remote Postgres backup scripts for Coolify and aaPanel.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${inter.className} antialiased`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
