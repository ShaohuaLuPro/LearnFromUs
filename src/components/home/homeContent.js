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
      title: 'Post in seconds\nnot minutes',
      paragraphs: [
        'Turn ideas into posts — instantly.',
        'No formatting. No friction. Just publish.',
        'Start with a thought — we’ll structure the rest.',
        'Share what matters, before it fades.'
      ]
    },
    features: {
      title: 'Anything you want — text, images, ideas.',
      description: '',
      cards: [
        {
          key: 'ideas',
          title: 'Stop thinking. Just post.',
          copy: 'Capture the idea while it is still live. Structure comes next.',
          image: `${process.env.PUBLIC_URL}/images/home2-1.png`,
          imageAlt: 'Colorful AI-inspired composition',
          tone: 'light',
          imageScale: '0.9',
          imageX: '-2%',
          imageY: '1%'
        },
        {
          key: 'images',
          title: 'Images and stories, arranged with clarity.',
          copy: 'Bring visuals, context, and narrative into one clean block.',
          image: `${process.env.PUBLIC_URL}/images/home2-3.png`,
          imageAlt: 'Lifestyle collage with camera photos',
          tone: 'soft',
          imageScale: '0.95',
          imageX: '2%',
          imageY: '0%'
        },
        {
          key: 'emotion',
          title: 'Real moments deserve a warmer place to land.',
          copy: 'Human moments feel stronger when the layout gives them room to breathe.',
          image: `${process.env.PUBLIC_URL}/images/home2-4.png`,
          imageAlt: 'Child holding paws with a dog outdoors',
          tone: 'warm',
          imageScale: '0.84',
          imageX: '-6%',
          imageY: '4%'
        },
        {
          key: 'depth',
          title: 'Depth, signal, and brand in one bold surface.',
          copy: 'Premium structure makes even dense ideas feel deliberate and strong.',
          image: `${process.env.PUBLIC_URL}/images/home2-2.png`,
          imageAlt: 'Dark typography-based AI visual',
          tone: 'dark',
          imageScale: '0.88',
          imageX: '5%',
          imageY: '3%'
        }
      ]
    },
    preview: {
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
