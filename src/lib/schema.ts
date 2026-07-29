// Shared JSON-LD building blocks for authorship, review, and Dataset schema.
// Import into any page and spread into a WebPage/Article/FAQPage entry or push
// a Dataset object into that page's jsonLd array.

export const SITE_AUTHOR = {
  '@type': 'Organization',
  name: 'LearnMedicare Editorial Team',
  url: 'https://learnmedicare.org',
};

export const SITE_REVIEWER = {
  '@type': 'Person',
  name: 'Kayla Price',
  hasCredential: {
    '@type': 'EducationalOccupationalCredential',
    credentialCategory: 'Licensed Insurance Agent',
    identifier: 'NPN 18530055',
  },
};

export const SITE_PUBLISHER = {
  '@type': 'Organization',
  name: 'LearnMedicare.org',
  url: 'https://learnmedicare.org',
  logo: {
    '@type': 'ImageObject',
    url: 'https://learnmedicare.org/brand/psg-logo.png',
  },
};

/**
 * Authorship fields to spread into a WebPage/Article/FAQPage JSON-LD entry.
 * Pass explicit dates per page so dateModified can diverge from datePublished
 * as content gets updated over time.
 */
export function authorship(datePublished: string, dateModified: string = datePublished) {
  return {
    author: SITE_AUTHOR,
    publisher: SITE_PUBLISHER,
    reviewedBy: SITE_REVIEWER,
    datePublished,
    dateModified,
  };
}

interface DatasetOpts {
  name: string;
  description: string;
  creatorUrl: string;
  creatorName?: string;
  dateModified?: string;
}

interface LearningResourceOpts {
  name: string;
  description: string;
  url: string;
  position: number;
}

/**
 * LearningResource JSON-LD for a written lesson page under /course/lesson-N
 * — schema.org's recommended type for a single unit of educational content
 * that's part of a larger Course, via isPartOf. Distinct from the Course
 * schema itself (see course.astro), which describes the overall 6-lesson
 * offering.
 */
export function learningResource(opts: LearningResourceOpts) {
  return {
    '@context': 'https://schema.org',
    '@type': 'LearningResource',
    name: opts.name,
    description: opts.description,
    url: opts.url,
    learningResourceType: 'Lesson',
    position: opts.position,
    isPartOf: {
      '@type': 'Course',
      name: 'Medicare 101: Free Mini-Course',
      url: 'https://learnmedicare.org/course/',
    },
    provider: {
      '@type': 'Organization',
      name: 'Price Services Group, LLC',
      url: 'https://priceservicesgroup.com',
    },
  };
}

/** Dataset JSON-LD block for a specific cited .gov figure. */
export function dataset(opts: DatasetOpts) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: opts.name,
    description: opts.description,
    creator: {
      '@type': 'Organization',
      name: opts.creatorName ?? 'CMS',
      url: opts.creatorUrl,
    },
    dateModified: opts.dateModified ?? '2026',
    license: 'https://www.usa.gov/government-works',
  };
}
