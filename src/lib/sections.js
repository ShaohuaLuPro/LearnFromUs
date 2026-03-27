const SECTION_FALLBACK_VALUE = 'general';

const SECTION_ACRONYMS = {
  ai: 'AI',
  llm: 'LLM',
  mle: 'MLE',
  ml: 'ML',
  ds: 'DS',
  sde: 'SDE',
  ui: 'UI',
  ux: 'UX',
  qa: 'QA',
  api: 'API',
  sql: 'SQL',
  devops: 'DevOps'
};

function cleanSectionValue(value) {
  return String(value || '').trim();
}

function isForumLike(value) {
  return Boolean(value && typeof value === 'object' && Array.isArray(value.sectionScope));
}

export function getSectionValues(source = []) {
  const values = Array.isArray(source)
    ? source.flatMap((item) => (isForumLike(item) ? item.sectionScope || [] : item))
    : [source];

  return [...new Set(values.map((value) => cleanSectionValue(value)).filter(Boolean))];
}

export function getSectionLabel(value) {
  return cleanSectionValue(value)
    .split('-')
    .filter(Boolean)
    .map((part) => SECTION_ACRONYMS[part.toLowerCase()] || `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

export function getSectionOptions(source = []) {
  return getSectionValues(source).map((value) => ({
    value,
    label: getSectionLabel(value)
  }));
}

export function getSectionSelectOptions(source = [], groupLabel = 'Sections') {
  const options = getSectionOptions(source);
  return options.length > 0
    ? [{ label: groupLabel, options }]
    : [];
}

export function getDefaultSectionValue(...sources) {
  for (const source of sources) {
    const values = getSectionValues(source);
    if (values[0]) {
      return values[0];
    }
  }

  return SECTION_FALLBACK_VALUE;
}
