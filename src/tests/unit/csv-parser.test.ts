import { describe, expect, it } from 'vitest';
import { parseCsv } from '../../common/utils/csvParser';

describe('parseCsv', () => {
  it('handles a basic comma-separated body', () => {
    const out = parseCsv('a,b,c\n1,2,3\n4,5,6');
    expect(out).toEqual([
      { a: '1', b: '2', c: '3' },
      { a: '4', b: '5', c: '6' },
    ]);
  });

  it('respects quoted fields with embedded delimiters and newlines', () => {
    const out = parseCsv(
      'name,address\n"Smith, John","12/3 Main St,\nBangkok"\n',
    );
    expect(out).toEqual([
      { name: 'Smith, John', address: '12/3 Main St,\nBangkok' },
    ]);
  });

  it('escapes doubled quotes inside quoted fields', () => {
    const out = parseCsv('quote\n"He said ""hi"""\n');
    expect(out).toEqual([{ quote: 'He said "hi"' }]);
  });

  it('skips blank lines', () => {
    const out = parseCsv('a,b\n1,2\n\n3,4\n');
    expect(out).toEqual([
      { a: '1', b: '2' },
      { a: '3', b: '4' },
    ]);
  });

  it('handles CRLF line endings', () => {
    const out = parseCsv('a,b\r\n1,2\r\n3,4\r\n');
    expect(out).toEqual([
      { a: '1', b: '2' },
      { a: '3', b: '4' },
    ]);
  });
});
