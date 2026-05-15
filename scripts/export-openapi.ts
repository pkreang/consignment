/**
 * Dumps the OpenAPI spec to docs/openapi.json and converts the paths to a
 * Postman-style collection at docs/postman_collection.json so the API can be
 * imported into Postman / Insomnia without any external tooling.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- node --experimental-strip-types needs the .ts extension; tsx ignores it.
import { openapiSpec } from '../src/openapi/spec.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outDir = path.resolve(__dirname, '..', 'docs');
fs.mkdirSync(outDir, { recursive: true });

const openapiPath = path.join(outDir, 'openapi.json');
fs.writeFileSync(openapiPath, JSON.stringify(openapiSpec, null, 2));
console.log('wrote', openapiPath);

type PathItem = Record<string, { tags?: string[]; summary?: string; security?: unknown; requestBody?: { content?: Record<string, { schema?: unknown }> } }>;

const HOST_VAR = '{{baseUrl}}';

function toPostmanItem(method: string, urlPath: string, op: PathItem[string]) {
  const segments = urlPath.split('/').filter(Boolean);
  const pathArray = segments.map((s) =>
    s.startsWith('{') && s.endsWith('}') ? `:${s.slice(1, -1)}` : s,
  );
  const requestBody = op.requestBody?.content?.['application/json'];
  return {
    name: `${method.toUpperCase()} ${urlPath}`,
    request: {
      method: method.toUpperCase(),
      header: [
        ...(op.security
          ? [{ key: 'Authorization', value: 'Bearer {{token}}' }]
          : []),
        ...(requestBody
          ? [{ key: 'Content-Type', value: 'application/json' }]
          : []),
      ],
      url: {
        raw: `${HOST_VAR}${urlPath}`,
        host: [HOST_VAR],
        path: pathArray,
      },
      body: requestBody
        ? {
            mode: 'raw',
            raw: JSON.stringify(
              dereferenceExample(requestBody.schema),
              null,
              2,
            ),
            options: { raw: { language: 'json' } },
          }
        : undefined,
      description: op.summary,
    },
  };
}

function dereferenceExample(schema: unknown): unknown {
  if (!schema || typeof schema !== 'object') return {};
  const s = schema as { $ref?: string; properties?: Record<string, unknown>; example?: unknown };
  if (s.$ref) {
    const name = s.$ref.split('/').pop()!;
    const def = (openapiSpec.components.schemas as Record<string, unknown>)[name];
    return dereferenceExample(def);
  }
  if (s.example !== undefined) return s.example;
  if (s.properties) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(s.properties)) {
      out[k] = dereferenceExample(v);
    }
    return out;
  }
  return s;
}

const folders = new Map<string, unknown[]>();
for (const [pth, ops] of Object.entries(openapiSpec.paths) as Array<[
  string,
  PathItem,
]>) {
  for (const [method, op] of Object.entries(ops)) {
    const tag = (op.tags?.[0] ?? 'Other') as string;
    const item = toPostmanItem(method, pth, op);
    if (!folders.has(tag)) folders.set(tag, []);
    folders.get(tag)!.push(item);
  }
}

const collection = {
  info: {
    name: openapiSpec.info.title,
    description: openapiSpec.info.description,
    schema:
      'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  variable: [
    { key: 'baseUrl', value: 'http://localhost:3000' },
    { key: 'token', value: '' },
  ],
  item: [...folders.entries()].map(([name, items]) => ({ name, item: items })),
};

const postmanPath = path.join(outDir, 'postman_collection.json');
fs.writeFileSync(postmanPath, JSON.stringify(collection, null, 2));
console.log('wrote', postmanPath);
