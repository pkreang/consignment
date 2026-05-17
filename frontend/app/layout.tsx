import './globals.css';
import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { Providers } from '@/components/providers';
import { Nav } from '@/components/nav';

export const metadata: Metadata = {
  title: 'Consignment ERP Lite',
  description: 'Admin panel for the Consignment / Van Sales backend',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>
            <Nav />
            <main className="mx-auto max-w-screen-xl px-4 py-6">{children}</main>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
