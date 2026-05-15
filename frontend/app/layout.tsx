import './globals.css';
import type { Metadata } from 'next';
import { Providers } from '@/components/providers';
import { Nav } from '@/components/nav';

export const metadata: Metadata = {
  title: 'Consignment ERP Lite',
  description: 'Admin panel for the Consignment / Van Sales backend',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Nav />
          <main className="mx-auto max-w-screen-xl px-4 py-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
