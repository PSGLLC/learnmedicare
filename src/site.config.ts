export const SITE_URL = 'https://learnmedicare.org';
export const BOOKING_URL = 'https://host.safemsngr.com/widget/booking/A0NTF4B4d9I3h3wNvyIB';
export const MEDICARE_QA_URL = 'https://huggingface.co/spaces/PPAKayla/medicare-qa';
export const TAGLINE = 'Where You Matter.';

export const NAV_LINKS = [
  { href: '/', label: 'Learn Medicare' },
  { href: '/basics', label: 'The Basics' },
  { href: '/enrollment', label: 'Enrollment' },
  { href: '/coverage', label: 'Coverage Options' },
  { href: '/penalties', label: 'Penalties' },
  { href: '/working-at-65', label: 'Working at 65' },
  { href: '/faq', label: 'FAQ' },
  { href: '/glossary', label: 'Glossary' },
  { href: '/guide', label: 'Free Guide' },
  { href: '/calculators', label: 'Calculators' },
  { href: '/course', label: 'Take the Course' },
  { href: '/blog', label: 'Blog' },
];

// Grouped separately from NAV_LINKS rather than appended flatly — the nav
// is already 12 items; a 5th group avoids further crowding the top-level
// bar. Rendered as a "Resources" dropdown in Nav.astro.
export const RESOURCES_DROPDOWN = [
  { href: '/what-is-medicare', label: 'What Is Medicare?' },
  { href: '/medicare-vs-medicaid', label: 'Medicare vs. Medicaid' },
  { href: '/medicare-costs-2026', label: '2026 Medicare Costs' },
  { href: '/medicare-mistakes', label: 'Medicare Mistakes to Avoid' },
];

export const PSG_INFO_LINKS = [
  { href: 'https://priceservicesgroup.com', label: 'priceservicesgroup.com' },
  { href: 'https://local.priceservicesgroup.com', label: 'Find Local Medicare Help' },
  { href: MEDICARE_QA_URL, label: 'Free Medicare Q&A' },
];

export const COMPLIANCE = {
  npn: 'NPN 18530055',
  agencyNpn: 'Agency NPN 20387435',
  states: ['NC', 'SC', 'GA', 'FL', 'VA', 'MD', 'MI', 'KS', 'TX', 'OH'],
  tpmo:
    'We do not offer every plan available in your area. Any information we provide is limited to the plans we do offer. Please contact Medicare.gov or 1-800-MEDICARE to get information on all of your options.',
};
