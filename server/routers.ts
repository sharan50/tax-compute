import { COOKIE_NAME } from "@shared/const";
import {
  TRIAGE_SYSTEM_PROMPT,
  buildTriageUserPrompt,
  sanitizeClassifications,
  triageInputSchema,
  triageResponseJsonSchema,
} from "@shared/triage";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";

// ─── Router ──────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  triage: router({
    classify: publicProcedure
      .input(triageInputSchema)
      .mutation(async ({ input }) => {
        if (input.transactions.length === 0) {
          return { classifications: [] };
        }

        try {
          const result = await invokeLLM({
            messages: [
              { role: "system", content: TRIAGE_SYSTEM_PROMPT },
              { role: "user", content: buildTriageUserPrompt(input) },
            ],
            response_format: {
              type: "json_schema",
              json_schema: triageResponseJsonSchema,
            },
          });

          const content = result.choices[0]?.message?.content;
          if (!content || typeof content !== "string") {
            throw new Error("Empty LLM response");
          }

          const parsed = JSON.parse(content);
          const requestedIds = new Set(input.transactions.map(t => t.id));
          return {
            classifications: sanitizeClassifications(
              parsed?.classifications,
              requestedIds
            ),
          };
        } catch (error) {
          console.error("[Triage] LLM classification failed:", error);
          // Return empty classifications on failure — frontend falls back to rule-based
          return {
            classifications: [],
            error: error instanceof Error ? error.message : "Classification failed",
          };
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
