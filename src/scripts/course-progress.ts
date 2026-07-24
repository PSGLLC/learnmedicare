// Shared client-side module for Course Progress Tracking (Feature 8).
// localStorage only — no login, no server storage. Tracks "started" vs.
// "completed" per lesson across the 6-piece course set: the 5 written
// lesson pages (/basics, /enrollment, /coverage, /penalties,
// /working-at-65) plus /course itself, which stands in as lesson 6
// ("Putting It All Together") since it's the wrap-up hub rather than a
// distinct written lesson.
//
// Deliberately separate from the pre-existing sessionStorage trackers
// already on this site (LessonProgress.astro's "lessonsViewed" and
// course.astro's "courseLessonsCompleted" video-lesson tracker) — this
// module owns its own localStorage keys and does not read or write theirs.

export interface LessonDef {
  slug: string;
  path: string;
  label: string;
}

export const LESSONS: LessonDef[] = [
  { slug: 'basics', path: '/basics', label: 'Medicare Basics' },
  { slug: 'enrollment', path: '/enrollment', label: 'Enrollment' },
  { slug: 'coverage', path: '/coverage', label: 'Coverage Options' },
  { slug: 'penalties', path: '/penalties', label: 'Avoiding Penalties' },
  { slug: 'working-at-65', path: '/working-at-65', label: 'Working Past 65' },
  { slug: 'course', path: '/course', label: 'Putting It All Together' },
];

export const TOTAL_LESSONS = LESSONS.length;

const PROGRESS_KEY = 'lmCourseProgress';
const LAST_KEY = 'lmLastLesson';

type Status = 'started' | 'completed';

function readProgress(): Record<string, Status> {
  try {
    return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeProgress(state: Record<string, Status>): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(state));
  } catch {
    // localStorage unavailable (private mode, disabled, etc.) — fail silently.
  }
}

/** Marks a lesson "started" (no-op if already started or completed) and remembers it as the last-visited lesson. */
export function markStarted(slug: string): void {
  const state = readProgress();
  if (!state[slug]) {
    state[slug] = 'started';
    writeProgress(state);
  }
  try {
    localStorage.setItem(LAST_KEY, slug);
  } catch {
    // ignore
  }
}

/** Marks a lesson "completed". */
export function markCompleted(slug: string): void {
  const state = readProgress();
  if (state[slug] !== 'completed') {
    state[slug] = 'completed';
    writeProgress(state);
  }
}

export function getStatus(slug: string): 'not-started' | Status {
  const state = readProgress();
  return state[slug] || 'not-started';
}

export function getCompletedCount(): number {
  const state = readProgress();
  return LESSONS.filter((l) => state[l.slug] === 'completed').length;
}

export function getLastLesson(): LessonDef | null {
  try {
    const slug = localStorage.getItem(LAST_KEY);
    return LESSONS.find((l) => l.slug === slug) || null;
  } catch {
    return null;
  }
}

export function hasAnyProgress(): boolean {
  return Object.keys(readProgress()).length > 0;
}

/** Clears only this feature's localStorage keys — does not touch unrelated storage. */
export function resetProgress(): void {
  try {
    localStorage.removeItem(PROGRESS_KEY);
    localStorage.removeItem(LAST_KEY);
  } catch {
    // ignore
  }
}

/** Returns the percentage (0-100) the user has scrolled down the current document. */
export function getScrollPercent(): number {
  const doc = document.documentElement;
  const scrollTop = window.scrollY || doc.scrollTop;
  const scrollHeight = doc.scrollHeight - doc.clientHeight;
  if (scrollHeight <= 0) return 100;
  return Math.min(100, Math.round((scrollTop / scrollHeight) * 100));
}
