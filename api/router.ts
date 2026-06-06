import { createRouter, publicQuery } from "./middleware";
import { generateRouter } from "./routers/generate";
import { generationRouter } from "./routers/generation";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),

  generate: generateRouter,
  generation: generationRouter,
});

export type AppRouter = typeof appRouter;
