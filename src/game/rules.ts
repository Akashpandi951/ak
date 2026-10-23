/**
 * ChessVerse 3D - Authoritative Game Rules & Logic Engine
 */
import { Chess, Square } from 'chess.js';

// Public UID Generator: CV-XXXXXXXX (8 uppercase alphanumeric characters)
const UID_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // base32 without ambiguous 0/O, 1/I

export function generatePublicUID(): string {
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += UID_CHARS.charAt(Math.floor(Math.random() * UID_CHARS.length));
  }
  return `CV-${result}`;
}

export function isValidUID(uid: string): boolean {
  return /^CV-[2-9A-HJ-NP-Z]{8}$/.test(uid);
}

// ----------------------------------------------------
// TIC-TAC-TOE (O-L-X) ENGINE
// ----------------------------------------------------
export type TTTCell = 'X' | 'O' | null;
export type TTTBoard = TTTCell[];

export const TTT_WINNING_LINES = [
  [0, 1, 2], // rows
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6], // cols
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8], // diagonals
  [2, 4, 6],
];

export interface TTTGameResult {
  winner: 'X' | 'O' | 'draw' | null;
  winningLine: number[] | null;
  isGameOver: boolean;
}

export function evaluateTTT(board: TTTBoard): TTTGameResult {
  for (const line of TTT_WINNING_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return {
        winner: board[a],
        winningLine: line,
        isGameOver: true,
      };
    }
  }

  const isFull = board.every((cell) => cell !== null);
  if (isFull) {
    return {
      winner: 'draw',
      winningLine: null,
      isGameOver: true,
    };
  }

  return {
    winner: null,
    winningLine: null,
    isGameOver: false,
  };
}

export function isLegalTTTMove(board: TTTBoard, index: number): boolean {
  if (index < 0 || index > 8) return false;
  if (board[index] !== null) return false;
  const { isGameOver } = evaluateTTT(board);
  return !isGameOver;
}

// Minimax AI for Tic-Tac-Toe
function minimax(
  board: TTTBoard,
  depth: number,
  isMaximizing: boolean,
  aiSymbol: 'X' | 'O',
  humanSymbol: 'X' | 'O'
): number {
  const result = evaluateTTT(board);
  if (result.winner === aiSymbol) return 10 - depth;
  if (result.winner === humanSymbol) return depth - 10;
  if (result.winner === 'draw') return 0;

  if (isMaximizing) {
    let bestScore = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === null) {
        board[i] = aiSymbol;
        const score = minimax(board, depth + 1, false, aiSymbol, humanSymbol);
        board[i] = null;
        bestScore = Math.max(score, bestScore);
      }
    }
    return bestScore;
  } else {
    let bestScore = Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === null) {
        board[i] = humanSymbol;
        const score = minimax(board, depth + 1, true, aiSymbol, humanSymbol);
        board[i] = null;
        bestScore = Math.min(score, bestScore);
      }
    }
    return bestScore;
  }
}

export function getBestTTTMove(
  board: TTTBoard,
  aiSymbol: 'X' | 'O',
  difficulty: 'easy' | 'medium' | 'hard' = 'hard'
): number {
  const availableMoves: number[] = [];
  board.forEach((cell, idx) => {
    if (cell === null) availableMoves.push(idx);
  });

  if (availableMoves.length === 0) return -1;

  // Easy: mostly random
  if (difficulty === 'easy') {
    return availableMoves[Math.floor(Math.random() * availableMoves.length)];
  }

  // Medium: 50% minimax, 50% random
  if (difficulty === 'medium' && Math.random() < 0.4) {
    return availableMoves[Math.floor(Math.random() * availableMoves.length)];
  }

  // Hard: Perfect minimax
  const humanSymbol = aiSymbol === 'X' ? 'O' : 'X';
  let bestScore = -Infinity;
  let bestMove = availableMoves[0];

  for (const move of availableMoves) {
    board[move] = aiSymbol;
    const score = minimax(board, 0, false, aiSymbol, humanSymbol);
    board[move] = null;
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
}

// ----------------------------------------------------
// CHESS ENGINE UTILITIES
// ----------------------------------------------------
export interface ChessGameState {
  fen: string;
  turn: 'w' | 'b';
  isCheck: boolean;
  isCheckmate: boolean;
  isDraw: boolean;
  isStalemate: boolean;
  isThreefoldRepetition: boolean;
  isInsufficientMaterial: boolean;
  history: string[];
  capturedWhite: string[];
  capturedBlack: string[];
}

export function getChessState(chess: Chess): ChessGameState {
  const fen = chess.fen();
  const history = chess.history();

  // Calculate captured pieces
  const pieceCounts: Record<string, number> = {
    p: 8, r: 2, n: 2, b: 2, q: 1,
    P: 8, R: 2, N: 2, B: 2, Q: 1,
  };

  const board = chess.board();
  for (const row of board) {
    for (const sq of row) {
      if (sq) {
        const char = sq.color === 'w' ? sq.type.toUpperCase() : sq.type.toLowerCase();
        if (pieceCounts[char] !== undefined) {
          pieceCounts[char]--;
        }
      }
    }
  }

  const capturedWhite: string[] = []; // pieces lost by white
  const capturedBlack: string[] = []; // pieces lost by black

  for (const [piece, count] of Object.entries(pieceCounts)) {
    for (let i = 0; i < count; i++) {
      if (piece === piece.toUpperCase()) {
        capturedWhite.push(piece.toLowerCase());
      } else {
        capturedBlack.push(piece);
      }
    }
  }

  return {
    fen,
    turn: chess.turn(),
    isCheck: chess.isCheck(),
    isCheckmate: chess.isGameOver() && chess.isCheckmate(),
    isDraw: chess.isGameOver() && !chess.isCheckmate(),
    isStalemate: chess.isStalemate(),
    isThreefoldRepetition: chess.isThreefoldRepetition(),
    isInsufficientMaterial: chess.isInsufficientMaterial(),
    history,
    capturedWhite,
    capturedBlack,
  };
}

// Simple heuristic AI for chess
const PIECE_VALUES: Record<string, number> = {
  p: 10,
  n: 30,
  b: 30,
  r: 50,
  q: 90,
  k: 1000,
};

export function getBestChessMove(
  chess: Chess,
  difficulty: 'easy' | 'medium' | 'hard' = 'medium'
): string | null {
  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) return null;

  if (difficulty === 'easy') {
    // Random move
    const randomMove = moves[Math.floor(Math.random() * moves.length)];
    return randomMove.san;
  }

  // Medium / Hard: evaluate 1-ply or 2-ply with capture preference and center control
  let bestScore = -Infinity;
  let bestMove = moves[0];

  for (const move of moves) {
    let score = 0;
    // Captures
    if (move.captured) {
      score += (PIECE_VALUES[move.captured] || 10) * 10;
    }
    // Promotions
    if (move.promotion) {
      score += 80;
    }
    // Center control (d4, e4, d5, e5)
    if (['d4', 'e4', 'd5', 'e5'].includes(move.to)) {
      score += 5;
    }
    // Checks
    if (move.san.includes('+') || move.san.includes('#')) {
      score += 15;
    }

    if (difficulty === 'hard') {
      // Simulate opponent response
      chess.move(move);
      if (chess.isCheckmate()) {
        score += 10000;
      }
      chess.undo();
    }

    score += Math.random() * 2; // slight tie-breaking variety

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove.san;
}
