import { createDemoApi } from "../lib/demo-api.js";

export default async function handler(request) {
  return createDemoApi({ secret: process.env.UINOTATE_DEMO_SIGNING_SECRET }).session(request);
}

export const config = {
  path: ["/api/demo-session", "/.netlify/functions/demo-session"],
  rateLimit: { windowLimit: 10, windowSize: 60, aggregateBy: ["ip", "domain"] }
};
