// Shared metadata for the 6 written lesson pages under /course/lesson-N.
// Distinct from LESSONS in scripts/course-progress.ts (the site's existing
// 6-piece video/written-page course progress tracker mapped to /basics,
// /enrollment, /coverage, /penalties, /working-at-65, /course) — that
// tracker's "Lesson X of 6" numbering is load-bearing for the certificate
// feature on /course and is deliberately left untouched. These lesson
// pages use their own MarkCompleteButton slugs ("course-lesson-N") so
// completion tracking doesn't collide with or alter that existing count.
export interface LessonMeta {
  n: number;
  slug: string;
  path: string;
  title: string;
  description: string;
}

export const COURSE_LESSONS: LessonMeta[] = [
  {
    n: 1,
    slug: 'course-lesson-1',
    path: '/course/lesson-1',
    title: 'What Is Medicare?',
    description: 'Parts A, B, C, and D — a full overview of how Medicare is organized and what each part covers.',
  },
  {
    n: 2,
    slug: 'course-lesson-2',
    path: '/course/lesson-2',
    title: 'Part A and Part B',
    description: 'A closer look at hospital coverage (Part A) and medical coverage (Part B) — what they pay for and what they cost.',
  },
  {
    n: 3,
    slug: 'course-lesson-3',
    path: '/course/lesson-3',
    title: 'Medicare Advantage vs. Original Medicare',
    description: 'How Part C compares to Original Medicare — networks, extra benefits, and how to decide between them.',
  },
  {
    n: 4,
    slug: 'course-lesson-4',
    path: '/course/lesson-4',
    title: 'Part D Drug Coverage',
    description: 'How prescription drug coverage works, including the $2,100 annual out-of-pocket cap.',
  },
  {
    n: 5,
    slug: 'course-lesson-5',
    path: '/course/lesson-5',
    title: 'Medigap Supplement Plans',
    description: 'What Medigap policies cover, how they work alongside Original Medicare, and when to enroll.',
  },
  {
    n: 6,
    slug: 'course-lesson-6',
    path: '/course/lesson-6',
    title: 'How and When to Enroll',
    description: 'The Initial, General, and Special Enrollment Periods explained — and how to avoid penalties.',
  },
];

export function lessonByN(n: number): LessonMeta {
  const lesson = COURSE_LESSONS.find((l) => l.n === n);
  if (!lesson) throw new Error(`No lesson defined for n=${n}`);
  return lesson;
}
