import { createDemoApi } from "../lib/demo-api.js";

export default async function handler(request) {
  return createDemoApi({ secret: process.env.UINOTATE_DEMO_SIGNING_SECRET }).feedback(request);
}

export const config = {
  path: ["/api/feedback", "/.netlify/functions/feedback"],
  rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ["ip", "domain"] }
};
