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
