import React, { useState, useEffect, useRef } from 'react';
import {
  RotateCcw,
  Bot,
  Users,
  Send,
  MessageSquare,
  Info,
  LogOut,
  Copy,
  Check,
  ArrowLeft,
  Lightbulb,
  Globe,
  Smile,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { UserProfile, GameRoom, RoomChatMessage, RoomParticipantInfo } from '../types/index.ts';
import { api, wsService } from '../services/api.ts';
import {
  TTTBoard,
  evaluateTTT,
  getBestTTTMove,
} from '../game/rules.ts';

interface TicTacToeGameProps {
  currentUser: UserProfile;
  initialRoomId?: string;
  onExit: () => void;
  onNavigateChat?: (userId: string) => void;
}

const LINE_COORDS: Record<string, { x1: string; y1: string; x2: string; y2: string }> = {
  '0,1,2': { x1: '8%', y1: '16.6%', x2: '92%', y2: '16.6%' },
  '3,4,5': { x1: '8%', y1: '50%', x2: '92%', y2: '50%' },
  '6,7,8': { x1: '8%', y1: '83.3%', x2: '92%', y2: '83.3%' },
  '0,3,6': { x1: '16.6%', y1: '8%', x2: '16.6%', y2: '92%' },
  '1,4,7': { x1: '50%', y1: '8%', x2: '50%', y2: '92%' },
  '2,5,8': { x1: '83.3%', y1: '8%', x2: '83.3%', y2: '92%' },
  '0,4,8': { x1: '10%', y1: '10%', x2: '90%', y2: '90%' },
  '2,4,6': { x1: '90%', y1: '10%', x2: '10%', y2: '90%' },
};

export const TicTacToeGame: React.FC<TicTacToeGameProps> = ({
  currentUser,
  initialRoomId,
  onExit,
}) => {
  const [mode, setMode] = useState<'ai' | 'online'>(initialRoomId ? 'online' : 'ai');
  const [aiDifficulty, setAiDifficulty] = useState<'easy' | 'medium' | 'hard'>('hard');
  const [board, setBoard] = useState<TTTBoard>(Array(9).fill(null));
  const [turn, setTurn] = useState<'X' | 'O'>('X');
  const [winner, setWinner] = useState<'X' | 'O' | 'draw' | null>(null);
  const [winningLine, setWinningLine] = useState<number[] | null>(null);
  const [score, setScore] = useState({ p1: 12, p2: 4, draws: 3 });

  const [room, setRoom] = useState<GameRoom | null>(null);
  const [opponent, setOpponent] = useState<any>({
    username: 'Waiting for opponent...',
    avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=opponent',
    public_uid: '---',
  });
  const [participants, setParticipants] = useState<RoomParticipantInfo[]>([]);
  const [roomCodeCopied, setRoomCodeCopied] = useState(false);

  // Clean manual chat state (NO fake placeholder or automatic bot replies)
  const [chatMessages, setChatMessages] = useState<RoomChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [showEmojiRow, setShowEmojiRow] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const prevChatCountRef = useRef<number>(0);

  const appendUniqueMessage = (msg: RoomChatMessage) => {
    setChatMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
  };

  useEffect(() => {
    if (initialRoomId) {
      loadOnlineRoom(initialRoomId);
    }
  }, [initialRoomId]);

  useEffect(() => {
    if (mode !== 'online' || !room?.id) return;

    const activeRoomId = room.id;
    wsService.subscribeRoom(activeRoomId);

    const unsubs = [
      wsService.on('game_update', (data: any) => {
        if (data.roomId === activeRoomId && data.room) {
          syncRoomState(data.room, data.players);
        }
      }),
      wsService.on('room_chat_message', (data: any) => {
        if (data.roomId === activeRoomId && data.message) {
          appendUniqueMessage(data.message);
        }
      }),
      wsService.on('player_joined', (data: any) => {
        if (data.roomId === activeRoomId) {
          if (data.room) {
            syncRoomState(data.room, data.players);
          } else if (data.playerTwo) {
            setOpponent(data.playerTwo);
          }
        }
      }),
      wsService.on('room_subscribed', (data: any) => {
        if (data.roomId === activeRoomId && data.room) {
          syncRoomState(data.room, data.players);
        }
      }),
      wsService.on('reconnected', () => {
        loadOnlineRoom(activeRoomId);
      }),
    ];

    return () => {
      wsService.unsubscribeRoom(activeRoomId);
      unsubs.forEach((unsub) => unsub());
    };
  }, [mode, room?.id]);

  // Scroll ONLY the internal chat container when a new message arrives — NEVER scroll the page viewport
  useEffect(() => {
    if (chatMessages.length > prevChatCountRef.current && chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
    prevChatCountRef.current = chatMessages.length;
  }, [chatMessages]);

  const loadOnlineRoom = async (roomId: string) => {
    try {
      const data = await api.getRoom(roomId);
      setMode('online');
      syncRoomState(data.room, data.players);
      setChatMessages(data.room.chat_messages || []);
    } catch (err: any) {
      setChatError(err.message || 'Failed to load room');
    }
  };

  const syncRoomState = (updatedRoom: GameRoom, playersInfo?: any) => {
    setRoom(updatedRoom);
    if (playersInfo) {
      if (playersInfo.participants) {
        setParticipants(playersInfo.participants);
      }
      const isP1 = updatedRoom.player_one_id === currentUser.id;
      if (isP1 && playersInfo.playerTwo) {
        setOpponent(playersInfo.playerTwo);
      } else if (!isP1 && playersInfo.playerOne) {
        setOpponent(playersInfo.playerOne);
      }
    }

    if (updatedRoom.chat_messages) {
      setChatMessages((prev) => {
        const next = updatedRoom.chat_messages!;
        if (
          prev.length === next.length &&
          prev[prev.length - 1]?.id === next[next.length - 1]?.id
        ) {
          return prev;
        }
        return next;
      });
    }

    if (updatedRoom.game_state) {
      setBoard(updatedRoom.game_state.board || Array(9).fill(null));
      setWinningLine(updatedRoom.game_state.winningLine || null);
    }
    setTurn((updatedRoom.current_turn as 'X' | 'O') || 'X');

    if (updatedRoom.winner_id) {
      if (updatedRoom.winner_id === 'draw') {
        setWinner('draw');
      } else {
        const isP1Winner = updatedRoom.winner_id === updatedRoom.player_one_id;
        const winningSymbol = isP1Winner
          ? updatedRoom.player_one_symbol
          : updatedRoom.player_two_symbol;
        setWinner(winningSymbol as 'X' | 'O');
        if (updatedRoom.winner_id === currentUser.id) {
          confetti({ particleCount: 75, spread: 60, origin: { y: 0.6 } });
        }
      }
    } else {
      setWinner(null);
    }
  };

  const handleCellClick = async (index: number) => {
    if (winner !== null) return;
    if (board[index] !== null) return;

    if (mode === 'ai') {
      if (turn !== 'X') return;

      const newBoard: TTTBoard = [...board];
      newBoard[index] = 'X';
      setBoard(newBoard);

      const evalResult = evaluateTTT(newBoard);
      if (evalResult.isGameOver) {
        setWinner(evalResult.winner);
        setWinningLine(evalResult.winningLine);
        if (evalResult.winner === 'X') {
          confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
          setScore((s) => ({ ...s, p1: s.p1 + 1 }));
        } else if (evalResult.winner === 'draw') {
          setScore((s) => ({ ...s, draws: s.draws + 1 }));
        }
        return;
      }

      setTurn('O');

      setTimeout(() => {
        const aiMove = getBestTTTMove(newBoard, 'O', aiDifficulty);
        if (aiMove !== -1) {
          newBoard[aiMove] = 'O';
          setBoard([...newBoard]);
          const aiEval = evaluateTTT(newBoard);
          if (aiEval.isGameOver) {
            setWinner(aiEval.winner);
            setWinningLine(aiEval.winningLine);
            if (aiEval.winner === 'O') {
              setScore((s) => ({ ...s, p2: s.p2 + 1 }));
            } else if (aiEval.winner === 'draw') {
              setScore((s) => ({ ...s, draws: s.draws + 1 }));
            }
          } else {
            setTurn('X');
          }
        }
      }, 420);
    } else if (mode === 'online' && room) {
      if (room.status === 'waiting') {
        setChatError('Waiting for opponent to accept the invitation and join the room.');
        return;
      }
      const mySymbol =
        room.player_one_id === currentUser.id
          ? room.player_one_symbol
          : room.player_two_symbol;
      if (turn !== mySymbol) return;

      try {
        setChatError(null);
        const res = await api.submitMove(room.id, index);
        syncRoomState(res.room);
      } catch (err: any) {
        setChatError(err.message || 'Illegal move');
      }
    }
  };

  const handleRestart = async () => {
    if (mode === 'ai') {
      setBoard(Array(9).fill(null));
      setTurn('X');
      setWinner(null);
      setWinningLine(null);
    } else if (mode === 'online' && room) {
      try {
        const res = await api.roomAction(room.id, 'rematch');
        syncRoomState(res.room);
      } catch (err: any) {
        setChatError(err.message || 'Failed to rematch');
      }
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isSendingChat) return;

    const text = chatInput.trim();
    setChatInput('');
    setShowEmojiRow(false);
    setChatError(null);

    if (room) {
      setIsSendingChat(true);
      try {
        const res = await api.sendRoomChat(room.id, text);
        appendUniqueMessage(res.message);
      } catch (err: any) {
        setChatError(err.message || 'Failed to send message');
      } finally {
        setIsSendingChat(false);
      }
    } else {
      // Local AI mode: display only the player's own message (NO automatic AI chat replies)
      const myMsg: RoomChatMessage = {
        id: `local-${Date.now()}`,
        sender_id: currentUser.id,
        sender_uid: currentUser.public_uid,
        sender_name: currentUser.username,
        content: text,
        created_at: new Date().toISOString(),
      };
      appendUniqueMessage(myMsg);
    }
  };

  const createOnlineRoom = async (maxPlayers: 2 | 3 = 2) => {
    try {
      const res = await api.createRoom('ttt', 'online', maxPlayers);
      setRoom(res.room);
      setMode('online');
      setChatMessages([]);
      syncRoomState(res.room);
    } catch (err: any) {
      setChatError(err.message || 'Failed to create room');
    }
  };

  const handleCopyRoomCode = () => {
    const code = room?.room_code || 'TT-8F3A2D';
    navigator.clipboard.writeText(code);
    setRoomCodeCopied(true);
    setTimeout(() => setRoomCodeCopied(false), 2000);
  };

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const isMyTurn =
    mode === 'ai'
      ? turn === 'X'
      : room
      ? (room.player_one_id === currentUser.id && turn === room.player_one_symbol) ||
        (room.player_two_id === currentUser.id && turn === room.player_two_symbol)
      : true;

  const laserCoords = winningLine ? LINE_COORDS[winningLine.join(',')] : null;

  return (
    <div className="flex-1 p-3 sm:p-5 pb-24 md:pb-6 max-w-[1440px] mx-auto flex flex-col xl:flex-row gap-5">
      {/* Left/Center Arena Container */}
      <div className="flex-1 rounded-3xl bg-gradient-to-b from-[#0a1124]/95 via-[#070b18] to-[#0c0a20]/95 border border-cyan-500/25 p-4 sm:p-6 shadow-2xl relative overflow-hidden flex flex-col justify-between">
        <div className="absolute -bottom-24 left-1/4 w-96 h-48 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 right-1/4 w-96 h-48 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Arena Top Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800/80 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={onExit}
              aria-label="Back to dashboard"
              className="w-9 h-9 rounded-full bg-slate-900/90 border border-slate-700 hover:border-cyan-400 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600/30 to-purple-600/30 border border-cyan-400/50 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <div className="grid grid-cols-2 gap-0.5 text-[11px] font-black leading-none">
                <span className="text-cyan-400">X</span>
                <span className="text-cyan-400">X</span>
                <span className="text-purple-400">O</span>
                <span className="text-cyan-400">X</span>
              </div>
            </div>

            <div>
              <h2 className="text-lg sm:text-xl font-black text-white leading-tight">
                Tic-Tac-Toe
              </h2>
              <p className="text-xs text-slate-400">Classic game. Endless fun.</p>
            </div>
          </div>

          {/* Right Mode Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                if (!room) createOnlineRoom(2);
                else setMode('online');
              }}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-2 ${
                mode === 'online'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30 border border-cyan-400/40'
                  : 'bg-slate-900/80 text-slate-300 border border-slate-800 hover:border-cyan-500/40'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Play Online</span>
            </button>

            <button
              onClick={() => {
                setMode('ai');
                handleRestart();
              }}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-2 ${
                mode === 'ai'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30 border border-cyan-300/50'
                  : 'bg-slate-900/80 text-slate-300 border border-slate-800 hover:border-cyan-500/40'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>Play vs AI</span>
            </button>

            {mode === 'ai' && (
              <div className="flex bg-slate-950/90 p-1 rounded-full border border-slate-800">
                {(['easy', 'medium', 'hard'] as const).map((diff) => (
                  <button
                    key={diff}
                    onClick={() => setAiDifficulty(diff)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase transition-all ${
                      aiDifficulty === diff
                        ? 'bg-purple-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {diff}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 3-Card Matchup HUD Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 my-4 z-10">
          {/* Player 1 ("You") */}
          <div
            className={`p-3.5 rounded-2xl bg-slate-900/80 border flex items-center justify-between transition-all ${
              turn === 'X' && !winner
                ? 'border-cyan-400/70 shadow-lg shadow-cyan-500/15'
                : 'border-slate-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <img
                src={
                  currentUser.avatar_url ||
                  `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser.username}`
                }
                alt={currentUser.username}
                className="w-12 h-12 rounded-full object-cover border-2 border-cyan-400"
              />
              <div>
                <p className="text-xs font-bold text-slate-200">You ({currentUser.username})</p>
                <span className="text-xl font-black text-cyan-400 drop-shadow-[0_0_8px_#22d3ee]">
                  {mode === 'online' && room?.player_two_id === currentUser.id ? 'O' : 'X'}
                </span>
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>Online • {score.p1} Wins</span>
                </div>
              </div>
            </div>
          </div>

          {/* Center Turn Banner */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-950/80 via-indigo-950/80 to-purple-950/80 border border-cyan-400/50 shadow-lg shadow-cyan-500/15 flex items-center justify-center gap-3">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-lg border ${
                turn === 'X'
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_12px_#22d3ee]'
                  : 'bg-purple-500/20 border-purple-400 text-purple-300 shadow-[0_0_12px_#c084fc]'
              }`}
            >
              {turn}
            </div>
            <div>
              <p className="text-sm sm:text-base font-extrabold text-white">
                {mode === 'online' && room?.status === 'waiting'
                  ? 'Waiting for Player...'
                  : winner === 'draw'
                  ? "It's a Draw!"
                  : winner
                  ? isMyTurn
                    ? 'Opponent Won!'
                    : 'Victory! 🏆'
                  : isMyTurn
                  ? 'Your Turn'
                  : mode === 'ai'
                  ? 'AI Thinking...'
                  : "Opponent's Turn"}
              </p>
              <p className="text-[11px] text-cyan-300/80">
                {mode === 'online' && room?.status === 'waiting'
                  ? `Share Room ID #${room.room_code}`
                  : winner
                  ? 'Click Rematch or Restart below'
                  : 'Place 3 glowing symbols in a row'}
              </p>
            </div>
          </div>

          {/* Player 2 ("AI (Hard)" or Opponent) */}
          <div
            className={`p-3.5 rounded-2xl bg-slate-900/80 border flex items-center justify-end text-right transition-all ${
              turn === 'O' && !winner
                ? 'border-purple-400/70 shadow-lg shadow-purple-500/15'
                : 'border-slate-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <div>
                <p className="text-xs font-bold text-slate-200">
                  {mode === 'ai'
                    ? `AI (${aiDifficulty.charAt(0).toUpperCase() + aiDifficulty.slice(1)})`
                    : opponent?.username || 'Waiting...'}
                </p>
                <span className="text-xl font-black text-purple-400 drop-shadow-[0_0_8px_#c084fc]">
                  {mode === 'online' && room?.player_two_id === currentUser.id ? 'X' : 'O'}
                </span>
                <div className="flex items-center justify-end gap-1.5 text-[10px] text-purple-300">
                  <span>
                    {mode === 'online' && room?.status === 'waiting'
                      ? 'Invited'
                      : `Online • ${score.p2} Wins`}
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                </div>
              </div>
              <img
                src={
                  mode === 'ai'
                    ? 'https://api.dicebear.com/7.x/bottts/svg?seed=cyber-ai'
                    : opponent?.avatar_url ||
                      'https://api.dicebear.com/7.x/bottts/svg?seed=opponent'
                }
                alt="Opponent"
                className="w-12 h-12 rounded-full object-cover border-2 border-purple-400"
              />
            </div>
          </div>
        </div>

        {/* Center 3D Futuristic Board + Flanking Glowing Trophy Pedestals */}
        <div className="relative my-2 flex items-center justify-center gap-6 lg:gap-10 z-10 py-2">
          <div className="hidden lg:flex flex-col items-center">
            <div className="text-5xl font-black text-cyan-400 drop-shadow-[0_0_25px_rgba(34,211,238,0.95)] animate-pulse mb-2 select-none">
              ✕
            </div>
            <div className="w-20 h-24 rounded-t-xl bg-gradient-to-b from-cyan-500/30 via-slate-900 to-slate-950 border-t-2 border-x border-cyan-400/60 shadow-[0_0_30px_rgba(34,211,238,0.3)] flex flex-col items-center justify-end pb-2">
              <div className="w-24 h-3 rounded-full bg-cyan-400/40 blur-[2px]" />
            </div>
          </div>

          <div className="relative p-4 sm:p-5 rounded-[32px] bg-gradient-to-b from-[#131d38] via-[#0b1124] to-[#090d1c] border-2 border-cyan-400/50 shadow-[0_20px_60px_rgba(6,182,212,0.28),inset_0_2px_15px_rgba(255,255,255,0.12)]">
            <div className="absolute -inset-0.5 rounded-[34px] bg-gradient-to-r from-cyan-500/30 via-transparent to-purple-500/30 pointer-events-none blur-sm" />

            <div
              data-testid="ttt-grid"
              style={{
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gridTemplateRows: 'repeat(3, minmax(0, 1fr))',
              }}
              className="relative grid grid-cols-3 grid-rows-3 gap-3 sm:gap-4 w-[276px] h-[276px] sm:w-[344px] sm:h-[344px] aspect-square shrink-0"
            >
              {board.map((cell, idx) => {
                const isWinCell = winningLine?.includes(idx);
                return (
                  <button
                    key={idx}
                    type="button"
                    data-testid={`ttt-cell-${idx}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleCellClick(idx)}
                    disabled={cell !== null || winner !== null}
                    aria-label={`Cell ${idx + 1}, ${cell ? cell : 'empty'}`}
                    className={`relative w-full h-full min-w-0 min-h-0 aspect-square p-0 m-0 box-border rounded-2xl flex items-center justify-center transition-colors duration-200 select-none touch-manipulation group overflow-hidden border-2 ${
                      isWinCell
                        ? 'bg-gradient-to-br from-cyan-900/60 via-indigo-900/70 to-purple-900/60 border-cyan-300 shadow-[0_0_25px_rgba(34,211,238,0.5)]'
                        : cell
                        ? 'bg-[#0c1328]/95 border-cyan-500/30 shadow-inner'
                        : 'bg-[#090e1f]/90 border-slate-800 hover:border-cyan-400/60 hover:bg-[#0e1730] hover:shadow-[0_0_15px_rgba(34,211,238,0.15)]'
                    }`}
                  >
                    <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />

                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
                      {cell === 'X' && (
                        <span className="text-4xl sm:text-6xl leading-none font-black text-cyan-300 drop-shadow-[0_0_22px_rgba(34,211,238,0.95)] animate-in zoom-in-75 duration-200">
                          ✕
                        </span>
                      )}
                      {cell === 'O' && (
                        <span className="text-4xl sm:text-6xl leading-none font-black text-purple-300 drop-shadow-[0_0_22px_rgba(192,132,252,0.95)] animate-in zoom-in-75 duration-200">
                          ◯
                        </span>
                      )}
                      {!cell && !winner && isMyTurn && (
                        <span className="opacity-0 group-hover:opacity-30 text-3xl sm:text-5xl leading-none font-black text-cyan-400 transition-opacity">
                          ✕
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}

              {laserCoords && (
                <svg
                  className="absolute inset-0 w-full h-full pointer-events-none z-20"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <filter id="laserGlow" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="2.5" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  <line
                    x1={laserCoords.x1}
                    y1={laserCoords.y1}
                    x2={laserCoords.x2}
                    y2={laserCoords.y2}
                    stroke="#e879f9"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    filter="url(#laserGlow)"
                  />
                  <line
                    x1={laserCoords.x1}
                    y1={laserCoords.y1}
                    x2={laserCoords.x2}
                    y2={laserCoords.y2}
                    stroke="#ffffff"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </div>
          </div>

          <div className="hidden lg:flex flex-col items-center">
            <div className="text-5xl font-black text-purple-400 drop-shadow-[0_0_25px_rgba(192,132,252,0.95)] animate-pulse mb-2 select-none">
              ◯
            </div>
            <div className="w-20 h-24 rounded-t-xl bg-gradient-to-b from-purple-500/30 via-slate-900 to-slate-950 border-t-2 border-x border-purple-400/60 shadow-[0_0_30px_rgba(192,132,252,0.3)] flex flex-col items-center justify-end pb-2">
              <div className="w-24 h-3 rounded-full bg-purple-400/40 blur-[2px]" />
            </div>
          </div>
        </div>

        {/* Bottom Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800/80 z-10">
          <div className="flex flex-wrap items-center gap-2.5 p-1.5 rounded-2xl bg-slate-950/80 border border-slate-800">
            <button
              onClick={handleRestart}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-cyan-500/30 text-slate-100 text-xs font-bold flex items-center gap-2 transition-all"
            >
              <RotateCcw className="w-4 h-4 text-cyan-400" />
              <span>Restart</span>
            </button>

            <button
              onClick={handleRestart}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-blue-500/30 text-slate-100 text-xs font-bold flex items-center gap-2 transition-all"
            >
              <Users className="w-4 h-4 text-blue-400" />
              <span>Rematch</span>
            </button>

            <button
              onClick={onExit}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-900/70 to-red-900/70 hover:from-rose-600 hover:to-red-600 border border-rose-500/40 text-rose-100 text-xs font-bold flex items-center gap-2 transition-all"
            >
              <LogOut className="w-4 h-4" />
              <span>Exit Room</span>
            </button>
          </div>

          <button
            onClick={() => {
              if (mode === 'ai') createOnlineRoom(2);
              else setMode('ai');
            }}
            className="px-4 py-2 rounded-2xl bg-slate-950/80 border border-cyan-500/25 hover:border-cyan-400 flex items-center gap-3 text-left transition-all"
          >
            <Globe className="w-5 h-5 text-cyan-400" />
            <div>
              <span className="block text-[10px] text-slate-400">Game Mode</span>
              <span className="text-xs font-bold text-white">
                {mode === 'online' ? 'Online Multiplayer' : `AI Mode (${aiDifficulty})`}
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>

      {/* Right Sidebar Column: Game Info + Compact Real-Time Room Chat + Quick Tips */}
      <div className="w-full xl:w-80 flex flex-col gap-4">
        {/* Game Info Card */}
        <div className="p-4 rounded-2xl bg-slate-900/85 border border-cyan-500/20 shadow-xl">
          <div className="flex items-center gap-2 pb-2.5 mb-3 border-b border-slate-800">
            <Info className="w-4 h-4 text-cyan-400" />
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-white">
              Game Info
            </h4>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Game Type</span>
              <span className="font-bold text-white">Tic-Tac-Toe</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Mode</span>
              <span className="font-bold text-cyan-300">
                {mode === 'online'
                  ? `${room?.max_players || 2}-Player Online`
                  : `vs AI (${aiDifficulty})`}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Room ID</span>
              <button
                onClick={handleCopyRoomCode}
                className="font-mono font-bold text-slate-200 hover:text-cyan-300 flex items-center gap-1"
                title="Copy Room ID"
              >
                <span>#{room?.room_code || 'LOCAL-AI'}</span>
                {roomCodeCopied ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3 text-slate-500" />
                )}
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Players</span>
              <span className="font-bold text-white">
                {mode === 'online'
                  ? `${participants.length || 1} / ${room?.max_players || 2}`
                  : '2 / 2'}
              </span>
            </div>
          </div>
        </div>

        {/* Live Chat Card (Compact Spacing, Zero Auto-Replies) */}
        <div className="flex-1 flex flex-col min-h-[260px] p-3.5 rounded-2xl bg-slate-900/85 border border-cyan-500/20 shadow-xl">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-purple-400" />
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-white">
                {room?.max_players === 3 ? '3-Player Room Chat' : 'Room Chat'}
              </h4>
            </div>
            <span className="text-[10px] text-emerald-400 font-semibold">● Live</span>
          </div>

          {chatError && (
            <div className="mb-2 px-2.5 py-1.5 rounded-lg bg-rose-950/70 border border-rose-500/40 text-[11px] text-rose-300 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{chatError}</span>
            </div>
          )}

          <div
            ref={chatContainerRef}
            data-testid="room-chat-messages"
            className="flex-1 overflow-y-auto space-y-1.5 max-h-56 pr-1"
          >
            {chatMessages.length === 0 ? (
              <div className="py-6 text-center text-[11px] text-slate-500">
                No messages yet. Send a message to chat with room participants!
              </div>
            ) : (
              chatMessages.map((m) => {
                const isMe = m.sender_id === currentUser.id;
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-1.5 px-1 mb-0.5">
                      <span className="text-[10px] font-bold text-slate-300">
                        {m.sender_name}
                      </span>
                      {m.sender_uid && (
                        <span className="text-[9px] font-mono text-cyan-400">
                          {m.sender_uid}
                        </span>
                      )}
                      <span className="text-[9px] text-slate-500">
                        {formatTime(m.created_at)}
                      </span>
                    </div>
                    <div
                      className={`px-2.5 py-1.5 rounded-xl text-xs leading-snug max-w-[88%] break-words ${
                        isMe
                          ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-tr-none'
                          : 'bg-slate-800/95 text-slate-100 border border-slate-700 rounded-tl-none'
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          {showEmojiRow && (
            <div className="flex gap-1.5 py-1 px-2 bg-slate-950 rounded-xl border border-slate-800 mt-1.5">
              {['😊', '🔥', '👍', '👑', '🎉', '💯'].map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => setChatInput((p) => p + em)}
                  className="hover:scale-125 transition-transform text-sm"
                >
                  {em}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleSendChat} className="mt-2 flex items-center gap-1.5">
            <div className="relative flex-1">
              <input
                type="text"
                data-testid="room-chat-input"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type a message..."
                className="w-full h-9 pl-3 pr-8 bg-slate-950 border border-slate-800 rounded-full text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
              />
              <button
                type="button"
                onClick={() => setShowEmojiRow(!showEmojiRow)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-300"
              >
                <Smile className="w-4 h-4" />
              </button>
            </div>
            <button
              type="submit"
              data-testid="room-chat-send"
              disabled={!chatInput.trim() || isSendingChat}
              aria-label="Send chat message"
              className="w-9 h-9 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white flex items-center justify-center hover:brightness-110 shadow-md disabled:opacity-40"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>

        {/* Quick Tips Card */}
        <div className="p-3.5 rounded-2xl bg-slate-900/85 border border-cyan-500/20 shadow-xl space-y-2">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-white">
              Quick Tips
            </h4>
          </div>
          <ul className="space-y-1 text-xs text-slate-300">
            <li className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span>Get 3 in a row to win</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span>Real-time synchronized multiplayer & chat</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
