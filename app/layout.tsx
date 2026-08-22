import type { Metadata } from 'next';
import { Bricolage_Grotesque, Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const bricolage = Bricolage_Grotesque({
  variable: '--font-bricolage',
  subsets: ['latin'],
  weight: ['700'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://freeoutbid.lol'),
  icons: { icon: '/favicon.ico', shortcut: '/favicon.ico' },
  title: 'freeoutbid.lol — Put your app where people look first',
  description: 'Paid projects lead with rich cards, real screenshots, and their own story. Community listings stay in a separate reviewed section.',
  openGraph: {
    title: 'freeoutbid.lol — Put your app where people look first',
    description: 'Paid projects lead with richer cards. Even a $1 paid bid ranks above free community listings.',
    type: 'website',
    images: [{ url: '/og.png', width: 1731, height: 909, alt: 'freeoutbid.lol — The leaderboard money cannot fully buy' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'freeoutbid.lol — Put your app where people look first',
    description: 'Paid projects lead with richer cards. Even a $1 paid bid ranks above free community listings.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
