/** Generated route and middleware modules written into Astro's codegen directory. */
export interface BetterAuthEntrypointSources {
  middleware: string;
  route: string;
}

/**
 * Generates Astro entrypoints that import the application-owned auth instance.
 *
 * @remarks Import specifiers are serialized as JSON so paths remain valid source
 * even when they contain quotes or platform-specific characters.
 */
export function createEntrypointSources(authModule: string): BetterAuthEntrypointSources {
  const authImport = JSON.stringify(authModule);

  return {
    route: `
import { auth } from ${authImport};

export const prerender = false;
export const ALL = ({ request }) => auth.handler(request);
`,
    middleware: `
import { defineMiddleware } from 'astro:middleware';
import { auth } from ${authImport};

export const onRequest = defineMiddleware(async (context, next) => {
  const currentSession = await auth.api.getSession({
    headers: context.request.headers,
  });

  context.locals.user = currentSession?.user ?? null;
  context.locals.session = currentSession?.session ?? null;

  return next();
});
`,
  };
}
