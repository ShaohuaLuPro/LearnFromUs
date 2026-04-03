const OpenAI = require('openai');
const {
  normalizeForumDescription,
  normalizeForumName,
  normalizeForumRationale,
  normalizeSectionScope
} = require('./forum-config');

const FORUM_REQUEST_DRAFT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: {
      type: 'string',
      minLength: 4,
      maxLength: 80
    },
    description: {
      type: 'string',
      minLength: 12,
      maxLength: 280
    },
    rationale: {
      type: 'string',
      minLength: 20,
      maxLength: 500
    },
    overview: {
      type: 'string',
      minLength: 1,
      maxLength: 220
    },
    sectionScope: {
      type: 'array',
      items: {
        type: 'string',
        minLength: 2,
        maxLength: 40
      },
      minItems: 1,
      maxItems: 4
    }
  },
  required: ['name', 'overview', 'description', 'rationale', 'sectionScope']
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

function normalizeForumRequestDraft(payload, fallbackDraft) {
  const raw = typeof payload === 'string' ? JSON.parse(payload) : payload;
  const name = normalizeForumName(raw?.name || fallbackDraft.name);
  const description = normalizeForumDescription(raw?.description || fallbackDraft.description);
  const rationale = normalizeForumRationale(raw?.rationale || fallbackDraft.rationale);
  const overview = String(raw?.overview || raw?.summary || fallbackDraft.overview || fallbackDraft.summary || '').trim().slice(0, 220);
  const sectionScope = normalizeSectionScope(raw?.sectionScope?.length ? raw.sectionScope : fallbackDraft.sectionScope);

  if (name.length < 4) {
    throw new Error('OpenAI forum request name was too short.');
  }
  if (description.length < 12) {
    throw new Error('OpenAI forum request description was too short.');
  }
  if (rationale.length < 20) {
    throw new Error('OpenAI forum request rationale was too short.');
  }
  if (!sectionScope.length) {
    throw new Error('OpenAI forum request did not include sections.');
  }

  return {
    draft: {
      name,
      overview,
      description,
      rationale,
      sectionScope: sectionScope.slice(0, 4)
    }
  };
}

function buildDraftPrompt({ message, fallbackDraft }) {
  return [
    `User request: ${String(message || '').trim()}`,
    '',
    'Fallback forum request draft:',
    JSON.stringify(fallbackDraft, null, 2),
    '',
    'Instructions:',
    '- Draft a forum request, not a forum post.',
    '- Set name to a concise forum title only.',
    '- Set overview to a short one-sentence overview of the forum idea.',
    '- Description should explain what kinds of discussion belong in the forum.',
    '- Rationale should explain why the forum should exist and who it helps.',
    '- Recommend 1 to 4 short section scope labels tailored to this forum topic.',
    '- Do not copy existing forum names or broad site-wide taxonomy unless the user explicitly asked for it.',
    '- Prefer focused labels like "mlops-platforms" or "model-deployment" over generic labels like "general".',
    '- Keep each field distinct. Do not merge title, overview, description, and rationale together.',
    '- Keep the writing practical and ready to submit in the app.'
  ].join('\n');
}

function buildRewritePrompt({ instruction, draft, currentUserName }) {
  return [
    `User instruction: ${String(instruction || '').trim()}`,
    currentUserName ? `Requester name: ${currentUserName}` : '',
    '',
    'Current forum request draft:',
    JSON.stringify(draft, null, 2),
    '',
    'Instructions:',
    '- Rewrite the forum request according to the user instruction.',
    '- Preserve the core idea unless the instruction asks to reposition it.',
    '- Make the rewrite visibly different from the input when the instruction asks for improvement.',
    '- Treat name, overview, description, rationale, and sectionScope as one connected draft package.',
    '- For general improvement requests like polish, focus, expand, or strengthen, actively reconsider and rewrite all major fields, not just the rationale.',
    '- Improve the forum name when a sharper, clearer, or more specific title would help. Keep name as the forum title only.',
    '- Keep overview as a separate short overview sentence.',
    '- Rewrite the description and rationale with materially different wording, sentence structure, or specificity when improving the draft.',
    '- Update sectionScope when better labels would make the forum feel more focused and submission-ready.',
    '- Do not leave name and description unchanged unless the instruction explicitly asks to preserve them.',
    '- Improve clarity, specificity, and submission-readiness.',
    '- Recommend 1 to 4 section scope labels that are tailored to the request.',
    '- Do not reuse existing forum names as section scope labels.',
    '- Return a complete rewritten draft, not commentary.',
    '- Set overview to one sentence that explains the rewritten forum concept clearly.'
  ].filter(Boolean).join('\n');
}

function createOpenAIForumRequestDraftService({ apiKey, model }) {
  const trimmedKey = String(apiKey || '').trim();
  const trimmedModel = String(model || 'gpt-5-mini').trim() || 'gpt-5-mini';
  const client = trimmedKey ? new OpenAI({ apiKey: trimmedKey }) : null;

  async function runStructuredDraft({ systemText, userText, fallbackDraft, schemaName }) {
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
              text: systemText
            }
          ]
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: userText
            }
          ]
        }
      ],
      text: {
        format: {
          type: 'json_schema',
          name: schemaName,
          strict: true,
          schema: FORUM_REQUEST_DRAFT_SCHEMA
        }
      }
    });

    const parsed = normalizeForumRequestDraft(extractJsonString(response), fallbackDraft);
    return {
      ...parsed,
      provider: 'openai',
      model: trimmedModel
    };
  }

  return {
    isEnabled() {
      return Boolean(client);
    },
    getModel() {
      return trimmedModel;
    },
    async createDraft({ message, fallbackDraft }) {
      return runStructuredDraft({
        systemText: 'You are drafting a forum request for a technical community product. Produce a clear, submit-ready request.',
        userText: buildDraftPrompt({ message, fallbackDraft }),
        fallbackDraft,
        schemaName: 'forum_request_draft'
      });
    },
    async rewriteDraft({ instruction, draft, currentUserName }) {
      return runStructuredDraft({
        systemText: 'You are editing a forum request for a technical community product. Produce a sharper, clearer, submit-ready rewrite.',
        userText: buildRewritePrompt({ instruction, draft, currentUserName }),
        fallbackDraft: draft,
        schemaName: 'forum_request_rewrite'
      });
    }
  };
}

module.exports = {
  createOpenAIForumRequestDraftService
};
