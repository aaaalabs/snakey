import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

const CHALLENGE_TTL = 120; // seconds
const SCORE_KEY = "snakey:scores";
const CHALLENGE_PREFIX = "snakey:challenge:";
const PLAYING_PREFIX = "snakey:playing:";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (req.method === "GET") {
      const action = req.query.action as string;

      if (action === "challenges") {
        const keys = await redis.keys(`${CHALLENGE_PREFIX}*`);
        const challenges = [];
        for (const key of keys) {
          const data = await redis.get<string>(key);
          if (data) {
            const parsed = JSON.parse(data);
            challenges.push(parsed);
          }
        }
        return res.json({ challenges });
      }

      if (action === "scores") {
        const scores = await redis.zrange(SCORE_KEY, 0, 19, { rev: true, withScores: true });
        const formatted = [];
        for (let i = 0; i < scores.length; i += 2) {
          formatted.push({ player: scores[i], score: Number(scores[i + 1]) });
        }
        return res.json({ scores: formatted });
      }

      return res.status(400).json({ error: "Unknown action" });
    }

    if (req.method === "POST") {
      const { action, player, peerId, opponent, score } = req.body;

      if (action === "challenge") {
        await redis.set(
          `${CHALLENGE_PREFIX}${player}`,
          JSON.stringify({ player, peerId }),
          { ex: CHALLENGE_TTL }
        );
        return res.json({ ok: true });
      }

      if (action === "accept") {
        const data = await redis.get<string>(`${CHALLENGE_PREFIX}${opponent}`);
        if (!data) return res.json({ peerId: null });
        const parsed = JSON.parse(data);
        await redis.del(`${CHALLENGE_PREFIX}${opponent}`);
        return res.json({ peerId: parsed.peerId });
      }

      if (action === "score") {
        const current = await redis.zscore(SCORE_KEY, player);
        if (!current || score > Number(current)) {
          await redis.zadd(SCORE_KEY, { score, member: player });
        }
        return res.json({ ok: true });
      }

      if (action === "playing") {
        await redis.set(`${PLAYING_PREFIX}${player}`, "1", { ex: 600 });
        return res.json({ ok: true });
      }

      if (action === "stopped") {
        await redis.del(`${PLAYING_PREFIX}${player}`);
        return res.json({ ok: true });
      }

      return res.status(400).json({ error: "Unknown action" });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("Leaderboard error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
