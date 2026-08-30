/** Generates middleware that applies headers without mutating immutable responses. */
export function createSecurityMiddlewareSource(headers: Headers): string {
  const entries = JSON.stringify([...headers.entries()]);
  return `
import { defineMiddleware } from 'astro:middleware';

const securityHeaders = ${entries};

export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next();
  const headers = new Headers(response.headers);
  for (const [name, value] of securityHeaders) headers.set(name, value);

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
});
`;
}
