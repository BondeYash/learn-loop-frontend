import { handlePublicRequest } from "./publicCache.js";

export default {
  fetch(request, env, ctx) { return handlePublicRequest(request, env, ctx); },
};
