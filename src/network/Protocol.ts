export type Message =
  | { type: "ready"; player?: string }
  | { type: "snake"; segments: { x: number; y: number }[]; score?: number }
  | { type: "food"; positions: { x: number; y: number }[] }
  | { type: "death" }
  | { type: "gameOver" }
  | { type: "pause" }
  | { type: "pauseAccept" }
  | { type: "pauseDeny" }
  | { type: "unpause" };

const VALID_TYPES = new Set([
  "ready", "snake", "food", "death", "gameOver",
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
