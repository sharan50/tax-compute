import type { Config } from "@netlify/functions";
import { initTRPC } from "@trpc/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import superjson from "superjson";
import {
  TRIAGE_SYSTEM_PROMPT,
  buildTriageUserPrompt,
  sanitizeClassifications,
  triageInputSchema,
  triageResponseJsonSchema,
  type TriageClassification,
} from "../../shared/triage";

// ─── Netlify serverless API ──────────────────────────────────────────
//
// Serves the small tRPC surface the client actually calls when the app is
// deployed as a static SPA on Netlify (the Express server in server/ is only
// used for local development and Manus hosting).
//
//   auth.me          → null (no auth provider on Netlify; the app is public)
//   auth.logout      → no-op
//   triage.classify  → LLM-backed bank-transaction classification, if an
//                      LLM API key is configured; otherwise a clear error
//                      that the UI surfaces while rule-based categorisation
//                      keeps working.
//
// To enable AI triage, set these environment variables on the Netlify site:
//   LLM_API_KEY   (required) — API key for an OpenAI-compatible endpoint
//   LLM_API_URL   (optional) — base URL, default https://api.openai.com
//   LLM_MODEL     (optional) — model name, default gpt-4o-mini

const env = (key: string): string | undefined => {
  const g = globalThis as { Netlify?: { env: { get(k: string): string | undefined } } };
  return g.Netlify?.env.get(key) ?? process.env[key];
};

const t = initTRPC.create({ transformer: superjson });

// Best-effort abuse damper for the public, keyed LLM endpoint: cap classify
// calls per warm function instance. It does not survive scale-out or cold
// starts (real protection is the provider-side spend limit — see the PR
// notes), but it stops naive request loops for free.
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX_CALLS = 30;
let recentCalls: number[] = [];

function rateLimited(): boolean {
  const now = Date.now();
  recentCalls = recentCalls.filter(ts => now - ts < RATE_WINDOW_MS);
  if (recentCalls.length >= RATE_MAX_CALLS) return true;
  recentCalls.push(now);
  return false;
}

async function classifyWithLLM(
  input: Parameters<typeof buildTriageUserPrompt>[0]
): Promise<{ classifications: TriageClassification[]; error?: string }> {
  const apiKey = env("LLM_API_KEY") ?? env("BUILT_IN_FORGE_API_KEY") ?? env("OPENAI_API_KEY");
  if (!apiKey) {
    return {
      classifications: [],
      error:
        "AI triage is not configured on this deployment — set LLM_API_KEY in the " +
        "Netlify environment to enable it. Rule-based categorisation still applies.",
    };
  }

  const baseUrl = (
    env("LLM_API_URL") ??
    env("BUILT_IN_FORGE_API_URL") ??
    env("OPENAI_BASE_URL") ??
    "https://api.openai.com"
  ).replace(/\/$/, "");
  const model = env("LLM_MODEL") ?? "gpt-4o-mini";

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: TRIAGE_SYSTEM_PROMPT },
        { role: "user", content: buildTriageUserPrompt(input) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: triageResponseJsonSchema,
      },
      // A 50-transaction batch needs ~3k output tokens; 4096 is safe
      // headroom and within every mainstream model's completion cap.
      max_tokens: 4096,
    }),
    // Netlify's default synchronous function timeout is 10 seconds — abort
    // the upstream call first so the client gets our graceful error payload
    // instead of a platform 502.
    signal: AbortSignal.timeout(9_000),
  });

  if (!response.ok) {
    // Upstream error bodies can echo org/quota details; keep them in the
    // function logs only and hand the anonymous caller a generic message.
    const errorText = await response.text();
    console.error(
      `[Triage] LLM invoke failed: ${response.status} ${response.statusText} – ${errorText.slice(0, 500)}`
    );
    throw new Error(`AI service error (HTTP ${response.status})`);
  }

  const result = (await response.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const content = result.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("Empty LLM response");
  }

  // Defensive parse: some providers wrap structured output in code fences.
  const cleaned = content.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, "");
  const parsed = JSON.parse(cleaned);
  const requestedIds = new Set(input.transactions.map(tx => tx.id));
  return {
    classifications: sanitizeClassifications(parsed?.classifications, requestedIds),
  };
}

const appRouter = t.router({
  auth: t.router({
    me: t.procedure.query(() => null),
    logout: t.procedure.mutation(() => ({ success: true }) as const),
  }),

  triage: t.router({
    classify: t.procedure.input(triageInputSchema).mutation(async ({ input }) => {
      if (input.transactions.length === 0) {
        return { classifications: [] };
      }

      if (rateLimited()) {
        return {
          classifications: [] as TriageClassification[],
          error: "AI triage is temporarily rate limited — please try again in a few minutes.",
        };
      }

      try {
        return await classifyWithLLM(input);
      } catch (error) {
        console.error("[Triage] LLM classification failed:", error);
        // Empty classifications on failure — the frontend falls back to
        // its rule-based categories and shows the error as a toast.
        return {
          classifications: [] as TriageClassification[],
          error: error instanceof Error ? error.message : "Classification failed",
        };
      }
    }),
  }),
});

export default async (req: Request) => {
  const url = new URL(req.url);

  // Browsers attach an Origin header to cross-site requests; only the SPA
  // served from this same site is a legitimate caller. (Requests without an
  // Origin — curl and friends — are covered by the rate damper above.)
  const origin = req.headers.get("origin");
  if (origin) {
    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host;
    } catch {
      // fall through with originHost = null → rejected below
    }
    if (originHost !== url.host) {
      return new Response("Forbidden", { status: 403 });
    }
  }

  // The function is mounted at /api/trpc/* whether invoked via the in-code
  // route below or via the legacy /.netlify/functions/api path, so derive
  // the endpoint prefix from wherever "/trpc/" appears in the URL.
  const marker = "/trpc/";
  const idx = url.pathname.indexOf(marker);
  const endpoint = idx >= 0 ? url.pathname.slice(0, idx + marker.length - 1) : "/api/trpc";

  return fetchRequestHandler({
    endpoint,
    req,
    router: appRouter,
    createContext: () => ({}),
  });
};

export const config: Config = {
  path: "/api/trpc/*",
};
