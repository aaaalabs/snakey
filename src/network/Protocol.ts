export type Message =
  | { type: "ready"; player?: string }
  | { type: "snake"; segments: { x: number; y: number }[]; score?: number }
  | { type: "attack"; kind: "obstacles" | "shrink"; count: number }
  | { type: "death" }
  | { type: "roundWin"; round: number; wins: number }
  | { type: "pause" }
  | { type: "pauseAccept" }
  | { type: "pauseDeny" }
  | { type: "unpause" };

const VALID_TYPES = new Set([
  "ready", "snake", "attack", "death", "roundWin",
  "pause", "pauseAccept", "pauseDeny", "unpause",
]);

export function encodeMessage(msg: Message): string {
  return JSON.stringify(msg);
}

export function decodeMessage(data: string): Message | null {
  try {
    const parsed = JSON.parse(data);
    if (parsed && typeof parsed.type === "string" && VALID_TYPES.has(parsed.type)) {
      return parsed as Message;
    }
    return null;
  } catch {
    return null;
  }
}
