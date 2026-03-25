const CORE_FORUM_SEEDS = [
  {
    slug: 'software-engineering',
    name: 'Software Engineering',
    description: 'Architecture, frontend, backend, DevOps, testing, security, and practical engineering workflows.',
    sectionScope: [
      'frontend',
      'backend',
      'algorithms',
      'system-design',
      'ui-ux',
      'devops-cloud',
      'mobile',
      'testing-qa',
      'security',
      'sde-general'
    ]
  },
  {
    slug: 'data-science-ai',
    name: 'Data Science & AI',
    description: 'Machine learning, AI systems, analytics, experimentation, and production data workflows.',
    sectionScope: [
      'ai-llm',
      'mle',
      'deep-learning',
      'data-engineering',
      'statistics',
      'analytics',
      'experimentation',
      'visualization',
      'ds-general'
    ]
  },
  {
    slug: 'dev-team-updates',
    name: 'Development Team',
    description: 'Announcements, product updates, and changes from the LearnFromUs team.',
    sectionScope: ['announcements', 'system-update']
  }
];

function normalizeForumSlug(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function normalizeForumName(input) {
  return String(input || '').trim().slice(0, 80);
}

function normalizeForumDescription(input) {
  return String(input || '').trim().slice(0, 280);
}

function normalizeForumRationale(input) {
  return String(input || '').trim().slice(0, 500);
}

function normalizeForumSectionValue(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function normalizeSectionScope(input) {
  const raw = Array.isArray(input)
    ? input
    : String(input || '')
      .split(',')
      .map((value) => value.trim());

  return [...new Set(
    raw
      .map((value) => normalizeForumSectionValue(value))
      .filter(Boolean)
  )].slice(0, 12);
}

function getDefaultForumSlugForSection(section) {
  const normalized = String(section || '').trim().toLowerCase();
  const coreForum = CORE_FORUM_SEEDS.find((forum) => forum.sectionScope.includes(normalized));
  return coreForum?.slug || CORE_FORUM_SEEDS[0].slug;
}

module.exports = {
  CORE_FORUM_SEEDS,
  normalizeForumSlug,
  normalizeForumName,
  normalizeForumDescription,
  normalizeForumRationale,
  normalizeSectionScope,
  getDefaultForumSlugForSection
};
