interface ChallengeEntry {
  player: string;
  peerId: string;
}

export class LeaderboardClient {
  private baseUrl = "/api";

  async postChallenge(player: string, peerId: string): Promise<void> {
    await fetch(`${this.baseUrl}/leaderboard`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "challenge", player, peerId }),
    });
  }

  async acceptChallenge(player: string, opponent: string): Promise<string | null> {
    const res = await fetch(`${this.baseUrl}/leaderboard`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept", player, opponent }),
    });
    const data = await res.json();
    return data.peerId ?? null;
  }

  async getActiveChallenges(): Promise<ChallengeEntry[]> {
    const res = await fetch(`${this.baseUrl}/leaderboard?action=challenges`);
    const data = await res.json();
    return data.challenges ?? [];
  }

  async submitScore(player: string, score: number): Promise<void> {
    await fetch(`${this.baseUrl}/leaderboard`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "score", player, score }),
    });
  }

  async getLeaderboard(): Promise<{ player: string; score: number }[]> {
    const res = await fetch(`${this.baseUrl}/leaderboard?action=scores`);
    const data = await res.json();
    return data.scores ?? [];
  }

  async startPlaying(player: string): Promise<void> {
    await fetch(`${this.baseUrl}/leaderboard`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "playing", player }),
    }).catch(() => {});
  }

  async stopPlaying(player: string): Promise<void> {
    await fetch(`${this.baseUrl}/leaderboard`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "stopped", player }),
    }).catch(() => {});
  }
}
