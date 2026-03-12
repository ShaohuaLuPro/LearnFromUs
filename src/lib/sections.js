export const sectionGroups = [
  {
    title: 'Software Engineering',
    items: [
      { value: 'frontend', label: 'Front End' },
      { value: 'backend', label: 'Back End' },
      { value: 'algorithms', label: 'Algorithms' },
      { value: 'system-design', label: 'System Design' },
      { value: 'ui-ux', label: 'UI / UX' },
      { value: 'devops-cloud', label: 'DevOps / Cloud' },
      { value: 'mobile', label: 'Mobile' },
      { value: 'testing-qa', label: 'Testing / QA' },
      { value: 'security', label: 'Security' },
      { value: 'sde-general', label: 'General SDE' }
    ]
  },
  {
    title: 'Data Science & AI',
    items: [
      { value: 'ai-llm', label: 'AI / LLM' },
      { value: 'mle', label: 'MLE' },
      { value: 'deep-learning', label: 'Deep Learning' },
      { value: 'data-engineering', label: 'Data Engineering' },
      { value: 'statistics', label: 'Statistics' },
      { value: 'analytics', label: 'Analytics' },
      { value: 'experimentation', label: 'Experimentation' },
      { value: 'visualization', label: 'Visualization' },
      { value: 'ds-general', label: 'General DS' }
    ]
  },
  {
    title: 'Development Team',
    items: [
      { value: 'announcements', label: 'Announcements' },
      { value: 'system-update', label: 'System Update' }
    ]
  }
];

export const allSections = sectionGroups.flatMap((group) => group.items);

export const defaultSection = allSections[0];

export const sectionSelectOptions = sectionGroups.map((group) => ({
  label: group.title,
  options: group.items.map((item) => ({ value: item.value, label: item.label }))
}));

export function getSectionLabel(value) {
  const found = allSections.find((item) => item.value === value);
  if (found) {
    return found.label;
  }
  return String(value || '')
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
