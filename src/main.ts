import { PeerConnection } from "./network/PeerConnection";
import { LeaderboardClient } from "./network/LeaderboardClient";
import { Message } from "./network/Protocol";
import { MusicEngine } from "./audio/MusicEngine";
import { LobbyScreen } from "./ui/LobbyScreen";
import { GameScreen } from "./ui/GameScreen";
import { GameOverScreen } from "./ui/GameOverScreen";

const app = document.getElementById("app")!;
const lobbyMusic = new MusicEngine();
const leaderboard = new LeaderboardClient();
let lobbyMusicStarted = false;

function ensureLobbyMusic(): void {
  if (lobbyMusicStarted) return;
  lobbyMusicStarted = true;
  const muted = localStorage.getItem("snakey-muted") === "true";
  lobbyMusic.muted = muted;
  lobbyMusic.setBpm(90);
  lobbyMusic.start();
}

let lobby: LobbyScreen | null = null;
let gameScreen: GameScreen | null = null;
let gameOverScreen: GameOverScreen | null = null;
let peer: PeerConnection | null = null;
let disconnectTimer: ReturnType<typeof setTimeout> | null = null;
let currentPlayer = "default";
let currentDifficulty = "normal";
let opponentName = "";

function showLobby(): void {
  cleanup();
  lobby = new LobbyScreen(app, {
    onSolo: handleSolo,
    onChallenge: handleChallenge,
    onCancelChallenge: () => {
      peer?.destroy();
      peer = null;
      lobby?.setStatus("");
    },
    onAcceptChallenge: handleAcceptChallenge,
  });
}

function handleSolo(): void {
  ensureLobbyMusic();
  opponentName = "";
  startGame();
}

async function handleChallenge(): Promise<void> {
  ensureLobbyMusic();
  currentPlayer = lobby?.selectedPlayer ?? "default";

  peer = new PeerConnection();
  peer.setHandlers({
    onMessage: handleMessage,
    onStatus: (s) => lobby?.setStatus(s),
    onDisconnect: handleDisconnect,
  });

  try {
    const peerId = await peer.initPeer();
    lobby?.setStatus("Waiting for opponent...");
    await leaderboard.postChallenge(currentPlayer, peerId);
  } catch {
    lobby?.setStatus("Failed to create challenge. Try again.");
    lobby?.cancelWaiting();
  }
}

async function handleAcceptChallenge(opponent: string): Promise<void> {
  ensureLobbyMusic();
  currentPlayer = lobby?.selectedPlayer ?? "default";
  opponentName = opponent;

  const opponentPeerId = await leaderboard.acceptChallenge(currentPlayer, opponent);
  if (!opponentPeerId) {
    lobby?.setStatus("Challenge expired. Try again.");
    return;
  }

  peer = new PeerConnection();
  peer.setHandlers({
    onMessage: handleMessage,
    onStatus: (s) => lobby?.setStatus(s),
    onDisconnect: handleDisconnect,
  });

  try {
    await peer.connectToPeer(opponentPeerId);
    lobby?.setStatus("Connected!");
    peer.send({ type: "ready", player: currentPlayer });
    startGame();
  } catch (err) {
    const msg =
      err instanceof Error && err.message.includes("timed out")
        ? "Connection timed out. Try again."
        : "Could not connect. Try again.";
    lobby?.setStatus(msg);
    peer?.destroy();
    peer = null;
  }
}

function handleMessage(msg: Message): void {
  switch (msg.type) {
    case "ready":
      if (msg.player) opponentName = msg.player;
      if (!gameScreen) {
        peer?.send({ type: "ready", player: currentPlayer });
        startGame();
      }
      break;
    case "snake":
      if (msg.segments) gameScreen?.updateOpponentSnake(msg.segments);
      if (typeof msg.score === "number") gameScreen?.updateOpponentScore(msg.score);
      break;
    case "death":
      gameScreen?.receiveOpponentDeath();
      break;
    case "gameOver":
      showGameOver(true);
      break;
    case "pause":
      peer?.send({ type: "pauseAccept" });
      gameScreen?.setPaused(true);
      break;
    case "pauseAccept":
      gameScreen?.setPaused(true);
      break;
    case "pauseDeny":
      gameScreen?.setPaused(false);
      break;
    case "unpause":
      gameScreen?.setPaused(false);
      break;
  }
}

function handleDisconnect(): void {
  if (disconnectTimer) return;
  disconnectTimer = setTimeout(() => {
    if (gameScreen) showGameOver(true);
    disconnectTimer = null;
  }, 5000);
}

function startGame(): void {
  const difficulty = lobby?.selectedDifficulty ?? currentDifficulty;
  const player = lobby?.selectedPlayer ?? currentPlayer;
  currentPlayer = player;
  currentDifficulty = difficulty;
  lobbyMusic.stop();
  lobbyMusicStarted = false;
  lobby?.destroy();
  lobby = null;

  gameScreen = new GameScreen(app, difficulty, player, opponentName);
  leaderboard.startPlaying(player);

  gameScreen.onSendSnake = (segments, score) =>
    peer?.send({ type: "snake", segments, score });
  gameScreen.onGameOver = () => {
    leaderboard.stopPlaying(currentPlayer);
    peer?.send({ type: "gameOver" });
    peer?.send({ type: "death" });
    showGameOver(false);
  };
  gameScreen.onPauseRequest = () => peer?.send({ type: "pause" });
  gameScreen.onQuit = () => {
    gameScreen?.saveHighScore();
    const quitScore = gameScreen?.getScore() ?? 0;
    if (quitScore > 0) leaderboard.submitScore(currentPlayer, quitScore);
    leaderboard.stopPlaying(currentPlayer);
    gameScreen?.destroy();
    gameScreen = null;
    peer?.destroy();
    peer = null;
    showLobby();
  };

  gameScreen.startCountdown(() => {
    gameScreen?.startGame();
  });
}

function showGameOver(won: boolean): void {
  const score = gameScreen?.getScore() ?? 0;
  const isNewHighScore = gameScreen?.getIsNewHighScore() ?? false;
  const highScore = gameScreen?.getHighScore() ?? 0;
  if (score > 0) leaderboard.submitScore(currentPlayer, score);
  leaderboard.stopPlaying(currentPlayer);
  gameScreen?.destroy();
  gameScreen = null;

  gameOverScreen = new GameOverScreen(
    app,
    won,
    score,
    () => {
      gameOverScreen?.destroy();
      gameOverScreen = null;
      startGame();
    },
    () => {
      gameOverScreen?.destroy();
      gameOverScreen = null;
      peer?.destroy();
      peer = null;
      ensureLobbyMusic();
      showLobby();
    },
    isNewHighScore,
    highScore,
    opponentName
  );
}

function cleanup(): void {
  lobby?.destroy();
  lobby = null;
  gameScreen?.destroy();
  gameScreen = null;
  gameOverScreen?.destroy();
  gameOverScreen = null;
  peer?.destroy();
  peer = null;
  if (disconnectTimer) {
    clearTimeout(disconnectTimer);
    disconnectTimer = null;
  }
}

// Mute button (created dynamically)
const muteBtn = document.createElement("button");
muteBtn.className = "mute-btn";
muteBtn.setAttribute("aria-label", "Toggle sound");
const isMuted = localStorage.getItem("snakey-muted") === "true";
muteBtn.textContent = isMuted ? "🔇" : "🔊";
document.body.appendChild(muteBtn);

muteBtn.addEventListener("click", () => {
  const muted = localStorage.getItem("snakey-muted") === "true";
  localStorage.setItem("snakey-muted", String(!muted));
  lobbyMusic.muted = !muted;
  muteBtn.textContent = !muted ? "🔇" : "🔊";
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    lobbyMusic.muted = true;
  } else {
    const shouldMute = localStorage.getItem("snakey-muted") === "true";
    lobbyMusic.muted = shouldMute;
  }
});

showLobby();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
