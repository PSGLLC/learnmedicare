// Cloudflare Pages Function — private preview bypass for the /course video
// gate (Feature: course video email gate). Kayla-only: validates a
// long random secret from an env var (COURSE_PREVIEW_SECRET, set via
// `wrangler pages secret put`, never committed to the repo or referenced
// in any client-side code) against a `?key=` query param. On match, sets
// the same `course_unlocked` cookie a real visitor gets from submitting
// the gate form, then redirects into the normal static /course/ page —
// no separate ungated route to maintain, and the real gate is completely
// untouched by this.
//
// Usage: https://learnmedicare.org/api/course-preview?key=<secret>

interface Env {
  COURSE_PREVIEW_SECRET: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const key = url.searchParams.get('key');

  if (!env.COURSE_PREVIEW_SECRET || !key || key !== env.COURSE_PREVIEW_SECRET) {
    // 404 rather than 401/403 — don't confirm this route does anything
    // to an unauthenticated prober.
    return new Response('Not found', { status: 404 });
  }

  const headers = new Headers();
  headers.set('Location', '/course/');
  headers.append('Set-Cookie', 'course_unlocked=1; Max-Age=31536000; Path=/; SameSite=Lax');
  return new Response(null, { status: 302, headers });
};
