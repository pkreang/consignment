// Augments next-intl's message types from en.json so that t('key') calls
// are type-checked by `tsc --noEmit`.
import type en from './messages/en.json';

type Messages = typeof en;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface IntlMessages extends Messages {}
}
