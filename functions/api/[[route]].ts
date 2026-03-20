import { app } from "@/app";

export const onRequest = (context: EventContext<Env, string, Record<string, unknown>>) =>
  app.fetch(context.request, context.env);
