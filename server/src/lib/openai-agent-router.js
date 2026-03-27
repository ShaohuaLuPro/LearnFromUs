const OpenAI = require('openai');

const AGENT_ROUTE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    tool: {
      type: 'string',
      enum: [
        'search_posts',
        'latest_posts',
        'latest_announcements',
        'trending_authors',
        'draft_post',
        'draft_forum_request',
        'rewrite_existing_post',
        'navigate_page',
        'help'
      ]
    },
    query: {
      type: 'string',
      minLength: 0,
      maxLength: 400
    },
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: 10
    },
    rationale: {
      type: 'string',
      minLength: 1,
      maxLength: 240
    }
  },
  required: ['tool', 'query', 'limit', 'rationale']
};

function extractJsonString(response) {
  const outputText = String(response?.output_text || '').trim();
  if (outputText) {
    return outputText;
  }

  const outputs = Array.isArray(response?.output) ? response.output : [];
  for (const item of outputs) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const block of content) {
      if (typeof block?.text === 'string' && block.text.trim()) {
        return block.text.trim();
      }
    }
  }

  throw new Error('OpenAI response did not include output text.');
}

function createOpenAIAgentRouter({ apiKey, model }) {
  const trimmedKey = String(apiKey || '').trim();
  const trimmedModel = String(model || 'gpt-5-mini').trim() || 'gpt-5-mini';
  const client = trimmedKey ? new OpenAI({ apiKey: trimmedKey }) : null;

  return {
    isEnabled() {
      return Boolean(client);
    },
    getModel() {
      return trimmedModel;
    },
    async routeMessage({ message, user }) {
      if (!client) {
        return null;
      }

      const response = await client.responses.create({
        model: trimmedModel,
        input: [
          {
            role: 'system',
            content: [
              {
                type: 'input_text',
                text: [
                  'You are a router for a technical community forum assistant.',
                  'Choose exactly one tool for each user message.',
                  'Available tools:',
                  '- search_posts: recommend or search forum posts for a topic, including learning requests like "I want to learn MLE".',
                  '- latest_posts: get the newest public forum posts.',
                  '- latest_announcements: get the newest announcements or product updates.',
                  '- trending_authors: show active authors or trending forum activity.',
                  '- draft_post: generate a draft post, especially when the user asks to write, draft, publish, or compose.',
                  '- draft_forum_request: draft a request for creating a new forum, including its name, description, rationale, and section scope.',
                  '- rewrite_existing_post: help the user improve or rewrite one of their existing posts in My Posts.',
                  '- navigate_page: take the user to an existing page or task surface in the app.',
                  '- help: only when none of the tools fit.',
                  'Prefer search_posts for requests about learning a topic, finding reading material, or related posts.',
                  'Forum context matters: in this forum, "MLE" usually refers to machine learning engineering, not maximum likelihood estimation.',
                  'Relevant forum sections include ai-llm, mle, deep-learning, analytics, backend, frontend, and announcements.',
                  'Prefer latest_posts for requests about newest, latest, or recent posts in general.',
                  'Prefer latest_announcements for "latest", "most recent", "newest", "announcement", or "update" requests.',
                  'Prefer draft_post for requests that ask the assistant to write content on the user\'s behalf.',
                  'Prefer draft_forum_request when the user wants help requesting, proposing, or creating a new forum/community space.',
                  'Prefer rewrite_existing_post when the user wants to edit, rewrite, improve, polish, shorten, expand, or refine one of their existing posts.',
                  'Prefer navigate_page when the user wants to open a page, go somewhere in the app, change password, open settings, see Home, see About, open My Posts, open analytics, or create a post.',
                  'For navigate_page, set query to one of: home, about, forum, forum-create-post, forums-request, settings-profile, settings-password, settings-danger, my-posts, following, followers, analytics, moderation, login.',
                  'Set query to the normalized topic or destination key.',
                  'Keep rationale short.'
                ].join('\n')
              }
            ]
          },
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: JSON.stringify({
                  message: String(message || '').trim(),
                  user: {
                    isAuthenticated: Boolean(user),
                    name: user?.name || '',
                    isAdmin: Boolean(user?.isAdmin)
                  }
                })
              }
            ]
          }
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'forum_agent_route',
            strict: true,
            schema: AGENT_ROUTE_SCHEMA
          }
        }
      });

      const parsed = JSON.parse(extractJsonString(response));
      return {
        tool: parsed.tool,
        query: String(parsed.query || '').trim(),
        limit: Number(parsed.limit) || 5,
        rationale: String(parsed.rationale || '').trim(),
        provider: 'openai',
        model: trimmedModel
      };
    }
  };
}

module.exports = {
  createOpenAIAgentRouter
};
