// Provider-flexible LLM resolver for the news classifier.
//
// Uses Anthropic (Claude) when ANTHROPIC_API_KEY is set, otherwise OpenAI when
// OPENAI_API_KEY is set — so you can reuse whichever key you already have.
// A cheap, fast model is plenty for headline classification.

export function hasLLM(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY);
}

/** Resolve a classifier model handle for the Vercel AI SDK. */
export async function classifierModel() {
  const override = process.env.NEWS_LLM_MODEL;

  if (process.env.ANTHROPIC_API_KEY) {
    const { anthropic } = await import("@ai-sdk/anthropic");
    const id = override && override.startsWith("claude") ? override : "claude-haiku-4-5";
    return anthropic(id);
  }

  const { openai } = await import("@ai-sdk/openai");
  const id = override && /^(gpt|o[1-9]|chatgpt)/.test(override) ? override : "gpt-4o-mini";
  // Disable strict structured outputs — matches the WhataHotel advisor config
  // and avoids rejecting optional/enum schemas.
  return openai(id, { structuredOutputs: false });
}
