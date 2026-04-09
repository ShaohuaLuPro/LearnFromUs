import { buildFooterContent } from '../siteChromeConfig';
import { resolveHomeCollectionImage } from '../../lib/homeMedia';

export const HOME_COLLECTIONS = [
  {
    key: 'housing',
    title: 'Housing',
    subtitle: 'Home & Living',
    blurb: 'Share real setups, routines, and decisions that made home life easier, cleaner, and more repeatable.',
    image: resolveHomeCollectionImage('housing')
  },
  {
    key: 'sports',
    title: 'Sports',
    subtitle: 'Fitness & Training',
    blurb: 'From tennis meetups to training plans, post what actually worked instead of generic motivation.',
    image: resolveHomeCollectionImage('sports')
  },
  {
    key: 'social',
    title: 'Social',
    subtitle: 'Community & Dating',
    blurb: 'Use the platform to meet people, build friendships, and share practical social advice with real context.',
    image: resolveHomeCollectionImage('social')
  },
  {
    key: 'ai',
    title: 'AI',
    subtitle: 'Artificial Intelligence',
    blurb: 'AI is built into the product itself so you can draft, search, follow spaces, and get things done faster.',
    image: resolveHomeCollectionImage('ai')
  },
  {
    key: 'food',
    title: 'Food',
    subtitle: 'Cooking & Taste',
    blurb: 'Post recipes, meal systems, and everyday food choices that are tested in real life, not just imagined.',
    image: resolveHomeCollectionImage('food')
  },
  {
    key: 'travel',
    title: 'Travel',
    subtitle: 'Movement & Experience',
    blurb: 'Travel, money, markets, outfits, and everything in between all fit here when the post is useful and proven.',
    image: resolveHomeCollectionImage('travel')
  }
];

export const HOME_PRINCIPLES = [
  {
    key: 'forum',
    eyebrow: 'Spaces',
    title: 'Join spaces built around real interests',
    summary: 'Follow the spaces you care about, from AI and stocks to dating, sports, food, outfits, and everyday life.',
    body: [
      'Spaces keep people close to the topics they actually care about instead of dumping everything into one noisy feed.',
      'You can follow spaces directly, and AI can help you navigate to the right place faster.'
    ],
    accent: 'Structure',
    meta: ['Follow spaces fast', 'Topic-first discovery', 'Signal over noise']
  },
  {
    key: 'ai',
    eyebrow: 'AI Actions',
    title: 'Let AI do the work with you',
    summary: 'The core product experience is AI-assisted, not AI-decorated.',
    body: [
      'AI can help generate a post in one step, help you follow spaces, and support most of the actions people already take across the product.',
      'Instead of making users click through everything manually, the assistant helps turn intent into action.'
    ],
    accent: 'Speed',
    meta: ['One-click posting', 'AI-assisted actions', 'Less friction']
  },
  {
    key: 'memory',
    eyebrow: 'Memory',
    title: 'Posts that sound like you',
    summary: 'AI remembers your past posts so new writing can stay closer to your own tone, style, and point of view.',
    body: [
      'The goal is not generic AI writing. The goal is faster publishing that still feels personal and recognizable.',
      'That makes it easier to keep sharing proven solutions without rewriting your voice from scratch every time.'
    ],
    accent: 'Voice',
    meta: ['Style memory', 'Personal tone', 'Faster repeat posting']
  }
];

// Structured content keeps the homepage ready for a CMS or API later.
export function buildHomeContent({ currentUser, forumCountDisplay, sectionCountDisplay }) {
  return {
    hero: {
      eyebrow: 'For People Who Actually Do',
      title: {
        lead: 'Don’t just talk about it.',
        support: 'Share the',
        emphasis: 'proved solution.'
      },
      supporting:
        'Tsumit is for people who want to share what really worked, whether that is software, stocks, dating, tennis, travel, food, outfits, or everyday life.',
      aside:
        'The platform is built around useful action: AI can help you generate posts, follow spaces, and do most things on the site without extra friction.',
      metrics: [
        { label: 'Active spaces', value: forumCountDisplay },
        { label: 'Structured sections', value: sectionCountDisplay },
        { label: 'Core standard', value: 'Proved solutions' }
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
      eyebrow: 'Why Tsumit Exists',
      title: 'Less empty opinion. More useful proof.',
      paragraphs: [
        'A lot of platforms reward people for sounding smart. We want people to show what actually worked and let others build on it.',
        'That can mean a machine learning workflow, a stock idea, a social lesson, a tennis meetup, a travel plan, or an outfit that genuinely works in real life.'
      ]
    },
    features: {
      eyebrow: 'Core Product',
      title: 'AI is not a side feature here.',
      description:
        'The most important product experience is that AI helps people post faster, take actions faster, and keep their writing consistent over time.',
      cards: [
        {
          key: 'draft',
          title: 'One-click AI post generation',
          copy: 'Turn an idea into a publishable draft fast, so people can share useful experience before it disappears.'
        },
        {
          key: 'actions',
          title: 'AI can help with actions across the site',
          copy: 'Following spaces, navigating content, and handling common product actions should feel lighter and more direct.'
        },
        {
          key: 'voice',
          title: 'It remembers how you write',
          copy: 'Because it can use your past posts as context, new drafts can stay closer to your own voice instead of sounding generic.'
        }
      ]
    },
    preview: {
      eyebrow: 'What People Share',
      title: 'One place for useful solutions across real life.',
      description:
        'People come here to share things that are actually usable, not just things that sound nice in theory.',
      principles: HOME_PRINCIPLES,
      collections: HOME_COLLECTIONS
    },
    cta: {
      eyebrow: 'Start Here',
      title: 'Open the feed, or let AI help you begin.',
      description:
        'Go straight into the community, or learn the story behind the product first. Either way, the goal is the same: share what works.',
      actions: [
        {
          key: 'feed',
          href: '/forum',
          eyebrow: 'Feed',
          title: 'Go to Community Feed',
          copy: 'Browse spaces, follow topics you care about, and see proven solutions people are already sharing.'
        },
        {
          key: 'story',
          href: '/about',
          eyebrow: 'About',
          title: 'Read Our Story',
          copy: 'See the thinking behind a platform built for action, memory, and useful sharing.'
        }
      ]
    },
    footer: buildFooterContent()
  };
}
