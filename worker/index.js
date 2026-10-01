import { handleRequest } from "./proxy.js";

export default {
  fetch(request, env) { return handleRequest(request, env); },
};
