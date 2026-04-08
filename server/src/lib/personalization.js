const INTEREST_SIGNAL_WEIGHTS = {
  like: 5,
  bookmark: 8,
  postOpen: 1,
  repeatVisit: 3,
  dwellBonus: 2
};

function normalizeInterestTag(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .slice(0, 80);
}

function getInterestTags({ tags = [], section = '' }) {
  const normalizedTags = Array.isArray(tags)
    ? tags.map((tag) => normalizeInterestTag(tag)).filter(Boolean)
    : [];
  const sectionTag = normalizeInterestTag(section) ? `section:${normalizeInterestTag(section)}` : '';

  return [...new Set([
    ...normalizedTags,
    sectionTag
  ].filter(Boolean))];
}

function getDwellBonusUnits(dwellTimeMs) {
  const safeDwellTime = Number(dwellTimeMs || 0);
  if (safeDwellTime >= 45000) {
    return 2;
  }
  if (safeDwellTime >= 8000) {
    return 1;
  }
  return 0;
}

function buildInterestScoreDelta({
  likeDelta = 0,
  bookmarkDelta = 0,
  clickDelta = 0,
  repeatVisitDelta = 0,
  dwellTimeMs = 0
} = {}) {
  return (
    Number(likeDelta || 0) * INTEREST_SIGNAL_WEIGHTS.like
    + Number(bookmarkDelta || 0) * INTEREST_SIGNAL_WEIGHTS.bookmark
    + Number(clickDelta || 0) * INTEREST_SIGNAL_WEIGHTS.postOpen
    + Number(repeatVisitDelta || 0) * INTEREST_SIGNAL_WEIGHTS.repeatVisit
    + getDwellBonusUnits(dwellTimeMs) * INTEREST_SIGNAL_WEIGHTS.dwellBonus
  );
}

function buildInterestUpdates({
  tags = [],
  section = '',
  likeDelta = 0,
  bookmarkDelta = 0,
  clickDelta = 0,
  repeatVisitDelta = 0,
  dwellTimeMs = 0
} = {}) {
  const interestTags = getInterestTags({ tags, section });
  if (interestTags.length === 0) {
    return [];
  }

  const scoreDelta = buildInterestScoreDelta({
    likeDelta,
    bookmarkDelta,
    clickDelta,
    repeatVisitDelta,
    dwellTimeMs
  });
  const distributedScore = scoreDelta === 0 ? 0 : scoreDelta / interestTags.length;

  return interestTags.map((tag) => ({
    tag,
    scoreDelta: distributedScore,
    likeDelta: Number(likeDelta || 0),
    bookmarkDelta: Number(bookmarkDelta || 0),
    clickDelta: Number(clickDelta || 0),
    repeatVisitDelta: Number(repeatVisitDelta || 0),
    dwellTimeMs: Math.max(0, Number(dwellTimeMs || 0))
  }));
}

module.exports = {
  INTEREST_SIGNAL_WEIGHTS,
  buildInterestScoreDelta,
  buildInterestUpdates,
  getInterestTags
};
