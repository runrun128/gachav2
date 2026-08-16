export const TOURNAMENT_BRACKET_SIZES = [4, 8] as const;
export type TournamentBracketSize = (typeof TOURNAMENT_BRACKET_SIZES)[number];

export const TOURNAMENT_CHAMPION_REWARD = 1500;
export const TOURNAMENT_RUNNER_UP_REWARD = 500;
export const TOURNAMENT_PARTICIPATION_REWARD = 100;

// 各試合の自動シミュレーションが「決着つかず」にならないための上限ラウンド数。
// 上限に達した場合は残りHP割合が高い方を勝者とする。
export const TOURNAMENT_MAX_MATCH_ROUNDS = 20;

// ラウンド(試合ブロック)の結果を見せてから次のラウンドの試合を始めるまでの間隔
export const TOURNAMENT_ROUND_INTERMISSION_MS = 4_000;
export const TOURNAMENT_CHARACTER_SELECT_TIMEOUT_MS = 60_000;
