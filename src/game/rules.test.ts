import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import {
  generatePublicUID,
  isValidUID,
  evaluateTTT,
  isLegalTTTMove,
  getBestTTTMove,
  getChessState,
  getBestChessMove,
  TTTBoard,
} from './rules.ts';

test('UID generator produces valid CV- format with 8 chars', () => {
  for (let i = 0; i < 20; i++) {
    const uid = generatePublicUID();
    assert.match(uid, /^CV-[2-9A-HJ-NP-Z]{8}$/);
    assert.equal(isValidUID(uid), true);
  }
  assert.equal(isValidUID('invalid'), false);
  assert.equal(isValidUID('CV-1234'), false);
  assert.equal(isValidUID('CV-12345678'), false); // contains '1' which is excluded
});

test('Tic-Tac-Toe correctly detects horizontal win', () => {
  const board: TTTBoard = ['X', 'X', 'X', null, 'O', null, 'O', null, null];
  const result = evaluateTTT(board);
  assert.equal(result.winner, 'X');
  assert.deepEqual(result.winningLine, [0, 1, 2]);
  assert.equal(result.isGameOver, true);
});

test('Tic-Tac-Toe correctly detects vertical win', () => {
  const board: TTTBoard = ['O', 'X', null, 'O', 'X', null, 'O', null, null];
  const result = evaluateTTT(board);
  assert.equal(result.winner, 'O');
  assert.deepEqual(result.winningLine, [0, 3, 6]);
  assert.equal(result.isGameOver, true);
});

test('Tic-Tac-Toe correctly detects diagonal win', () => {
  const board: TTTBoard = ['X', 'O', null, 'O', 'X', null, null, null, 'X'];
  const result = evaluateTTT(board);
  assert.equal(result.winner, 'X');
  assert.deepEqual(result.winningLine, [0, 4, 8]);
  assert.equal(result.isGameOver, true);
});

test('Tic-Tac-Toe detects draw condition', () => {
  const board: TTTBoard = [
    'X', 'O', 'X',
    'X', 'O', 'O',
    'O', 'X', 'X'
  ];
  const result = evaluateTTT(board);
  assert.equal(result.winner, 'draw');
  assert.equal(result.winningLine, null);
  assert.equal(result.isGameOver, true);
});

test('Tic-Tac-Toe move legality check', () => {
  const board: TTTBoard = ['X', null, null, null, null, null, null, null, null];
  assert.equal(isLegalTTTMove(board, 0), false); // already occupied
  assert.equal(isLegalTTTMove(board, 1), true);  // empty cell
  assert.equal(isLegalTTTMove(board, 9), false); // out of range
});

test('Tic-Tac-Toe AI blocks immediate opponent win or takes winning move', () => {
  // O needs to win at index 2
  const board1: TTTBoard = ['O', 'O', null, 'X', 'X', null, null, null, null];
  const move1 = getBestTTTMove(board1, 'O', 'hard');
  assert.equal(move1, 2);

  // X is about to win at index 2, O should block it
  const board2: TTTBoard = ['X', 'X', null, null, 'O', null, null, null, null];
  const move2 = getBestTTTMove(board2, 'O', 'hard');
  assert.equal(move2, 2);
});

test('Chess engine initializes correctly and evaluates game state', () => {
  const chess = new Chess();
  const state = getChessState(chess);
  assert.equal(state.turn, 'w');
  assert.equal(state.isCheck, false);
  assert.equal(state.isCheckmate, false);
  assert.equal(state.isDraw, false);
  assert.equal(state.history.length, 0);

  // Perform Fool's Mate
  chess.move('f3');
  chess.move('e5');
  chess.move('g4');
  chess.move('Qh4#');

  const mateState = getChessState(chess);
  assert.equal(mateState.isCheck, true);
  assert.equal(mateState.isCheckmate, true);
});

test('Chess AI returns legal move', () => {
  const chess = new Chess();
  const move = getBestChessMove(chess, 'medium');
  assert.ok(move !== null);
  const legalMoves = chess.moves();
  assert.ok(legalMoves.includes(move!));
});

test('Chess rules enforce castling, en passant, promotion, captured pieces, and reject illegal moves', () => {
  const chess = new Chess();

  // Reject moving opponent's piece or illegal square jump
  assert.throws(() => chess.move({ from: 'e7', to: 'e5' }));
  assert.throws(() => chess.move({ from: 'e2', to: 'e5' }));

  // Kingside castling sequence + capture
  chess.move('e4');
  chess.move('e5');
  chess.move('Nf3');
  chess.move('Nc6');
  chess.move('Bc4');
  chess.move('Bc5');
  const castleMove = chess.move('O-O');
  assert.ok(castleMove);
  assert.ok(castleMove.flags.includes('k'));

  // En passant test
  const epChess = new Chess('rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3');
  const epMove = epChess.move({ from: 'e5', to: 'f6' });
  assert.ok(epMove);
  assert.ok(epMove.flags.includes('e'));
  const epState = getChessState(epChess);
  assert.equal(epState.capturedBlack.includes('p'), true);

  // Pawn promotion test
  const promoChess = new Chess('8/P7/8/8/8/8/7k/4K3 w - - 0 1');
  const promoMove = promoChess.move({ from: 'a7', to: 'a8', promotion: 'q' });
  assert.ok(promoMove);
  assert.equal(promoMove.promotion, 'q');
});

