export const COLS = 20;
export const ROWS = 20;

export const CELL_COLORS: Record<number, string> = {
  0: "transparent",
  1: "#00f0f0", // player snake (cyan)
  2: "#ff00aa", // opponent snake (magenta)
  3: "#ffff00", // food (yellow)
  4: "#444444", // wall/obstacle
};

export const HEAD_COLORS: Record<number, string> = {
  1: "#00ffff", // player head (bright cyan)
  2: "#ff44cc", // opponent head (bright magenta)
};

export const INITIAL_SPEED = 150; // ms per tick
export const MIN_SPEED = 60;
export const SPEED_DECREASE = 5; // ms faster per food eaten
export const INITIAL_SNAKE_LENGTH = 3;

export const FOOD_SCORE = 100;
export const KILL_SCORE = 500;
export const SURVIVAL_BONUS_PER_SEC = 10;

export const COMBO_WINDOW = 5000; // ms between foods for combo
export const COMBO_MULTIPLIER = 1.5;

export const OBSTACLE_INTERVAL = 30000; // ms between obstacle spawns
export const MAX_OBSTACLES = 8;

export const POWERUP_TYPES = ["speed", "slow", "ghost", "grow"] as const;
export type PowerUpType = (typeof POWERUP_TYPES)[number];

export const POWERUP_DURATION = 5000; // ms
export const POWERUP_SPAWN_INTERVAL = 15000; // ms

export const DIRECTIONS: Record<string, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export const OPPOSITE: Record<string, string> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};
