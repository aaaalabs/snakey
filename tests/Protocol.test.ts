import { describe, it, expect } from "vitest";
import { encodeMessage, decodeMessage, Message } from "../src/network/Protocol";

describe("Protocol", () => {
  it("encodes and decodes ready message", () => {
    const msg: Message = { type: "ready", player: "alice" };
    const encoded = encodeMessage(msg);
    const decoded = decodeMessage(encoded);
    expect(decoded).toEqual(msg);
  });

  it("encodes and decodes snake message", () => {
    const msg: Message = {
      type: "snake",
      segments: [{ x: 5, y: 5 }, { x: 4, y: 5 }],
      score: 100,
    };
    const encoded = encodeMessage(msg);
    const decoded = decodeMessage(encoded);
    expect(decoded).toEqual(msg);
  });

  it("encodes and decodes gameOver message", () => {
    const msg: Message = { type: "gameOver" };
    const encoded = encodeMessage(msg);
    const decoded = decodeMessage(encoded);
    expect(decoded).toEqual(msg);
  });

  it("returns null for invalid JSON", () => {
    expect(decodeMessage("not json")).toBeNull();
  });

  it("returns null for unknown message type", () => {
    expect(decodeMessage('{"type": "unknown"}')).toBeNull();
  });

  it("returns null for missing type", () => {
    expect(decodeMessage('{"data": "test"}')).toBeNull();
  });

  it("handles all message types", () => {
    const types: Message["type"][] = [
      "ready", "snake", "food", "death", "gameOver",
      "pause", "pauseAccept", "pauseDeny", "unpause",
    ];
    for (const type of types) {
      const msg = { type } as Message;
      const decoded = decodeMessage(encodeMessage(msg));
      expect(decoded?.type).toBe(type);
    }
  });
});
