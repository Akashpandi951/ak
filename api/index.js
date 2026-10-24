// server.ts
import express from "express";
import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { Chess } from "chess.js";

// src/game/rules.ts
var UID_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
function generatePublicUID() {
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += UID_CHARS.charAt(Math.floor(Math.random() * UID_CHARS.length));
  }
  return `CV-${result}`;
}
var TTT_WINNING_LINES = [
  [0, 1, 2],
  // rows
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  // cols
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  // diagonals
  [2, 4, 6]
];
function evaluateTTT(board) {
  for (const line of TTT_WINNING_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return {
        winner: board[a],
        winningLine: line,
        isGameOver: true
      };
    }
  }
  const isFull = board.every((cell) => cell !== null);
  if (isFull) {
    return {
      winner: "draw",
      winningLine: null,
      isGameOver: true
    };
  }
  return {
    winner: null,
    winningLine: null,
    isGameOver: false
  };
}
function isLegalTTTMove(board, index) {
  if (index < 0 || index > 8) return false;
  if (board[index] !== null) return false;
  const { isGameOver } = evaluateTTT(board);
  return !isGameOver;
}
function getChessState(chess) {
  const fen = chess.fen();
  const history = chess.history();
  const pieceCounts = {
    p: 8,
    r: 2,
    n: 2,
    b: 2,
    q: 1,
    P: 8,
    R: 2,
    N: 2,
    B: 2,
    Q: 1
  };
  const board = chess.board();
  for (const row of board) {
    for (const sq of row) {
      if (sq) {
        const char = sq.color === "w" ? sq.type.toUpperCase() : sq.type.toLowerCase();
        if (pieceCounts[char] !== void 0) {
          pieceCounts[char]--;
        }
      }
    }
  }
  const capturedWhite = [];
  const capturedBlack = [];
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
    capturedBlack
  };
}

// server.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3e3;
var DATA_DIR = process.env.VERCEL ? path.join("/tmp", ".data") : path.join(__dirname, ".data");
var DB_FILE = path.join(DATA_DIR, "db.json");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
var db = {
  users: {},
  friendships: [],
  messages: [],
  invitations: [],
  game_rooms: {},
  match_history: []
};
function saveDb() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save DB:", err);
  }
}
function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 1e3, 64, "sha512").toString("hex");
}
var DEFAULT_BOTS = [
  {
    id: "bot-saraqueen",
    username: "SaraQueen",
    public_uid: "CV-4F8Z1Q9L",
    avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    status_text: "Playing Chess \u2022 2m",
    stats: { chess: { wins: 318, losses: 42, draws: 29, rating: 2420 }, ttt: { wins: 88, losses: 14, draws: 9 } }
  },
  {
    id: "bot-gamingpro",
    username: "GamingPro",
    public_uid: "CV-9X2M4K8P",
    avatar_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    status_text: "Online",
    stats: { chess: { wins: 215, losses: 58, draws: 19, rating: 2110 }, ttt: { wins: 112, losses: 22, draws: 11 } }
  },
  {
    id: "bot-alexr",
    username: "AlexR",
    public_uid: "CV-3N7V5B2Q",
    avatar_url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
    status_text: "In Game \u2022 6m",
    stats: { chess: { wins: 164, losses: 71, draws: 25, rating: 1890 }, ttt: { wins: 64, losses: 29, draws: 8 } }
  },
  {
    id: "bot-priya",
    username: "Priya",
    public_uid: "CV-6H8J2W4Y",
    avatar_url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
    status_text: "Online",
    stats: { chess: { wins: 245, losses: 39, draws: 30, rating: 2280 }, ttt: { wins: 134, losses: 18, draws: 12 } }
  },
  {
    id: "bot-teamchess",
    username: "TeamChess",
    public_uid: "CV-5T9R3C7L",
    avatar_url: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80",
    status_text: "In Lobby \u2022 12m",
    stats: { chess: { wins: 190, losses: 52, draws: 18, rating: 2040 }, ttt: { wins: 77, losses: 20, draws: 6 } }
  },
  {
    id: "bot-magnus",
    username: "Grandmaster_Magnus",
    public_uid: "CV-GM88X99A",
    avatar_url: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80",
    status_text: "Online",
    stats: { chess: { wins: 412, losses: 18, draws: 45, rating: 2850 }, ttt: { wins: 50, losses: 0, draws: 2 } }
  },
  {
    id: "bot-neon",
    username: "NeonKnight",
    public_uid: "CV-NK44A29B",
    avatar_url: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
    status_text: "Online",
    stats: { chess: { wins: 180, losses: 65, draws: 24, rating: 1940 }, ttt: { wins: 95, losses: 30, draws: 15 } }
  }
];
function ensureUserSeededData(userId) {
  if (!db.match_history) db.match_history = [];
  const friendBots = ["bot-saraqueen", "bot-gamingpro", "bot-alexr", "bot-priya", "bot-teamchess"];
  for (const botId of friendBots) {
    if (db.users[botId] && botId !== userId) {
      const exists = db.friendships.some(
        (f) => f.requester_id === userId && f.receiver_id === botId || f.requester_id === botId && f.receiver_id === userId
      );
      if (!exists) {
        db.friendships.push({
          id: `fr-seed-${userId}-${botId}`,
          requester_id: botId,
          receiver_id: userId,
          status: "accepted",
          created_at: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
    }
  }
  const saraConvId = [userId, "bot-saraqueen"].sort().join("_");
  const existingSaraMsgs = db.messages.filter((m) => m.conversation_id === saraConvId);
  if (db.users["bot-saraqueen"] && userId !== "bot-saraqueen" && existingSaraMsgs.length <= 1) {
    db.messages = db.messages.filter((m) => m.conversation_id !== saraConvId);
    const saraHistory = [
      { fromBot: true, text: "Welcome to ChessVerse 3D! Loved our opening sequence in the Sicilian Defense earlier.", minsAgo: 45 },
      { fromBot: false, text: "Thanks Sara! That knight sacrifice on f5 really caught me off guard.", minsAgo: 42 },
      { fromBot: true, text: "It is one of my favorite tactical motifs when the center stays closed.", minsAgo: 39 },
      { fromBot: false, text: "I noticed how quickly your rooks doubled on the d-file right after castling.", minsAgo: 35 },
      { fromBot: true, text: "Control of the open file is everything in the middlegame!", minsAgo: 31 },
      { fromBot: false, text: "Have you tried the new Cyber Luxury 3D board theme yet?", minsAgo: 27 },
      { fromBot: true, text: "Yes! The sculpted pieces and marble reflections look incredible in full screen.", minsAgo: 24 },
      { fromBot: false, text: "Agreed, switching between 3D and 2D Staunton view mid-game is super smooth.", minsAgo: 20 },
      { fromBot: true, text: "We should also host a 3-player room later tonight with GamingPro.", minsAgo: 16 },
      { fromBot: false, text: "Count me in! Let me warm up with a quick 10-minute rapid game first.", minsAgo: 12 },
      { fromBot: true, text: "Awesome, watch out for the queenside pawn storm this time!", minsAgo: 9 },
      { fromBot: false, text: "My bishop pair is ready for it.", minsAgo: 6 },
      { fromBot: true, text: "Hey! Ready for a 3D Chess match?", minsAgo: 2 }
    ];
    saraHistory.forEach((item, idx) => {
      db.messages.push({
        id: `msg-seed-${userId}-bot-saraqueen-${idx}`,
        conversation_id: saraConvId,
        sender_id: item.fromBot ? "bot-saraqueen" : userId,
        receiver_id: item.fromBot ? userId : "bot-saraqueen",
        content: item.text,
        created_at: new Date(Date.now() - item.minsAgo * 6e4).toISOString(),
        read: idx < saraHistory.length - 1
      });
    });
  }
  const starterChats = [
    { botId: "bot-gamingpro", text: "Great game earlier! Let us rematch soon.", minsAgo: 8 },
    { botId: "bot-priya", text: "Nice move on the queenside attack!", minsAgo: 12 },
    { botId: "bot-teamchess", text: "Invite to play chess whenever you are free!", minsAgo: 15 }
  ];
  for (const sc of starterChats) {
    if (db.users[sc.botId] && sc.botId !== userId) {
      const convId = [userId, sc.botId].sort().join("_");
      const hasConv = db.messages.some((m) => m.conversation_id === convId);
      if (!hasConv) {
        db.messages.push({
          id: `msg-seed-${userId}-${sc.botId}`,
          conversation_id: convId,
          sender_id: sc.botId,
          receiver_id: userId,
          content: sc.text,
          created_at: new Date(Date.now() - sc.minsAgo * 6e4).toISOString(),
          read: false
        });
      }
    }
  }
  const userHistory = db.match_history.filter((m) => m.user_id === userId);
  if (userHistory.length === 0) {
    db.match_history.push(
      {
        id: `mh-1-${userId}`,
        user_id: userId,
        opponent_name: "SaraQueen",
        opponent_avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
        game_type: "chess",
        result: "Won",
        time_ago: "2h",
        created_at: new Date(Date.now() - 2 * 36e5).toISOString()
      },
      {
        id: `mh-2-${userId}`,
        user_id: userId,
        opponent_name: "GamingPro",
        opponent_avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
        game_type: "ttt",
        result: "Draw",
        time_ago: "4h",
        created_at: new Date(Date.now() - 4 * 36e5).toISOString()
      },
      {
        id: `mh-3-${userId}`,
        user_id: userId,
        opponent_name: "AlexR",
        opponent_avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
        game_type: "chess",
        result: "Won",
        time_ago: "1d",
        created_at: new Date(Date.now() - 24 * 36e5).toISOString()
      }
    );
  }
}
function loadDb() {
  if (fs.existsSync(DB_FILE)) {
    try {
      const content = fs.readFileSync(DB_FILE, "utf-8");
      db = JSON.parse(content);
      if (!db.match_history) db.match_history = [];
    } catch (err) {
      console.error("Error reading DB, re-seeding...", err);
    }
  }
  for (const bot of DEFAULT_BOTS) {
    if (!db.users[bot.id]) {
      const salt = crypto.randomBytes(16).toString("hex");
      const password_hash = hashPassword("chessverse123", salt);
      db.users[bot.id] = {
        id: bot.id,
        username: bot.username,
        username_normalized: bot.username.toLowerCase(),
        public_uid: bot.public_uid,
        password_hash,
        salt,
        avatar_url: bot.avatar_url,
        status_text: bot.status_text,
        created_at: (/* @__PURE__ */ new Date()).toISOString(),
        stats: bot.stats,
        privacy_settings: { show_online: true, allow_invites: true }
      };
    } else {
      db.users[bot.id].status_text = bot.status_text;
      db.users[bot.id].avatar_url = bot.avatar_url;
    }
  }
  for (const user of Object.values(db.users)) {
    if (!user.id.startsWith("bot-") || user.id === "bot-magnus") {
      ensureUserSeededData(user.id);
    }
  }
  saveDb();
}
loadDb();
var sessions = {};
function createSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  sessions[token] = { userId, createdAt: Date.now() };
  return token;
}
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized: missing token" });
    return;
  }
  const token = authHeader.split(" ")[1];
  const session = sessions[token];
  if (!session || !db.users[session.userId]) {
    res.status(401).json({ error: "Unauthorized: invalid or expired session" });
    return;
  }
  req.user = db.users[session.userId];
  next();
}
function isUserOnline(userId) {
  if (userId.startsWith("bot-")) return true;
  return activeSockets.has(userId);
}
var app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
    return;
  }
  next();
});
var httpServer = createServer(app);
var wss = new WebSocketServer({ server: httpServer, path: "/ws" });
var activeSockets = /* @__PURE__ */ new Map();
var roomSubscriptions = /* @__PURE__ */ new Map();
function getRoomParticipants(room) {
  const set = /* @__PURE__ */ new Set();
  if (room.player_one_id) set.add(room.player_one_id);
  if (room.player_two_id) set.add(room.player_two_id);
  if (room.player_three_id) set.add(room.player_three_id);
  if (Array.isArray(room.participants)) {
    for (const pid of room.participants) {
      if (pid) set.add(pid);
    }
  }
  return Array.from(set);
}
function isAuthorizedInRoom(room, userId) {
  return getRoomParticipants(room).includes(userId);
}
function formatParticipantUser(userId, role) {
  if (!userId) return null;
  if (userId === "ai-opponent") {
    const bot = db.users["bot-saraqueen"];
    return {
      id: "ai-opponent",
      username: bot?.username || "SaraQueen (AI)",
      avatar_url: bot?.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
      public_uid: bot?.public_uid || "CV-4F8Z1Q9L",
      role: role || "AI"
    };
  }
  const u = db.users[userId];
  if (!u) return null;
  return {
    id: u.id,
    username: u.username,
    avatar_url: u.avatar_url,
    public_uid: u.public_uid,
    role
  };
}
function getRoomPlayersPayload(room) {
  const p1 = formatParticipantUser(room.player_one_id, room.player_one_symbol);
  const p2 = formatParticipantUser(room.player_two_id, room.player_two_symbol);
  const p3 = formatParticipantUser(room.player_three_id, room.player_three_symbol || "P3");
  const participants = getRoomParticipants(room).map((uid, idx) => formatParticipantUser(uid, `P${idx + 1}`)).filter((p) => p !== null);
  return {
    playerOne: p1,
    playerTwo: p2,
    playerThree: p3,
    participants
  };
}
function sendToUser(userId, event, payload) {
  const sockets = activeSockets.get(userId);
  let delivered = false;
  if (sockets) {
    const msg = JSON.stringify({ type: event, ...payload });
    for (const ws of Array.from(sockets)) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(msg);
          delivered = true;
        } catch (e) {
          console.error(`Error sending ${event} to user ${userId}:`, e);
        }
      } else if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
        sockets.delete(ws);
      }
    }
    if (sockets.size === 0) {
      activeSockets.delete(userId);
    }
  }
  return delivered;
}
function broadcastToRoom(room, event, payload) {
  const msg = JSON.stringify({ type: event, ...payload });
  const deliveredSockets = /* @__PURE__ */ new Set();
  const roomSubs = roomSubscriptions.get(room.id);
  if (roomSubs) {
    for (const ws of roomSubs) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
        deliveredSockets.add(ws);
      }
    }
  }
  const participants = getRoomParticipants(room);
  for (const participantId of participants) {
    if (participantId === "ai-opponent") continue;
    const userSockets = activeSockets.get(participantId);
    if (userSockets) {
      for (const ws of userSockets) {
        if (ws.readyState === WebSocket.OPEN && !deliveredSockets.has(ws)) {
          ws.send(msg);
          deliveredSockets.add(ws);
        }
      }
    }
  }
}
function broadcastPresence(userId, isOnline) {
  const user = db.users[userId];
  if (!user) return;
  const msg = JSON.stringify({
    type: "presence",
    userId,
    username: user.username,
    isOnline,
    lastSeen: (/* @__PURE__ */ new Date()).toISOString()
  });
  for (const [, sockets] of activeSockets.entries()) {
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      }
    }
  }
}
wss.on("connection", (ws, req) => {
  let authenticatedUserId = null;
  const socketRooms = /* @__PURE__ */ new Set();
  try {
    const reqUrl = req.url || "";
    const urlObj = new URL(reqUrl, "http://localhost");
    const queryToken = urlObj.searchParams.get("token");
    if (queryToken && sessions[queryToken] && db.users[sessions[queryToken].userId]) {
      authenticatedUserId = sessions[queryToken].userId;
      if (!activeSockets.has(authenticatedUserId)) {
        activeSockets.set(authenticatedUserId, /* @__PURE__ */ new Set());
      }
      activeSockets.get(authenticatedUserId).add(ws);
      ws.send(JSON.stringify({ type: "auth_success", userId: authenticatedUserId }));
      broadcastPresence(authenticatedUserId, true);
    }
  } catch (e) {
  }
  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === "auth") {
        const session = sessions[msg.token];
        if (session && db.users[session.userId]) {
          if (authenticatedUserId && authenticatedUserId !== session.userId) {
            const oldSet = activeSockets.get(authenticatedUserId);
            if (oldSet) {
              oldSet.delete(ws);
              if (oldSet.size === 0) activeSockets.delete(authenticatedUserId);
            }
          }
          authenticatedUserId = session.userId;
          if (!activeSockets.has(authenticatedUserId)) {
            activeSockets.set(authenticatedUserId, /* @__PURE__ */ new Set());
          }
          activeSockets.get(authenticatedUserId).add(ws);
          ws.send(JSON.stringify({ type: "auth_success", userId: authenticatedUserId }));
          broadcastPresence(authenticatedUserId, true);
        } else {
          ws.send(JSON.stringify({ type: "auth_error", message: "Invalid token" }));
        }
      } else if (msg.type === "ping") {
        ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
      } else if (msg.type === "join_room" && authenticatedUserId && msg.roomId) {
        const room = db.game_rooms[msg.roomId];
        if (room && isAuthorizedInRoom(room, authenticatedUserId)) {
          if (!roomSubscriptions.has(room.id)) {
            roomSubscriptions.set(room.id, /* @__PURE__ */ new Set());
          }
          roomSubscriptions.get(room.id).add(ws);
          socketRooms.add(room.id);
          ws.send(
            JSON.stringify({
              type: "room_subscribed",
              roomId: room.id,
              room,
              players: getRoomPlayersPayload(room)
            })
          );
        } else {
          ws.send(
            JSON.stringify({
              type: "room_error",
              roomId: msg.roomId,
              error: "Unauthorized room subscription denied"
            })
          );
        }
      } else if (msg.type === "leave_room" && msg.roomId) {
        const subs = roomSubscriptions.get(msg.roomId);
        if (subs) {
          subs.delete(ws);
          if (subs.size === 0) roomSubscriptions.delete(msg.roomId);
        }
        socketRooms.delete(msg.roomId);
      } else if (msg.type === "typing" && authenticatedUserId && msg.receiverId) {
        sendToUser(msg.receiverId, "typing", {
          senderId: authenticatedUserId,
          isTyping: msg.isTyping
        });
      } else if (msg.type === "board_highlight" && authenticatedUserId && msg.roomId) {
        const room = db.game_rooms[msg.roomId];
        if (room && isAuthorizedInRoom(room, authenticatedUserId)) {
          broadcastToRoom(room, "board_highlight", {
            roomId: room.id,
            userId: authenticatedUserId,
            squares: Array.isArray(msg.squares) ? msg.squares : null
          });
        }
      }
    } catch (err) {
      console.error("WS message error:", err);
    }
  });
  ws.on("close", () => {
    for (const roomId of socketRooms) {
      const subs = roomSubscriptions.get(roomId);
      if (subs) {
        subs.delete(ws);
        if (subs.size === 0) roomSubscriptions.delete(roomId);
      }
    }
    socketRooms.clear();
    if (authenticatedUserId) {
      const userSockets = activeSockets.get(authenticatedUserId);
      if (userSockets) {
        userSockets.delete(ws);
        if (userSockets.size === 0) {
          activeSockets.delete(authenticatedUserId);
          broadcastPresence(authenticatedUserId, false);
        }
      }
    }
  });
});
app.post("/api/auth/register", (req, res) => {
  const { username, password } = req.body;
  if (!username || typeof username !== "string" || username.trim().length < 3) {
    res.status(400).json({ error: "Username must be at least 3 characters long." });
    return;
  }
  if (!password || typeof password !== "string" || password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters long." });
    return;
  }
  const normalized = username.trim().toLowerCase();
  const exists = Object.values(db.users).some((u) => u.username_normalized === normalized);
  if (exists) {
    res.status(409).json({ error: "Username is already taken. Please choose another." });
    return;
  }
  let public_uid = generatePublicUID();
  while (Object.values(db.users).some((u) => u.public_uid === public_uid)) {
    public_uid = generatePublicUID();
  }
  const id = `user-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const salt = crypto.randomBytes(16).toString("hex");
  const password_hash = hashPassword(password, salt);
  const avatar_url = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username.trim())}`;
  const newUser = {
    id,
    username: username.trim(),
    username_normalized: normalized,
    public_uid,
    password_hash,
    salt,
    avatar_url,
    created_at: (/* @__PURE__ */ new Date()).toISOString(),
    stats: {
      chess: { wins: 12, losses: 4, draws: 3, rating: 1450 },
      ttt: { wins: 15, losses: 3, draws: 2 }
    },
    privacy_settings: {
      show_online: true,
      allow_invites: true
    }
  };
  db.users[id] = newUser;
  ensureUserSeededData(id);
  saveDb();
  const token = createSession(id);
  const { password_hash: _, salt: __, ...safeUser } = newUser;
  res.status(201).json({ user: safeUser, token });
});
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required." });
    return;
  }
  const normalized = username.trim().toLowerCase();
  const user = Object.values(db.users).find((u) => u.username_normalized === normalized);
  if (!user) {
    res.status(401).json({ error: "Invalid username or password." });
    return;
  }
  const calculatedHash = hashPassword(password, user.salt);
  if (calculatedHash !== user.password_hash) {
    res.status(401).json({ error: "Invalid username or password." });
    return;
  }
  ensureUserSeededData(user.id);
  saveDb();
  const token = createSession(user.id);
  const { password_hash: _, salt: __, ...safeUser } = user;
  res.json({ user: safeUser, token });
});
app.get("/api/auth/me", authMiddleware, (req, res) => {
  const user = req.user;
  ensureUserSeededData(user.id);
  const { password_hash: _, salt: __, ...safeUser } = user;
  res.json({ user: safeUser });
});
app.patch("/api/auth/profile", authMiddleware, (req, res) => {
  const user = req.user;
  const { avatar_url, privacy_settings, new_username, new_password } = req.body;
  if (new_username && typeof new_username === "string") {
    const trimmed = new_username.trim();
    if (trimmed.length < 3) {
      res.status(400).json({ error: "Username must be at least 3 characters." });
      return;
    }
    const norm = trimmed.toLowerCase();
    const conflict = Object.values(db.users).some(
      (u) => u.id !== user.id && u.username_normalized === norm
    );
    if (conflict) {
      res.status(409).json({ error: "That username is already taken." });
      return;
    }
    user.username = trimmed;
    user.username_normalized = norm;
  }
  if (new_password && typeof new_password === "string") {
    if (new_password.length < 6) {
      res.status(400).json({ error: "New password must be at least 6 characters." });
      return;
    }
    user.password_hash = hashPassword(new_password, user.salt);
  }
  if (avatar_url && typeof avatar_url === "string") {
    user.avatar_url = avatar_url;
  }
  if (privacy_settings) {
    user.privacy_settings = { ...user.privacy_settings, ...privacy_settings };
  }
  saveDb();
  const { password_hash: _, salt: __, ...safeUser } = user;
  res.json({ user: safeUser });
});
app.delete("/api/auth/delete", authMiddleware, (req, res) => {
  const user = req.user;
  delete db.users[user.id];
  db.friendships = db.friendships.filter(
    (f) => f.requester_id !== user.id && f.receiver_id !== user.id
  );
  db.invitations = db.invitations.filter(
    (inv) => inv.inviter_id !== user.id && inv.invitee_id !== user.id
  );
  db.messages = db.messages.filter(
    (m) => m.sender_id !== user.id && m.receiver_id !== user.id
  );
  saveDb();
  res.json({ success: true, message: "Account deleted successfully" });
});
app.get("/api/matches/history", authMiddleware, (req, res) => {
  const user = req.user;
  const history = (db.match_history || []).filter((m) => m.user_id === user.id).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 10);
  res.json({ history });
});
app.get("/api/bootstrap", authMiddleware, (req, res) => {
  const user = req.user;
  const userId = user.id;
  ensureUserSeededData(userId);
  const invitations = db.invitations.filter((inv) => inv.invitee_id === userId && inv.status === "pending").map((inv) => {
    const inviter = db.users[inv.inviter_id];
    return {
      ...inv,
      inviter: inviter ? {
        id: inviter.id,
        username: inviter.username,
        public_uid: inviter.public_uid,
        avatar_url: inviter.avatar_url
      } : null
    };
  });
  const friendRecords = db.friendships.filter(
    (f) => (f.requester_id === userId || f.receiver_id === userId) && f.status === "accepted"
  );
  const friends = friendRecords.map((f) => {
    const friendId = f.requester_id === userId ? f.receiver_id : f.requester_id;
    const friendUser = db.users[friendId] || {
      id: friendId,
      username: "Player",
      public_uid: "CV-UNKNOWN",
      avatar_url: "",
      status_text: "Online",
      stats: {
        chess: { wins: 0, losses: 0, draws: 0, rating: 1200 },
        ttt: { wins: 0, losses: 0, draws: 0 }
      }
    };
    return {
      friendshipId: f.id,
      id: friendUser.id,
      username: friendUser.username,
      public_uid: friendUser.public_uid,
      avatar_url: friendUser.avatar_url,
      status_text: friendUser.status_text || "Online",
      stats: friendUser.stats,
      isOnline: isUserOnline(friendUser.id)
    };
  });
  const pendingRequests = db.friendships.filter((f) => f.receiver_id === userId && f.status === "pending").map((f) => {
    const requester = db.users[f.requester_id];
    return {
      friendshipId: f.id,
      requester: requester ? {
        id: requester.id,
        username: requester.username,
        public_uid: requester.public_uid,
        avatar_url: requester.avatar_url
      } : null
    };
  }).filter((r) => r.requester !== null);
  const participantIds = /* @__PURE__ */ new Set();
  for (const msg of db.messages) {
    if (msg.sender_id === userId) participantIds.add(msg.receiver_id);
    if (msg.receiver_id === userId) participantIds.add(msg.sender_id);
  }
  for (const f of db.friendships) {
    if (f.status === "accepted") {
      if (f.requester_id === userId) participantIds.add(f.receiver_id);
      if (f.receiver_id === userId) participantIds.add(f.requester_id);
    }
  }
  const conversations = Array.from(participantIds).map((otherId) => {
    const otherUser = db.users[otherId] || {
      id: otherId,
      username: "User",
      public_uid: "CV-UNKNOWN",
      avatar_url: "",
      status_text: "Online"
    };
    const convId = getConversationId(userId, otherId);
    const convMessages = db.messages.filter((m) => m.conversation_id === convId);
    const lastMessage = convMessages[convMessages.length - 1] || null;
    const unreadCount = convMessages.filter((m) => m.receiver_id === userId && !m.read).length;
    return {
      conversationId: convId,
      contact: {
        id: otherUser.id,
        username: otherUser.username,
        public_uid: otherUser.public_uid,
        avatar_url: otherUser.avatar_url,
        status_text: otherUser.status_text || "Online",
        isOnline: isUserOnline(otherUser.id)
      },
      lastMessage,
      unreadCount
    };
  }).sort((a, b) => {
    const timeA = a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : 0;
    const timeB = b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : 0;
    return timeB - timeA;
  });
  const topChess = Object.values(db.users).map((u) => ({
    id: u.id,
    username: u.username,
    public_uid: u.public_uid,
    avatar_url: u.avatar_url,
    stats: u.stats,
    rating: u.stats.chess.rating,
    wins: u.stats.chess.wins,
    losses: u.stats.chess.losses,
    draws: u.stats.chess.draws,
    isOnline: isUserOnline(u.id)
  })).sort((a, b) => b.rating - a.rating).slice(0, 10);
  const topTTT = Object.values(db.users).map((u) => ({
    id: u.id,
    username: u.username,
    public_uid: u.public_uid,
    avatar_url: u.avatar_url,
    stats: u.stats,
    wins: u.stats.ttt.wins,
    losses: u.stats.ttt.losses,
    draws: u.stats.ttt.draws,
    isOnline: isUserOnline(u.id)
  })).sort((a, b) => b.wins - a.wins).slice(0, 10);
  const history = (db.match_history || []).filter((m) => m.user_id === userId).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 10);
  const { password_hash: _, salt: __, ...safeUser } = user;
  res.json({
    user: safeUser,
    invitations,
    friends,
    pendingRequests,
    conversations,
    leaderboard: { chess: topChess, ttt: topTTT },
    history
  });
});
app.get("/api/users/search", authMiddleware, (req, res) => {
  const query = (req.query.q || "").trim().toLowerCase();
  const currentUserId = req.user.id;
  if (!query) {
    res.json({ users: [] });
    return;
  }
  const results = Object.values(db.users).filter((u) => u.id !== currentUserId).filter(
    (u) => u.username_normalized.includes(query) || u.public_uid.toLowerCase() === query || u.public_uid.toLowerCase().includes(query)
  ).slice(0, 10).map((u) => ({
    id: u.id,
    username: u.username,
    public_uid: u.public_uid,
    avatar_url: u.avatar_url,
    status_text: u.status_text || "Online",
    stats: u.stats,
    isOnline: isUserOnline(u.id)
  }));
  res.json({ users: results });
});
app.get("/api/users/:userId", authMiddleware, (req, res) => {
  const u = db.users[req.params.userId];
  if (!u) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({
    user: {
      id: u.id,
      username: u.username,
      public_uid: u.public_uid,
      avatar_url: u.avatar_url,
      status_text: u.status_text || "Online",
      created_at: u.created_at,
      stats: u.stats,
      isOnline: isUserOnline(u.id)
    }
  });
});
app.get("/api/leaderboard", (_req, res) => {
  const topChess = Object.values(db.users).map((u) => ({
    id: u.id,
    username: u.username,
    public_uid: u.public_uid,
    avatar_url: u.avatar_url,
    stats: u.stats,
    rating: u.stats.chess.rating,
    wins: u.stats.chess.wins,
    losses: u.stats.chess.losses,
    draws: u.stats.chess.draws,
    isOnline: isUserOnline(u.id)
  })).sort((a, b) => b.rating - a.rating).slice(0, 10);
  const topTTT = Object.values(db.users).map((u) => ({
    id: u.id,
    username: u.username,
    public_uid: u.public_uid,
    avatar_url: u.avatar_url,
    stats: u.stats,
    wins: u.stats.ttt.wins,
    losses: u.stats.ttt.losses,
    draws: u.stats.ttt.draws,
    isOnline: isUserOnline(u.id)
  })).sort((a, b) => b.wins - a.wins).slice(0, 10);
  res.json({ chess: topChess, ttt: topTTT });
});
app.get("/api/friends", authMiddleware, (req, res) => {
  const userId = req.user.id;
  const friendRecords = db.friendships.filter(
    (f) => (f.requester_id === userId || f.receiver_id === userId) && f.status === "accepted"
  );
  const friends = friendRecords.map((f) => {
    const friendId = f.requester_id === userId ? f.receiver_id : f.requester_id;
    const friendUser = db.users[friendId] || {
      id: friendId,
      username: "Player",
      public_uid: "CV-UNKNOWN",
      avatar_url: "",
      status_text: "Online",
      stats: { chess: { wins: 0, losses: 0, draws: 0, rating: 1200 }, ttt: { wins: 0, losses: 0, draws: 0 } }
    };
    return {
      friendshipId: f.id,
      id: friendUser.id,
      username: friendUser.username,
      public_uid: friendUser.public_uid,
      avatar_url: friendUser.avatar_url,
      status_text: friendUser.status_text || "Online",
      stats: friendUser.stats,
      isOnline: isUserOnline(friendUser.id)
    };
  });
  const pendingRequests = db.friendships.filter((f) => f.receiver_id === userId && f.status === "pending").map((f) => {
    const requester = db.users[f.requester_id];
    return {
      friendshipId: f.id,
      requester: requester ? {
        id: requester.id,
        username: requester.username,
        public_uid: requester.public_uid,
        avatar_url: requester.avatar_url
      } : null
    };
  }).filter((r) => r.requester !== null);
  res.json({ friends, pendingRequests });
});
app.post("/api/friends/request", authMiddleware, (req, res) => {
  const userId = req.user.id;
  const { targetUserId } = req.body;
  if (!targetUserId || targetUserId === userId) {
    res.status(400).json({ error: "Invalid friend request target." });
    return;
  }
  let resolvedTargetId = targetUserId;
  if (!db.users[resolvedTargetId]) {
    const found = Object.values(db.users).find(
      (u) => u.username_normalized === targetUserId.toLowerCase() || u.public_uid.toLowerCase() === targetUserId.toLowerCase()
    );
    if (found) resolvedTargetId = found.id;
  }
  if (!db.users[resolvedTargetId]) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  const existing = db.friendships.find(
    (f) => f.requester_id === userId && f.receiver_id === resolvedTargetId || f.requester_id === resolvedTargetId && f.receiver_id === userId
  );
  if (existing) {
    if (existing.status === "accepted") {
      res.status(400).json({ error: "You are already friends with this user." });
      return;
    }
    if (existing.status === "pending") {
      res.status(400).json({ error: "A friendship request is already pending." });
      return;
    }
  }
  const friendship = {
    id: `fr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    requester_id: userId,
    receiver_id: resolvedTargetId,
    status: resolvedTargetId.startsWith("bot-") ? "accepted" : "pending",
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.friendships.push(friendship);
  saveDb();
  sendToUser(resolvedTargetId, "friend_request", {
    friendshipId: friendship.id,
    from: req.user
  });
  res.status(201).json({ success: true, friendship });
});
app.post("/api/friends/respond", authMiddleware, (req, res) => {
  const userId = req.user.id;
  const { friendshipId, action } = req.body;
  const fr = db.friendships.find((f) => f.id === friendshipId && f.receiver_id === userId);
  if (!fr) {
    res.status(404).json({ error: "Friend request not found." });
    return;
  }
  if (action === "accept") {
    fr.status = "accepted";
    sendToUser(fr.requester_id, "friend_accepted", {
      user: req.user
    });
  } else {
    fr.status = "declined";
  }
  saveDb();
  res.json({ success: true, status: fr.status });
});
function getConversationId(userId1, userId2) {
  return [userId1, userId2].sort().join("_");
}
app.get("/api/chat/conversations", authMiddleware, (req, res) => {
  const userId = req.user.id;
  const participantIds = /* @__PURE__ */ new Set();
  for (const msg of db.messages) {
    if (msg.sender_id === userId) participantIds.add(msg.receiver_id);
    if (msg.receiver_id === userId) participantIds.add(msg.sender_id);
  }
  for (const f of db.friendships) {
    if (f.status === "accepted") {
      if (f.requester_id === userId) participantIds.add(f.receiver_id);
      if (f.receiver_id === userId) participantIds.add(f.requester_id);
    }
  }
  const conversations = Array.from(participantIds).map((otherId) => {
    const otherUser = db.users[otherId] || {
      id: otherId,
      username: "User",
      public_uid: "CV-UNKNOWN",
      avatar_url: "",
      status_text: "Online"
    };
    const convId = getConversationId(userId, otherId);
    const convMessages = db.messages.filter((m) => m.conversation_id === convId);
    const lastMessage = convMessages[convMessages.length - 1] || null;
    const unreadCount = convMessages.filter((m) => m.receiver_id === userId && !m.read).length;
    return {
      conversationId: convId,
      contact: {
        id: otherUser.id,
        username: otherUser.username,
        public_uid: otherUser.public_uid,
        avatar_url: otherUser.avatar_url,
        status_text: otherUser.status_text || "Online",
        isOnline: isUserOnline(otherUser.id)
      },
      lastMessage,
      unreadCount
    };
  });
  conversations.sort((a, b) => {
    const timeA = a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : 0;
    const timeB = b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : 0;
    return timeB - timeA;
  });
  res.json({ conversations });
});
app.get("/api/chat/messages/:otherUserId", authMiddleware, (req, res) => {
  const userId = req.user.id;
  const otherUserId = req.params.otherUserId;
  const convId = getConversationId(userId, otherUserId);
  for (const m of db.messages) {
    if (m.conversation_id === convId && m.receiver_id === userId) {
      m.read = true;
    }
  }
  saveDb();
  const messages = db.messages.filter((m) => m.conversation_id === convId);
  res.json({ messages });
});
app.post("/api/chat/send", authMiddleware, (req, res) => {
  const user = req.user;
  const userId = user.id;
  const { receiverId, content } = req.body;
  if (!receiverId || !content || !content.trim()) {
    res.status(400).json({ error: "Receiver ID and content are required." });
    return;
  }
  if (content.length > 1e3) {
    res.status(400).json({ error: "Message cannot exceed 1000 characters." });
    return;
  }
  let resolvedReceiverId = receiverId;
  if (!db.users[resolvedReceiverId]) {
    const found = Object.values(db.users).find(
      (u) => u.public_uid.toLowerCase() === String(receiverId).trim().toLowerCase() || u.username_normalized === String(receiverId).trim().toLowerCase()
    );
    if (found) resolvedReceiverId = found.id;
  }
  if (!db.users[resolvedReceiverId]) {
    res.status(404).json({ error: "Recipient user not found." });
    return;
  }
  const convId = getConversationId(userId, resolvedReceiverId);
  const newMsg = {
    id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    conversation_id: convId,
    sender_id: userId,
    receiver_id: resolvedReceiverId,
    content: content.trim(),
    created_at: (/* @__PURE__ */ new Date()).toISOString(),
    read: false
  };
  db.messages.push(newMsg);
  saveDb();
  sendToUser(resolvedReceiverId, "new_message", { message: newMsg });
  sendToUser(userId, "new_message", { message: newMsg });
  res.status(201).json({ message: newMsg });
});
app.get("/api/invitations", authMiddleware, (req, res) => {
  const userId = req.user.id;
  const incoming = db.invitations.filter((inv) => inv.invitee_id === userId && inv.status === "pending").map((inv) => {
    const inviter = db.users[inv.inviter_id];
    return {
      ...inv,
      inviter: inviter ? {
        id: inviter.id,
        username: inviter.username,
        public_uid: inviter.public_uid,
        avatar_url: inviter.avatar_url
      } : null
    };
  });
  res.json({ invitations: incoming });
});
app.post("/api/invitations/send", authMiddleware, (req, res) => {
  const userId = req.user.id;
  const { inviteeId, gameType, maxPlayers } = req.body;
  if (!inviteeId) {
    res.status(400).json({ error: "Invalid invitee." });
    return;
  }
  let resolvedInviteeId = String(inviteeId).trim();
  if (!db.users[resolvedInviteeId]) {
    const found = Object.values(db.users).find(
      (u) => u.public_uid.toLowerCase() === resolvedInviteeId.toLowerCase() || u.username_normalized === resolvedInviteeId.toLowerCase()
    );
    if (found) resolvedInviteeId = found.id;
  }
  if (!db.users[resolvedInviteeId] || resolvedInviteeId === userId) {
    res.status(404).json({ error: "Target player not found or invalid." });
    return;
  }
  const roomMaxPlayers = maxPlayers === 3 ? 3 : 2;
  const prefix = gameType === "ttt" ? "TT-" : "7A";
  const roomCode = `${prefix}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const roomId = `room-${Date.now()}-${roomCode}`;
  let initialGameState = null;
  if (gameType === "chess") {
    const chess = new Chess();
    initialGameState = {
      ...getChessState(chess),
      whiteTime: 600,
      blackTime: 600,
      lastTurnAt: Date.now(),
      lastMove: null
    };
  } else {
    initialGameState = {
      board: Array(9).fill(null),
      winningLine: null,
      isGameOver: false
    };
  }
  const isPureBotInvitee = resolvedInviteeId.startsWith("bot-") && resolvedInviteeId !== "bot-magnus" && !activeSockets.has(resolvedInviteeId);
  const room = {
    id: roomId,
    room_code: roomCode,
    game_type: gameType || "chess",
    mode: isPureBotInvitee ? "ai" : "online",
    max_players: roomMaxPlayers,
    participants: [userId, resolvedInviteeId],
    player_one_id: userId,
    player_two_id: resolvedInviteeId,
    player_three_id: null,
    player_one_symbol: gameType === "chess" ? "w" : "X",
    player_two_symbol: gameType === "chess" ? "b" : "O",
    player_three_symbol: "S",
    current_turn: gameType === "chess" ? "w" : "X",
    game_state: initialGameState,
    state_version: 1,
    winner_id: null,
    status: isPureBotInvitee ? "active" : "waiting",
    move_history: [],
    chat_messages: [],
    created_at: (/* @__PURE__ */ new Date()).toISOString(),
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.game_rooms[roomId] = room;
  const invitation = {
    id: `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    inviter_id: userId,
    invitee_id: resolvedInviteeId,
    game_type: gameType || "chess",
    status: isPureBotInvitee ? "accepted" : "pending",
    room_id: roomId,
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.invitations.push(invitation);
  saveDb();
  if (!isPureBotInvitee) {
    const inviter = db.users[userId];
    const safeInviter = inviter ? {
      id: inviter.id,
      username: inviter.username,
      avatar_url: inviter.avatar_url,
      public_uid: inviter.public_uid
    } : null;
    const delivered = sendToUser(resolvedInviteeId, "game_invitation", {
      invitation: {
        ...invitation,
        inviter: safeInviter
      }
    });
    console.log(`[Invitations] Sent invitation ${invitation.id} to ${resolvedInviteeId}. Live WS delivered: ${delivered}`);
  }
  res.status(201).json({ invitation, room });
});
app.post("/api/invitations/respond", authMiddleware, (req, res) => {
  const userId = req.user.id;
  const { invitationId, action } = req.body;
  const inv = db.invitations.find((i) => i.id === invitationId);
  if (!inv) {
    res.status(404).json({ error: "Invitation not found." });
    return;
  }
  if (inv.invitee_id !== userId) {
    res.status(403).json({ error: "Access denied: This invitation belongs to another player." });
    return;
  }
  const room = db.game_rooms[inv.room_id];
  if (action === "accept") {
    inv.status = "accepted";
    if (room) {
      if (!room.player_two_id || room.player_two_id === userId) {
        room.player_two_id = userId;
      } else if (room.max_players === 3 && !room.player_three_id) {
        room.player_three_id = userId;
      }
      room.participants = getRoomParticipants(room);
      if (!room.participants.includes(userId)) {
        room.participants.push(userId);
      }
      room.status = "active";
      if (room.game_type === "chess" && room.game_state) {
        room.game_state.lastTurnAt = Date.now();
      }
      room.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    }
    const playersPayload = room ? getRoomPlayersPayload(room) : void 0;
    const accepter = db.users[userId];
    const safeAccepter = accepter ? {
      id: accepter.id,
      username: accepter.username,
      avatar_url: accepter.avatar_url,
      public_uid: accepter.public_uid
    } : null;
    sendToUser(inv.inviter_id, "invitation_accepted", {
      invitationId,
      roomId: inv.room_id,
      gameType: inv.game_type,
      accepter: safeAccepter,
      room,
      players: playersPayload
    });
    if (room) {
      broadcastToRoom(room, "game_update", {
        roomId: room.id,
        room,
        players: playersPayload
      });
    }
  } else {
    inv.status = "declined";
    sendToUser(inv.inviter_id, "invitation_declined", {
      invitationId,
      roomId: inv.room_id
    });
  }
  saveDb();
  res.json({ success: true, status: inv.status, roomId: inv.room_id, room });
});
app.post("/api/rooms/create", authMiddleware, (req, res) => {
  const userId = req.user.id;
  const { gameType, mode, maxPlayers } = req.body;
  const roomMaxPlayers = maxPlayers === 3 ? 3 : 2;
  const prefix = gameType === "ttt" ? "TT-" : roomMaxPlayers === 3 ? "3P-" : "7A";
  const roomCode = `${prefix}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const roomId = `room-${Date.now()}-${roomCode}`;
  let initialGameState = null;
  if (gameType === "chess") {
    const chess = new Chess();
    initialGameState = {
      ...getChessState(chess),
      whiteTime: 600,
      blackTime: 600,
      lastTurnAt: Date.now(),
      lastMove: null
    };
  } else {
    initialGameState = {
      board: Array(9).fill(null),
      winningLine: null,
      isGameOver: false
    };
  }
  const initialParticipants = [userId];
  if (mode === "ai") {
    initialParticipants.push("bot-saraqueen");
  }
  const room = {
    id: roomId,
    room_code: roomCode,
    game_type: gameType || "chess",
    mode: mode || "online",
    max_players: roomMaxPlayers,
    participants: initialParticipants,
    player_one_id: userId,
    player_two_id: mode === "ai" ? "bot-saraqueen" : null,
    player_three_id: null,
    player_one_symbol: gameType === "chess" ? "w" : "X",
    player_two_symbol: gameType === "chess" ? "b" : "O",
    player_three_symbol: "S",
    current_turn: gameType === "chess" ? "w" : "X",
    game_state: initialGameState,
    state_version: 1,
    winner_id: null,
    status: mode === "ai" ? "active" : "waiting",
    move_history: [],
    chat_messages: [],
    created_at: (/* @__PURE__ */ new Date()).toISOString(),
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.game_rooms[roomId] = room;
  saveDb();
  res.status(201).json({ room, players: getRoomPlayersPayload(room) });
});
app.post("/api/rooms/join", authMiddleware, (req, res) => {
  const userId = req.user.id;
  const { roomCode } = req.body;
  if (!roomCode) {
    res.status(400).json({ error: "Room code is required." });
    return;
  }
  const cleanCode = String(roomCode).trim().toUpperCase().replace(/^#/, "");
  const room = Object.values(db.game_rooms).find(
    (r) => r.room_code.toUpperCase() === cleanCode || r.id === String(roomCode).trim()
  );
  if (!room) {
    res.status(404).json({ error: "Room not found with code: " + roomCode });
    return;
  }
  const maxAllowed = room.max_players || 2;
  const existingParticipants = getRoomParticipants(room);
  if (!existingParticipants.includes(userId)) {
    if (!room.player_two_id) {
      room.player_two_id = userId;
    } else if (maxAllowed === 3 && !room.player_three_id) {
      room.player_three_id = userId;
    } else if (existingParticipants.length < maxAllowed) {
    } else {
      res.status(403).json({
        error: `Access denied: This ${maxAllowed}-player room is already full.`
      });
      return;
    }
    room.participants = Array.from(/* @__PURE__ */ new Set([...getRoomParticipants(room), userId]));
    if (room.player_one_id && room.player_two_id) {
      room.status = "active";
      if (room.game_type === "chess" && room.game_state) {
        room.game_state.lastTurnAt = Date.now();
      }
    }
    room.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    saveDb();
    const playersPayload = getRoomPlayersPayload(room);
    broadcastToRoom(room, "player_joined", {
      roomId: room.id,
      joinedUser: req.user,
      playerTwo: playersPayload.playerTwo,
      playerThree: playersPayload.playerThree,
      players: playersPayload,
      room
    });
    broadcastToRoom(room, "game_update", {
      roomId: room.id,
      room,
      players: playersPayload
    });
  }
  res.json({ room, players: getRoomPlayersPayload(room) });
});
app.get("/api/rooms/:roomId", authMiddleware, (req, res) => {
  const userId = req.user.id;
  const room = db.game_rooms[req.params.roomId];
  if (!room) {
    res.status(404).json({ error: "Room not found." });
    return;
  }
  if (!isAuthorizedInRoom(room, userId)) {
    res.status(403).json({
      error: "Access denied: You are not an authorized participant of this room."
    });
    return;
  }
  res.json({
    room,
    players: getRoomPlayersPayload(room)
  });
});
app.get("/api/rooms/:roomId/messages", authMiddleware, (req, res) => {
  const userId = req.user.id;
  const room = db.game_rooms[req.params.roomId];
  if (!room) {
    res.status(404).json({ error: "Room not found." });
    return;
  }
  if (!isAuthorizedInRoom(room, userId)) {
    res.status(403).json({
      error: "Access denied: You are not an authorized participant of this room."
    });
    return;
  }
  res.json({
    roomId: room.id,
    messages: room.chat_messages || []
  });
});
app.post("/api/rooms/:roomId/move", authMiddleware, (req, res) => {
  const userId = req.user.id;
  const room = db.game_rooms[req.params.roomId];
  if (!room) {
    res.status(404).json({ error: "Room not found." });
    return;
  }
  if (!isAuthorizedInRoom(room, userId)) {
    res.status(403).json({ error: "Access denied: You are not a participant in this room." });
    return;
  }
  if (room.status === "waiting") {
    res.status(400).json({
      error: "Waiting for opponent to accept the invitation and join the room."
    });
    return;
  }
  if (room.status === "finished") {
    res.status(400).json({ error: "Game is already finished." });
    return;
  }
  const isP1 = room.player_one_id === userId;
  const isP2 = room.player_two_id === userId;
  if (!isP1 && !isP2) {
    res.status(403).json({ error: "Only active board players (Player 1 and Player 2) can make board moves." });
    return;
  }
  const playerSymbol = isP1 ? room.player_one_symbol : room.player_two_symbol;
  if (room.current_turn !== playerSymbol) {
    res.status(400).json({ error: "Not your turn!" });
    return;
  }
  const { move } = req.body;
  if (room.game_type === "ttt") {
    const cellIdx = Number(move);
    const board = [...room.game_state.board];
    if (!isLegalTTTMove(board, cellIdx)) {
      res.status(400).json({ error: "Illegal Tic-Tac-Toe move." });
      return;
    }
    board[cellIdx] = playerSymbol;
    const evaluation = evaluateTTT(board);
    room.game_state = {
      board,
      winningLine: evaluation.winningLine,
      isGameOver: evaluation.isGameOver
    };
    room.state_version++;
    room.move_history.push({
      player_id: userId,
      symbol: playerSymbol,
      cell: cellIdx,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    if (evaluation.isGameOver) {
      room.status = "finished";
      if (evaluation.winner === "draw") {
        room.winner_id = "draw";
        if (db.users[room.player_one_id]) db.users[room.player_one_id].stats.ttt.draws++;
        if (room.player_two_id && db.users[room.player_two_id])
          db.users[room.player_two_id].stats.ttt.draws++;
      } else {
        const winnerId = evaluation.winner === room.player_one_symbol ? room.player_one_id : room.player_two_id;
        const loserId = evaluation.winner === room.player_one_symbol ? room.player_two_id : room.player_one_id;
        room.winner_id = winnerId;
        if (winnerId && db.users[winnerId]) db.users[winnerId].stats.ttt.wins++;
        if (loserId && db.users[loserId]) db.users[loserId].stats.ttt.losses++;
      }
    } else {
      room.current_turn = room.current_turn === "X" ? "O" : "X";
    }
  } else if (room.game_type === "chess") {
    const chess = new Chess(room.game_state.fen);
    try {
      const validMove = chess.move(move);
      if (!validMove) {
        res.status(400).json({ error: "Illegal chess move." });
        return;
      }
      const nowMs = Date.now();
      const prevWhiteTime = typeof room.game_state?.whiteTime === "number" ? room.game_state.whiteTime : 600;
      const prevBlackTime = typeof room.game_state?.blackTime === "number" ? room.game_state.blackTime : 600;
      const elapsedSec = room.game_state?.lastTurnAt ? Math.min(60, Math.max(0, Math.floor((nowMs - room.game_state.lastTurnAt) / 1e3))) : 0;
      const nextWhiteTime = playerSymbol === "w" ? Math.max(0, prevWhiteTime - elapsedSec) : prevWhiteTime;
      const nextBlackTime = playerSymbol === "b" ? Math.max(0, prevBlackTime - elapsedSec) : prevBlackTime;
      const lastMoveInfo = {
        from: validMove.from,
        to: validMove.to,
        piece: validMove.piece,
        color: playerSymbol,
        flags: validMove.flags,
        captured: validMove.captured || null,
        promotion: validMove.promotion || null,
        san: validMove.san,
        timestamp: nowMs
      };
      room.game_state = {
        ...getChessState(chess),
        whiteTime: nextWhiteTime,
        blackTime: nextBlackTime,
        lastTurnAt: nowMs,
        lastMove: lastMoveInfo
      };
      room.state_version++;
      room.move_history.push({
        player_id: userId,
        color: playerSymbol,
        move: validMove.san,
        from: validMove.from,
        to: validMove.to,
        flags: validMove.flags,
        captured: validMove.captured || null,
        promotion: validMove.promotion || null,
        piece: validMove.piece,
        timestamp: new Date(nowMs).toISOString()
      });
      if (room.game_state.isCheckmate) {
        room.status = "finished";
        room.winner_id = userId;
        const loserId = isP1 ? room.player_two_id : room.player_one_id;
        if (db.users[userId]) {
          db.users[userId].stats.chess.wins++;
          db.users[userId].stats.chess.rating += 15;
        }
        if (loserId && db.users[loserId]) {
          db.users[loserId].stats.chess.losses++;
          db.users[loserId].stats.chess.rating = Math.max(
            800,
            db.users[loserId].stats.chess.rating - 15
          );
        }
      } else if (room.game_state.isDraw) {
        room.status = "finished";
        room.winner_id = "draw";
        if (db.users[room.player_one_id]) db.users[room.player_one_id].stats.chess.draws++;
        if (room.player_two_id && db.users[room.player_two_id])
          db.users[room.player_two_id].stats.chess.draws++;
      } else {
        room.current_turn = room.current_turn === "w" ? "b" : "w";
      }
    } catch (e) {
      res.status(400).json({ error: "Illegal move: " + (e.message || "invalid") });
      return;
    }
  }
  room.updated_at = (/* @__PURE__ */ new Date()).toISOString();
  saveDb();
  broadcastToRoom(room, "game_update", {
    roomId: room.id,
    room,
    players: getRoomPlayersPayload(room)
  });
  res.json({ room });
});
app.post("/api/rooms/:roomId/chat", authMiddleware, (req, res) => {
  const user = req.user;
  const room = db.game_rooms[req.params.roomId];
  if (!room) {
    res.status(404).json({ error: "Room not found." });
    return;
  }
  if (!isAuthorizedInRoom(room, user.id)) {
    res.status(403).json({
      error: "Access denied: Only authorized members of this room may send messages."
    });
    return;
  }
  const { content } = req.body;
  if (!content || !content.trim()) {
    res.status(400).json({ error: "Empty message" });
    return;
  }
  if (content.length > 1e3) {
    res.status(400).json({ error: "Message cannot exceed 1000 characters." });
    return;
  }
  const chatMsg = {
    id: `rc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    room_id: room.id,
    sender_id: user.id,
    sender_uid: user.public_uid,
    sender_name: user.username,
    content: content.trim(),
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  room.chat_messages.push(chatMsg);
  room.updated_at = (/* @__PURE__ */ new Date()).toISOString();
  saveDb();
  broadcastToRoom(room, "room_chat_message", {
    roomId: room.id,
    message: chatMsg
  });
  res.status(201).json({ message: chatMsg });
});
app.post("/api/rooms/:roomId/action", authMiddleware, (req, res) => {
  const userId = req.user.id;
  const room = db.game_rooms[req.params.roomId];
  if (!room) {
    res.status(404).json({ error: "Room not found." });
    return;
  }
  if (!isAuthorizedInRoom(room, userId)) {
    res.status(403).json({ error: "Access denied: You are not a participant in this room." });
    return;
  }
  const { action } = req.body;
  const isP1 = room.player_one_id === userId;
  const opponentId = isP1 ? room.player_two_id : room.player_one_id;
  if (action === "resign") {
    room.status = "finished";
    room.winner_id = opponentId;
    if (opponentId && db.users[opponentId]) {
      if (room.game_type === "chess") {
        db.users[opponentId].stats.chess.wins++;
        db.users[opponentId].stats.chess.rating += 15;
      } else {
        db.users[opponentId].stats.ttt.wins++;
      }
    }
    if (db.users[userId]) {
      if (room.game_type === "chess") {
        db.users[userId].stats.chess.losses++;
        db.users[userId].stats.chess.rating = Math.max(
          800,
          db.users[userId].stats.chess.rating - 15
        );
      } else {
        db.users[userId].stats.ttt.losses++;
      }
    }
  } else if (action === "draw") {
    room.status = "finished";
    room.winner_id = "draw";
    if (db.users[userId]) {
      if (room.game_type === "chess") db.users[userId].stats.chess.draws++;
      else db.users[userId].stats.ttt.draws++;
    }
  } else if (action === "rematch") {
    if (room.game_type === "chess") {
      const chess = new Chess();
      room.game_state = {
        ...getChessState(chess),
        whiteTime: 600,
        blackTime: 600,
        lastTurnAt: Date.now(),
        lastMove: null
      };
      room.current_turn = "w";
    } else {
      room.game_state = {
        board: Array(9).fill(null),
        winningLine: null,
        isGameOver: false
      };
      room.current_turn = "X";
    }
    room.status = "active";
    room.winner_id = null;
    room.state_version++;
    room.move_history = [];
  }
  room.updated_at = (/* @__PURE__ */ new Date()).toISOString();
  saveDb();
  broadcastToRoom(room, "game_update", {
    roomId: room.id,
    room,
    action,
    players: getRoomPlayersPayload(room)
  });
  res.json({ room });
});
async function startServer() {
  const isDev = process.env.NODE_ENV !== "production";
  if (isDev) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        watch: {
          ignored: [
            "**/.data/**",
            "**/db.json",
            "**/.snapshots/**",
            "**/.playwright-mcp/**",
            "**/*.log"
          ]
        }
      },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`ChessVerse 3D server running on http://0.0.0.0:${PORT}`);
  });
}
if (!process.env.VERCEL) {
  startServer();
}
function handler(req, res) {
  if (req.url && !req.url.startsWith("/api") && !req.url.startsWith("/ws")) {
    req.url = "/api" + req.url;
  }
  return app(req, res);
}
export {
  app,
  handler as default
};
