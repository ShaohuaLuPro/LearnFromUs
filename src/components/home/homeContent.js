import { buildFooterContent } from '../siteChromeConfig';
import { resolveHomeCollectionImage } from '../../lib/homeMedia';

export const HOME_COLLECTIONS = [
  {
    key: 'housing',
    title: 'Housing',
    subtitle: 'Home & Living',
    blurb: 'Practical systems for better daily living and smarter decisions at home.',
    image: resolveHomeCollectionImage('housing')
  },
  {
    key: 'sports',
    title: 'Sports',
    subtitle: 'Fitness & Training',
    blurb: 'Actionable training insights focused on consistency, progress, and execution.',
    image: resolveHomeCollectionImage('sports')
  },
  {
    key: 'social',
    title: 'Social',
    subtitle: 'Community & Dating',
    blurb: 'Real-world communication and relationship strategies that actually work.',
    image: resolveHomeCollectionImage('social')
  },
  {
    key: 'ai',
    title: 'AI',
    subtitle: 'Artificial Intelligence',
    blurb: 'From prompts to production, learn AI workflows built around practical outcomes.',
    image: resolveHomeCollectionImage('ai')
  },
  {
    key: 'food',
    title: 'Food',
    subtitle: 'Cooking & Taste',
    blurb: 'Simple food systems, better habits, and practical choices that fit real life.',
    image: resolveHomeCollectionImage('food')
  },
  {
    key: 'travel',
    title: 'Travel',
    subtitle: 'Movement & Experience',
    blurb: 'Travel with more intention, less friction, and decisions that stay useful on the move.',
    image: resolveHomeCollectionImage('travel')
  }
];

export const HOME_PRINCIPLES = [
  {
    key: 'forum',
    eyebrow: 'Spaces',
    title: 'Curated by topics',
    summary: 'Explore ideas, systems, and real-world practices without the usual noise.',
    body: [
      'Every space is organized with intention so people can move straight into the signal.',
      'Sections are built to surface grounded experience, not endless chatter.'
    ],
    accent: 'Structure',
    meta: ['Topic-first navigation', 'Clear sections', 'Signal over noise']
  },
  {
    key: 'search',
    eyebrow: 'Search',
    title: 'Find posts by real relevance',
    summary: 'Useful knowledge should stay discoverable as the platform grows.',
    body: [
      'Search looks across titles, content, tags, authors, and topics with meaning in mind.',
      'The goal is simple: bring forward what helps, not just what happens to be loud.'
    ],
    accent: 'Precision',
    meta: ['Meaning-ranked results', 'Cross-topic discovery', 'Built to scale']
  },
  {
    key: 'community',
    eyebrow: 'Community',
    title: 'Built for proof, not fluff',
    summary: 'Credibility comes from what people build, test, and refine in public.',
    body: [
      'Posts are shaped by implementation details, practical insight, and real outcomes.',
      'That makes skill easier to see and knowledge easier to carry into real work.'
    ],
    accent: 'Proof',
    meta: ['Real execution', 'Transferable knowledge', 'Visible skill']
  }
];

// Structured content keeps the homepage ready for a CMS or API later.
export function buildHomeContent({ currentUser, forumCountDisplay, sectionCountDisplay }) {
  return {
    hero: {
      eyebrow: 'For People Who Build',
      title: {
        lead: 'Most platforms are full of opinions.',
        support: 'Very few show',
        emphasis: 'real execution.'
      },
      supporting:
        'Real experience beats opinions. Execution is visible. Useful knowledge compounds across software, fitness, and everyday life.',
      aside:
        'A calmer homepage system built to scale with product, story, and community.',
      metrics: [
        { label: 'Active spaces', value: forumCountDisplay },
        { label: 'Structured sections', value: sectionCountDisplay },
        { label: 'Core standard', value: 'Real execution' }
      ],
      actions: [
        {
          key: 'forum',
          href: '/forum',
          label: 'Enter the Feed',
          kind: 'primary'
        },
        {
          key: 'about',
          href: '/about',
          label: 'Read the Story',
          kind: 'secondary'
        },
        !currentUser ? {
          key: 'login',
          href: '/login',
          label: 'Join and Start Posting',
          kind: 'text'
        } : null
      ].filter(Boolean)
    },
    intro: {
      eyebrow: 'What This Homepage Optimizes For',
      title: 'Calm structure. Fast perception. Minimal friction.',
      paragraphs: [
        'The homepage is intentionally light on decoration so sections feel open, readable, and easy to scan.',
        'Content appears before users reach it, which keeps the experience visually complete even during rapid scrolling.'
      ]
    },
    features: {
      eyebrow: 'Why It Works',
      title: 'Designed for clarity, not clutter.',
      description:
        'The homepage is organized as a small set of reusable scenes with generous spacing, restrained motion, and data-driven content.',
      cards: [
        {
          key: 'execution',
          title: 'Clear hierarchy',
          copy: 'Each section has one focal point so users can scan without friction.'
        },
        {
          key: 'systems',
          title: 'Prop-driven sections',
          copy: 'Content is separated from structure so future teams can change copy without rewriting components.'
        },
        {
          key: 'motion',
          title: 'Subtle motion',
          copy: 'Reveal behavior is shared and restrained so the page feels polished, not busy.'
        }
      ]
    },
    preview: {
      eyebrow: 'Content Preview',
      title: 'A system that can present both ideas and product surfaces.',
      description:
        'The same structure can support editorial stories, community previews, and future CMS-fed collections.',
      principles: HOME_PRINCIPLES,
      collections: HOME_COLLECTIONS
    },
    cta: {
      eyebrow: 'Start Here',
      title: 'Enter through the work, or through the story.',
      description:
        'Move straight into the feed or learn the thinking behind the platform first. The layout stays minimal while still supporting multiple user intents.',
      actions: [
        {
          key: 'feed',
          href: '/forum',
          eyebrow: 'Feed',
          title: 'Go to Community Feed',
          copy: 'Browse live discussions and topic spaces.'
        },
        {
          key: 'story',
          href: '/about',
          eyebrow: 'About',
          title: 'Read Our Story',
          copy: 'See why tsumit exists and where it is headed.'
        }
      ]
    },
    footer: buildFooterContent()
  };
}
