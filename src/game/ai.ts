import type { Question } from './questions.ts'

const SCHEMA = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          prompt: { type: 'string' },
          answer: { type: 'string' },
        },
        required: ['prompt', 'answer'],
        additionalProperties: false,
      },
    },
  },
  required: ['questions'],
  additionalProperties: false,
}

const SYSTEM = `You write questions for "Psych", a bluffing party game for adults. Players see a question, each writes a FAKE answer meant to sound true, then everyone votes on which answer is real.

Good questions:
- Have a real, verifiable, surprising answer that players are unlikely to already know (obscure words, odd origins of names, strange laws, weird history, animal facts, bizarre records).
- Have a short answer: under 8 words, no trailing period.
- Make it easy to invent believable fakes in the same style.
- Are accurate. Only include facts you are highly confident are true.

Avoid trivia that's common knowledge, answers that are just a number or year unless the number is the funny part, and anything mean-spirited.`

export class AiError extends Error {}

/** Calls Claude straight from the browser with the host's own API key. */
export async function generateQuestions(apiKey: string, theme: string, count: number): Promise<Question[]> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
  const topic = theme.trim() || 'anything weird and surprising'
  try {
    const res = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
      system: SYSTEM,
      messages: [{ role: 'user', content: `Write ${count} questions. Theme: ${topic}.` }],
    })
    if (res.stop_reason === 'refusal') throw new AiError('Claude declined that theme. Try a different one.')
    const text = res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
    const parsed = JSON.parse(text) as { questions: Question[] }
    const qs = parsed.questions
      .map((q) => ({ prompt: q.prompt.trim(), answer: q.answer.trim().replace(/\.$/, '') }))
      .filter((q) => q.prompt && q.answer && q.answer.length <= 80)
    if (qs.length === 0) throw new AiError('No usable questions came back. Try again.')
    return qs
  } catch (e) {
    if (e instanceof AiError) throw e
    if (e instanceof Anthropic.AuthenticationError) throw new AiError('That API key was rejected.')
    if (e instanceof Anthropic.RateLimitError) throw new AiError('Rate limited. Wait a moment and try again.')
    if (e instanceof Anthropic.APIError) throw new AiError(`Claude API error ${e.status ?? ''}: ${e.message}`)
    if (e instanceof SyntaxError) throw new AiError('Got a garbled response. Try again.')
    throw new AiError("Couldn't reach Claude. Check your connection.")
  }
}
