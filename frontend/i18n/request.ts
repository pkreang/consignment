import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export const locales = ['th', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'th';

function resolveLocale(value: string | undefined): Locale {
  return value === 'en' || value === 'th' ? value : defaultLocale;
}

export default getRequestConfig(async () => {
  // Without-routing mode: locale is fully cookie-determined; requestLocale is always undefined here.
  const locale = resolveLocale(cookies().get('locale')?.value);
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
