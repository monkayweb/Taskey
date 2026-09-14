import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  framework: "nextjs",
  buildCommand: "next build",
  crons: [
    // 05:00 UTC is 07:00 in Johannesburg: the team's list is ready before
    // anybody sits down, and clients are chased during working hours.
    { path: "/api/cron/daily", schedule: "0 5 * * *" },
  ],
};
