import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Chess, Square } from 'chess.js';
import confetti from 'canvas-confetti';
import {
  Crown,
  RotateCcw,
  Bot,
  Flag,
  Scale,
  Undo2,
  RefreshCw,
  LogOut,
  Send,
  Settings,
  Check,
  Copy,
  ChevronRight,
  ShieldAlert,
  Clock,
  Lightbulb,
  Users,
  PanelRightClose,
  PanelRightOpen,
  Camera,
  Maximize2,
  X,
  AlertCircle,
} from 'lucide-react';
import {
  UserProfile,
  GameRoom,
  RoomChatMessage,
  RoomParticipantInfo,
} from '../types/index.ts';
import { api, wsService } from '../services/api.ts';
import {
  getChessState,
  getBestChessMove,
  ChessGameState,
} from '../game/rules.ts';

interface Chess3DGameProps {
  currentUser: UserProfile;
  initialRoomId?: string;
  onExit: () => void;
  onNavigateChat?: (userId: string) => void;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'];

// Centralized mapping for all 12 custom uploaded chess pieces (transparent PNGs)
const PIECE_IMAGE_MAP: Record<string, string> = {
  wk: '/assets/pieces/white_king.png',
  wq: '/assets/pieces/white_queen.png',
  wr: '/assets/pieces/white_rook.png',
  wb: '/assets/pieces/white_bishop.png',
  wn: '/assets/pieces/white_knight.png',
  wp: '/assets/pieces/white_pawn.png',
  bk: '/assets/pieces/black_king.png',
  bq: '/assets/pieces/black_queen.png',
  br: '/assets/pieces/black_rook.png',
  bb: '/assets/pieces/black_bishop.png',
  bn: '/assets/pieces/black_knight.png',
  bp: '/assets/pieces/black_pawn.png',
};

type BoardTheme = 'classic' | 'cyber' | 'royal';
type GraphicsQuality = 'performance' | 'balanced' | 'quality';

const THEME_PALETTES: Record<
  BoardTheme,
  {
    name: string;
    lightSquare: number;
    darkSquare: number;
    lightHex: string;
    darkHex: string;
    border: number;
    rim: number;
    ivory: number;
    obsidian: number;
  }
> = {
  classic: {
    name: 'Classic Marble',
    lightSquare: 0xf1dec0,
    darkSquare: 0x10151f,
    lightHex: '#e6dec8',
    darkHex: '#2c3347',
    border: 0x0d121d,
    rim: 0xe5b842,
    ivory: 0xf6efe0,
    obsidian: 0x0d1424,
  },
  cyber: {
    name: 'Cyber Luxury',
    lightSquare: 0xeedbc0,
    darkSquare: 0x0f1624,
    lightHex: '#dbeafe',
    darkHex: '#172554',
    border: 0x090d1a,
    rim: 0x00f0ff,
    ivory: 0xf5f0e6,
    obsidian: 0x0b1222,
  },
  royal: {
    name: 'Royal Ebony',
    lightSquare: 0xf3e2c3,
    darkSquare: 0x14161f,
    lightHex: '#f3e5ab',
    darkHex: '#3b2314',
    border: 0x120f16,
    rim: 0xf59e0b,
    ivory: 0xfaf2e1,
    obsidian: 0x101524,
  },
};

// Detect software WebGL (SwiftShader / llvmpipe) for frame-pacing safety
const IS_SOFTWARE_GL = (() => {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
})();

// High-Detail Recognizable Staunton SVG Silhouettes for 2D Mode
const StauntonPieceSVG: React.FC<{ type: string; color: 'w' | 'b' }> = ({ type, color }) => {
  const fill = color === 'w' ? '#f8fafc' : '#0f172a';
  const stroke = color === 'w' ? '#1e293b' : '#38bdf8';
  const accent = color === 'w' ? '#d4af37' : '#22d3ee';

  return (
    <svg
      viewBox="0 0 45 45"
      className="w-4/5 h-4/5 drop-shadow-[0_2px_4px_rgba(0,0,0,0.65)] transition-transform duration-200 select-none pointer-events-none"
    >
      {type === 'p' && (
        <g fill={fill} stroke={stroke} strokeWidth="2" strokeLinecap="round">
          <path d="M 22.5,9 C 19.5,9 17,11.5 17,14.5 C 17,16.8 18.4,18.7 20.4,19.5 C 17.5,21.2 15.5,24.5 15.5,29 L 29.5,29 C 29.5,24.5 27.5,21.2 24.6,19.5 C 26.6,18.7 28,16.8 28,14.5 C 28,11.5 25.5,9 22.5,9 z" />
          <path d="M 12.5,33 L 32.5,33 L 34,37 L 11,37 L 12.5,33 z" />
          <line x1="15" y1="31" x2="30" y2="31" stroke={accent} strokeWidth="1.5" />
        </g>
      )}
      {type === 'r' && (
        <g fill={fill} stroke={stroke} strokeWidth="2" strokeLinejoin="round">
          <path d="M 11,37 L 34,37 L 32.5,33 L 12.5,33 L 11,37 z" />
          <path d="M 14.5,33 L 16,18 L 29,18 L 30.5,33 L 14.5,33 z" />
          <path d="M 13,18 L 32,18 L 32,11 L 28.5,11 L 28.5,14 L 25,14 L 25,11 L 20,11 L 20,14 L 16.5,14 L 16.5,11 L 13,11 L 13,18 z" />
          <line x1="15" y1="31" x2="30" y2="31" stroke={accent} strokeWidth="1.5" />
        </g>
      )}
      {type === 'n' && (
        <g fill={fill} stroke={stroke} strokeWidth="2" strokeLinejoin="round">
          <path d="M 22,10 C 32.5,11 38.5,18 38,37 L 15,37 C 15,28 25,30.5 23,18" />
          <path d="M 24,18 C 24.38,20.91 18.45,25.37 16,27 C 13,29 13.18,31.34 11,31 C 9.958,30.06 12.41,27.96 11,28 C 10,28 11.19,29.23 10,30 C 9,30 5.997,31 6,26 C 6,24 12,14 12,14 C 12,14 13.89,12.1 14,10.5 C 13.27,9.506 13.5,8.5 13.5,7.5 C 14.5,6.5 16.5,10 16.5,10 L 18.5,10 C 18.5,10 19.28,8.008 21,7 C 22,7 22,10 22,10" />
          <circle cx="15.5" cy="14.5" r="1.2" fill={accent} stroke="none" />
        </g>
      )}
      {type === 'b' && (
        <g fill={fill} stroke={stroke} strokeWidth="2" strokeLinejoin="round">
          <circle cx="22.5" cy="8" r="2.2" fill={accent} />
          <path d="M 15,32 C 17.5,34.5 27.5,34.5 30,32 C 30.5,30.5 30,30 30,30 C 30,27.5 27.5,26 27.5,26 C 33,24.5 33.5,14.5 22.5,10.5 C 11.5,14.5 12,24.5 17.5,26 C 17.5,26 15,27.5 15,30 C 15,30 14.5,30.5 15,32 z" />
          <path d="M 11,37 L 34,37 L 32,33 L 13,33 L 11,37 z" />
          <path d="M 20,16 L 25,21 M 25,16 L 20,21" stroke={accent} strokeWidth="1.6" />
        </g>
      )}
      {type === 'q' && (
        <g fill={fill} stroke={stroke} strokeWidth="2" strokeLinejoin="round">
          <path d="M 9,26 C 17.5,24.5 30,24.5 36,26 L 38.5,13.5 L 31,25 L 30.7,10.9 L 25.5,24.5 L 22.5,10 L 19.5,24.5 L 14.3,10.9 L 14,25 L 6.5,13.5 L 9,26 z" />
          <path d="M 9,26 C 9,28 10.5,28 11.5,30 C 12.5,31.5 12.5,31 12,33.5 C 10.5,34.5 11,36 11,36 C 9.5,37.5 11,38.5 11,38.5 C 17.5,39.5 27.5,39.5 34,38.5 C 34,38.5 35.5,37.5 34,36 C 34,36 34.5,34.5 33,33.5 C 32.5,31 32.5,31.5 33.5,30 C 34.5,28 36,28 36,26 C 27.5,24.5 17.5,24.5 9,26 z" />
          <circle cx="6" cy="12" r="1.8" fill={accent} />
          <circle cx="14" cy="9" r="1.8" fill={accent} />
          <circle cx="22.5" cy="8" r="2" fill={accent} />
          <circle cx="31" cy="9" r="1.8" fill={accent} />
          <circle cx="39" cy="12" r="1.8" fill={accent} />
        </g>
      )}
      {type === 'k' && (
        <g fill={fill} stroke={stroke} strokeWidth="2" strokeLinejoin="round">
          <path d="M 22.5,11.63 L 22.5,6" stroke={accent} strokeWidth="2.5" />
          <path d="M 20,8 L 25,8" stroke={accent} strokeWidth="2.5" />
          <path d="M 22.5,25 C 22.5,25 27,17.5 25.5,14.5 C 25.5,14.5 24.5,12 22.5,12 C 20.5,12 19.5,14.5 19.5,14.5 C 18,17.5 22.5,25 22.5,25" />
          <path d="M 11.5,37 C 17,40.5 27,40.5 32.5,37 L 32.5,30 C 32.5,30 41.5,25.5 38.5,19.5 C 34.5,13 25,16 22.5,23.5 L 22.5,27 L 22.5,23.5 C 19,16 9.5,13 6.5,19.5 C 3.5,25.5 11.5,29.5 11.5,29.5 L 11.5,37 z" />
          <line x1="13" y1="33" x2="31" y2="33" stroke={accent} strokeWidth="1.6" />
        </g>
      )}
    </svg>
  );
};

// High-resolution crisp golden coordinate label texture for all 4 sides of the 3D board border
function createCoordTexture(text: string, maxAnisotropy = 4): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 128, 128);
  ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
  ctx.shadowBlur = 4;
  ctx.fillStyle = '#f3d285';
  ctx.font = '700 68px "Inter", "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 64, 66);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

// Procedural veined marble texture matching the reference board's cream-gold light tiles and dark obsidian veined tiles
function createMarbleSquareTexture(
  isLight: boolean,
  seed: number,
  maxAnisotropy = 4
): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Deterministic pseudo-random helper per square
  let s = (seed + 1) * 9301 + 49297;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  if (isLight) {
    // Rich warm cream-gold champagne marble base matching the reference light squares
    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, '#f6e5c4');
    grad.addColorStop(0.5, '#ecd2a4');
    grad.addColorStop(1, '#dfc089');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    // Soft warm mineral clouding
    for (let i = 0; i < 6; i++) {
      const cx = rand() * size;
      const cy = rand() * size;
      const r = 40 + rand() * 80;
      const rg = ctx.createRadialGradient(cx, cy, 4, cx, cy, r);
      rg.addColorStop(0, 'rgba(255, 249, 235, 0.28)');
      rg.addColorStop(1, 'rgba(208, 166, 104, 0)');
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, size, size);
    }

    // Distinct golden-amber & warm umber natural branching marble veins
    for (let v = 0; v < 8; v++) {
      ctx.beginPath();
      let vx = rand() * size;
      let vy = rand() * size * 0.25;
      ctx.moveTo(vx, vy);
      const steps = 9;
      for (let st = 1; st <= steps; st++) {
        vx += (rand() - 0.43) * 44;
        vy += (size / steps) * (0.7 + rand() * 0.5);
        ctx.lineTo(vx, vy);
      }
      ctx.strokeStyle =
        v % 2 === 0 ? 'rgba(192, 132, 44, 0.42)' : 'rgba(136, 92, 40, 0.24)';
      ctx.lineWidth = 0.9 + rand() * 1.7;
      ctx.stroke();
    }

    // Crisp subtle inner edge definition
    ctx.strokeStyle = 'rgba(162, 118, 54, 0.42)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, size - 2, size - 2);
  } else {
    // Deep jet-black obsidian marble base matching the reference dark squares
    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, '#070a10');
    grad.addColorStop(0.5, '#0b1019');
    grad.addColorStop(1, '#05080d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    // Subtle dark sapphire-obsidian mineral depth
    for (let i = 0; i < 5; i++) {
      const cx = rand() * size;
      const cy = rand() * size;
      const r = 45 + rand() * 80;
      const rg = ctx.createRadialGradient(cx, cy, 4, cx, cy, r);
      rg.addColorStop(0, 'rgba(24, 38, 62, 0.22)');
      rg.addColorStop(1, 'rgba(6, 9, 15, 0)');
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, size, size);
    }

    // Luminous golden-ochre & subtle slate-blue mineral veins across dark obsidian stone
    for (let v = 0; v < 8; v++) {
      ctx.beginPath();
      let vx = rand() * size;
      let vy = rand() * size * 0.22;
      ctx.moveTo(vx, vy);
      const steps = 9;
      for (let st = 1; st <= steps; st++) {
        vx += (rand() - 0.45) * 44;
        vy += (size / steps) * (0.7 + rand() * 0.5);
        ctx.lineTo(vx, vy);
      }
      ctx.strokeStyle =
        v % 2 === 0 ? 'rgba(224, 168, 62, 0.42)' : 'rgba(64, 128, 188, 0.22)';
      ctx.lineWidth = 0.8 + rand() * 1.5;
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(4, 6, 11, 0.92)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, size - 2, size - 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

// Reference atmospheric midnight-navy + electric blue outer halo backdrop texture
function createReferenceBackdropTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#03060e';
  ctx.fillRect(0, 0, size, size);

  // Top & bottom electric-blue ambient aura clouds (matching reference top/bottom glow)
  const glows = [
    { x: size * 0.5, y: size * 0.06, r: size * 0.44, color: 'rgba(0, 162, 255, 0.38)' },
    { x: size * 0.5, y: size * 0.94, r: size * 0.44, color: 'rgba(0, 150, 255, 0.34)' },
    { x: size * 0.08, y: size * 0.12, r: size * 0.28, color: 'rgba(0, 180, 255, 0.24)' },
    { x: size * 0.92, y: size * 0.12, r: size * 0.28, color: 'rgba(0, 180, 255, 0.24)' },
    { x: size * 0.08, y: size * 0.88, r: size * 0.28, color: 'rgba(0, 180, 255, 0.24)' },
    { x: size * 0.92, y: size * 0.88, r: size * 0.28, color: 'rgba(0, 180, 255, 0.24)' },
  ];

  for (const g of glows) {
    const rad = ctx.createRadialGradient(g.x, g.y, 4, g.x, g.y, g.r);
    rad.addColorStop(0, g.color);
    rad.addColorStop(1, 'rgba(3, 6, 14, 0)');
    ctx.fillStyle = rad;
    ctx.fillRect(0, 0, size, size);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// High-resolution unified reference board foundation texture (9.64 x 9.64 world units)
// Preserves the exact visual layout, frame bevels, corner neon channels, and coordinate gutter of the reference image
function createReferenceBoardFoundationTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Outer obsidian armor frame base
  const bgGrad = ctx.createLinearGradient(0, 0, size, size);
  bgGrad.addColorStop(0, '#0c1220');
  bgGrad.addColorStop(0.5, '#070b14');
  bgGrad.addColorStop(1, '#0b101d');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, size, size);

  // Outer burnished gold frame border
  ctx.strokeStyle = '#e5b23a';
  ctx.lineWidth = 10;
  ctx.strokeRect(18, 18, size - 36, size - 36);

  // Electric-blue corner energy channels baked into the board foundation
  ctx.strokeStyle = '#00d8ff';
  ctx.shadowColor = '#00d8ff';
  ctx.shadowBlur = 12;
  ctx.lineWidth = 5;
  const cLen = 110;
  const cOff = 10;
  // Top-Left
  ctx.beginPath();
  ctx.moveTo(cOff, cOff + cLen);
  ctx.lineTo(cOff, cOff);
  ctx.lineTo(cOff + cLen, cOff);
  ctx.stroke();
  // Top-Right
  ctx.beginPath();
  ctx.moveTo(size - cOff - cLen, cOff);
  ctx.lineTo(size - cOff, cOff);
  ctx.lineTo(size - cOff, cOff + cLen);
  ctx.stroke();
  // Bottom-Left
  ctx.beginPath();
  ctx.moveTo(cOff, size - cOff - cLen);
  ctx.lineTo(cOff, size - cOff);
  ctx.lineTo(cOff + cLen, size - cOff);
  ctx.stroke();
  // Bottom-Right
  ctx.beginPath();
  ctx.moveTo(size - cOff - cLen, size - cOff);
  ctx.lineTo(size - cOff, size - cOff);
  ctx.lineTo(size - cOff, size - cOff - cLen);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Inner dark obsidian coordinate track
  ctx.fillStyle = '#080c16';
  ctx.fillRect(42, 42, size - 84, size - 84);

  // Inner gold trim border around the 64-square playfield
  const gridMargin = Math.round(((9.64 - 8.0) / 2 / 9.64) * size);
  ctx.strokeStyle = '#eab308';
  ctx.lineWidth = 6;
  ctx.strokeRect(gridMargin - 4, gridMargin - 4, size - (gridMargin - 4) * 2, size - (gridMargin - 4) * 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export const Chess3DGame: React.FC<Chess3DGameProps> = ({
  currentUser,
  initialRoomId,
  onExit,
}) => {
  const [mode, setMode] = useState<'ai' | 'online'>(initialRoomId ? 'online' : 'ai');
  const [aiDifficulty, setAiDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [is3DView, setIs3DView] = useState(true);
  const [boardFlipped, setBoardFlipped] = useState(false);
  const [boardTheme, setBoardTheme] = useState<BoardTheme>('classic');
  const [graphicsQuality, setGraphicsQuality] = useState<GraphicsQuality>('quality');
  const [showSettingsPopover, setShowSettingsPopover] = useState(false);
  const [rightTab, setRightTab] = useState<'chat' | 'info'>('chat');

  // Show/Hide Right-Side Docked Panels (Captured Pieces + Move History)
  const [showSidePanels, setShowSidePanels] = useState<boolean>(true);
  const [showMobilePanelsDrawer, setShowMobilePanelsDrawer] = useState<boolean>(false);

  // Full-Screen Chessboard Mode (Chess Only)
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const fullScreenRootRef = useRef<HTMLDivElement>(null);
  const isFullScreenRef = useRef<boolean>(false);

  // Confirmation Dialogs for Resign / Exit Room
  const [confirmDialog, setConfirmDialog] = useState<null | 'resign' | 'exit'>(null);

  const chessRef = useRef(new Chess());
  const [gameState, setGameState] = useState<ChessGameState>(() =>
    getChessState(chessRef.current)
  );

  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<any[]>([]);
  const [lastMoveSquares, setLastMoveSquares] = useState<[string, string] | null>(null);
  const [remoteHighlightSquares, setRemoteHighlightSquares] = useState<string[] | null>(null);
  const [promotionPending, setPromotionPending] = useState<{ from: Square; to: Square } | null>(
    null
  );

  // Smooth 2D Piece Movement & Special Visual Effects State
  const [active2DMove, setActive2DMove] = useState<{
    id: number;
    from: string;
    to: string;
    pieceType: string;
    color: 'w' | 'b';
    flags: string;
    captured?: string | null;
    promotion?: string | null;
    rookFrom?: string;
    rookTo?: string;
  } | null>(null);

  const [specialEffect, setSpecialEffect] = useState<{
    id: number;
    type: 'capture' | 'castle' | 'promotion' | 'check' | 'checkmate';
    square: string;
    secondarySquare?: string;
    capturedPiece?: string | null;
    capturedColor?: 'w' | 'b';
    promotedPiece?: string | null;
    label: string;
    sublabel: string;
  } | null>(null);

  const moveHighlightTimerRef = useRef<any>(null);
  const specialEffectTimerRef = useRef<any>(null);
  const autoOrientedRoomRef = useRef<string | null>(null);

  // Clocks (in seconds)
  const [whiteTime, setWhiteTime] = useState(600); // 10:00
  const [blackTime, setBlackTime] = useState(600); // 10:00

  const [room, setRoom] = useState<GameRoom | null>(null);
  const [opponent, setOpponent] = useState<any>({
    username: 'SaraQueen',
    public_uid: 'CV-4F8Z1Q9L',
    avatar_url:
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  });
  const [participants, setParticipants] = useState<RoomParticipantInfo[]>([]);
  const [roomCodeCopied, setRoomCodeCopied] = useState(false);

  // Manual Room Chat State (NO fake initial messages, NO automatic bot replies)
  const [chatMessages, setChatMessages] = useState<RoomChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const prevChatCountRef = useRef<number>(0);
  const handleSquareSelectionRef = useRef<(square: Square) => void>(() => { });
  const selectedSquareRef = useRef<Square | null>(null);
  const legalMovesRef = useRef<any[]>([]);
  const is3DViewRef = useRef<boolean>(is3DView);
  const isSubmittingMoveRef = useRef<boolean>(false);

  // Three.js refs
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const piecesGroupRef = useRef<THREE.Group | null>(null);
  const highlightsGroupRef = useRef<THREE.Group | null>(null);
  const effectsGroupRef = useRef<THREE.Group | null>(null);
  const squaresMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const pieceMeshesBySquareRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const hoveredSquareRef = useRef<Square | null>(null);
  const hoverHighlightMeshRef = useRef<THREE.Group | null>(null);
  const sphericalRef = useRef({
    radius: 21.2,
    theta: 0,
    phi: 0.215,
  });

  // Active 3D piece movement / castling / capture / trail animations
  const activeAnimsRef = useRef<
    Array<{
      mesh: THREE.Object3D;
      fromPos: THREE.Vector3;
      toPos: THREE.Vector3;
      pieceType: string;
      startTime: number;
      duration: number;
      isPromotion?: boolean;
    }>
  >([]);
  const fadingCapturesRef = useRef<
    Array<{
      mesh: THREE.Object3D;
      ring: THREE.Mesh;
      startTime: number;
      duration: number;
    }>
  >([]);
  const trailEffectsRef = useRef<
    Array<{
      mesh: THREE.Object3D;
      startTime: number;
      duration: number;
      kind: 'trail' | 'arrival' | 'invalid' | 'promotion';
      baseOpacity?: number;
    }>
  >([]);
  const captureEffectRef = useRef<{
    mesh: THREE.Mesh;
    startTime: number;
    duration: number;
  } | null>(null);

  // Dedicated 3D Piece Layer Refs for Flat 2D Board Mode (!is3DView)
  const mount2DPiecesRef = useRef<HTMLDivElement>(null);
  const [mount2DReady, setMount2DReady] = useState<number>(0);
  const setMount2DRef = useCallback((node: HTMLDivElement | null) => {
    (mount2DPiecesRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    if (node) {
      setMount2DReady((v) => v + 1);
    }
  }, []);
  const grid2DContainerRef = useRef<HTMLDivElement>(null);
  const pieces2DGroupRef = useRef<THREE.Group | null>(null);
  const effects2DGroupRef = useRef<THREE.Group | null>(null);
  const piece2DMeshesBySquareRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const boardFlippedRef = useRef<boolean>(boardFlipped);
  const [dragged2DPiece, setDragged2DPiece] = useState<{
    square: Square;
    color: 'w' | 'b';
    type: string;
    clientX: number;
    clientY: number;
  } | null>(null);
  const drag2DPieceStateRef = useRef<{
    square: Square;
    color: 'w' | 'b';
    type: string;
    startClientX: number;
    startClientY: number;
    worldX: number;
    worldZ: number;
    active: boolean;
  } | null>(null);
  const active2D3DAnimsRef = useRef<
    Array<{
      mesh: THREE.Object3D;
      fromPos: THREE.Vector3;
      toPos: THREE.Vector3;
      pieceType: string;
      startTime: number;
      duration: number;
      isPromotion?: boolean;
    }>
  >([]);
  const fading2D3DCapturesRef = useRef<
    Array<{
      mesh: THREE.Object3D;
      ring: THREE.Mesh;
      startTime: number;
      duration: number;
    }>
  >([]);

  const appendUniqueChatMessage = useCallback((msg: RoomChatMessage) => {
    setChatMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
  }, []);

  const isMyTurn = useMemo(() => {
    if (mode === 'ai') return gameState.turn === 'w';
    if (!room) return true;
    if (room.status === 'waiting') return false;
    const myColor =
      room.player_one_id === currentUser.id
        ? room.player_one_symbol
        : room.player_two_id === currentUser.id
          ? room.player_two_symbol
          : null;
    return myColor ? gameState.turn === myColor : false;
  }, [mode, room, gameState.turn, currentUser.id]);

  // Clock countdown
  useEffect(() => {
    if (gameState.isCheckmate || gameState.isDraw) return;
    if (mode === 'online' && room?.status !== 'active') return;
    const interval = setInterval(() => {
      if (gameState.turn === 'w') {
        setWhiteTime((t) => Math.max(0, t - 1));
      } else {
        setBlackTime((t) => Math.max(0, t - 1));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [gameState.turn, gameState.isCheckmate, gameState.isDraw, mode, room?.status]);

  // Reset Camera handler (ensures fixed reference camera view without 360° orbit)
  const handleResetCamera = useCallback(() => {
    if (!cameraRef.current) return;
    const theta = 0;
    const phi = 0.215;
    const radius = 21.2;
    sphericalRef.current = { radius, theta, phi };
    cameraRef.current.position.set(
      radius * Math.sin(phi) * Math.sin(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.cos(theta)
    );
    cameraRef.current.lookAt(0, -0.05, 0.14);
  }, []);

  // Ctrl + Z keyboard shortcut for Undo in AI mode, and 'P' to toggle panels
  const handleUndo = useCallback(() => {
    if (mode === 'ai' && chessRef.current.history().length >= 1) {
      chessRef.current.undo();
      if (chessRef.current.turn() === 'b' && chessRef.current.history().length >= 1) {
        chessRef.current.undo();
      }
      setGameState(getChessState(chessRef.current));
      setSelectedSquare(null);
      setLegalMoves([]);
      setLastMoveSquares(null);
      setActive2DMove(null);
      setSpecialEffect(null);
      rebuild3DPieces();
    }
  }, [mode]);

  const handleEnterFullScreen = useCallback(() => {
    setIsFullScreen(true);
    isFullScreenRef.current = true;
    setShowSettingsPopover(false);
    setShowMobilePanelsDrawer(false);
    try {
      window.history.pushState({ chessFullScreen: true }, '');
    } catch {
      // Ignore history push errors
    }
    const el = fullScreenRootRef.current;
    const canUseNativeFullscreen =
      typeof document !== 'undefined' &&
      !navigator.webdriver &&
      window.self === window.top &&
      el &&
      typeof el.requestFullscreen === 'function' &&
      !document.fullscreenElement;
    if (canUseNativeFullscreen) {
      el.requestFullscreen().catch(() => {
        // CSS full-viewport mode remains active if browser fullscreen is restricted
      });
    }
  }, []);

  const handleExitFullScreen = useCallback(() => {
    setIsFullScreen(false);
    isFullScreenRef.current = false;
    if (document.fullscreenElement && typeof document.exitFullscreen === 'function') {
      document.exitFullscreen().catch(() => { });
    }
  }, []);

  useEffect(() => {
    isFullScreenRef.current = isFullScreen;
    // Trigger layout recalculation after entering or exiting fullscreen
    const handleRecalc = () => {
      window.dispatchEvent(new Event('resize'));
    };
    const raf = requestAnimationFrame(handleRecalc);
    const timer = setTimeout(handleRecalc, 80);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [isFullScreen]);

  useEffect(() => {
    const onFullScreenChange = () => {
      if (!document.fullscreenElement && isFullScreenRef.current) {
        // Keep CSS full-screen active unless exited via Esc/button, or sync if native fullscreen exited
        setIsFullScreen(false);
        isFullScreenRef.current = false;
      }
      // Recalculate dimensions and positions immediately after the layout has updated
      window.dispatchEvent(new Event('resize'));
      requestAnimationFrame(() => {
        window.dispatchEvent(new Event('resize'));
      });
    };
    const onPopState = () => {
      if (isFullScreenRef.current) {
        handleExitFullScreen();
      }
    };
    document.addEventListener('fullscreenchange', onFullScreenChange);
    document.addEventListener('webkitfullscreenchange', onFullScreenChange);
    window.addEventListener('popstate', onPopState);

    let resizeObs: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && grid2DContainerRef.current) {
      resizeObs = new ResizeObserver(() => {
        window.dispatchEvent(new Event('resize'));
      });
      resizeObs.observe(grid2DContainerRef.current);
    }

    return () => {
      document.removeEventListener('fullscreenchange', onFullScreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullScreenChange);
      window.removeEventListener('popstate', onPopState);
      if (resizeObs) {
        resizeObs.disconnect();
      }
    };
  }, [handleExitFullScreen]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullScreenRef.current) {
        e.preventDefault();
        handleExitFullScreen();
        return;
      }

      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      } else if (e.key.toLowerCase() === 'p' && !e.ctrlKey && !e.metaKey && !isFullScreenRef.current) {
        setShowSidePanels((s) => !s);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleUndo, handleExitFullScreen]);

  useEffect(() => {
    if (initialRoomId) {
      loadOnlineRoom(initialRoomId);
    }
  }, [initialRoomId]);

  // Real-Time WebSocket Room Subscriptions & Event Listeners
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
          appendUniqueChatMessage(data.message);
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
      wsService.on('board_highlight', (data: any) => {
        if (data.roomId === activeRoomId && data.userId !== currentUser.id) {
          setRemoteHighlightSquares(Array.isArray(data.squares) ? data.squares : null);
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
      unsubs.forEach((u) => u());
    };
  }, [mode, room?.id, appendUniqueChatMessage, currentUser.id]);

  // Keep refs synchronized for 3D WebGL event handlers without re-initializing the 3D scene
  useEffect(() => {
    selectedSquareRef.current = selectedSquare;
  }, [selectedSquare]);

  useEffect(() => {
    legalMovesRef.current = legalMoves;
  }, [legalMoves]);

  useEffect(() => {
    is3DViewRef.current = is3DView;
    if (!is3DView) {
      activeAnimsRef.current = [];
    }
  }, [is3DView]);

  // Scroll ONLY the internal chat container when a new chat message is added — NEVER scroll the page viewport
  useEffect(() => {
    if (chatMessages.length > prevChatCountRef.current && chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
    prevChatCountRef.current = chatMessages.length;
  }, [chatMessages]);

  // Trigger transient source & destination square highlights + 2D piece glide + special move effects,
  // then automatically remove the source/destination move highlights once the move completes!
  const triggerMovePresentation = useCallback(
    (
      moveDetails: {
        from: string;
        to: string;
        pieceType?: string;
        color?: 'w' | 'b';
        flags?: string;
        captured?: string | null;
        promotion?: string | null;
        san?: string;
      },
      updatedState: ChessGameState
    ) => {
      const { from, to, pieceType = 'p', color = 'w', flags = '', captured, promotion, san } =
        moveDetails;

      // 1. Highlight ONLY source and destination squares during the move
      setLastMoveSquares([from, to]);
      setRemoteHighlightSquares(null);

      // Detect castling rook motion
      let rookFrom: string | undefined;
      let rookTo: string | undefined;
      if (flags.includes('k')) {
        rookFrom = `h${to[1]}`;
        rookTo = `f${to[1]}`;
      } else if (flags.includes('q')) {
        rookFrom = `a${to[1]}`;
        rookTo = `d${to[1]}`;
      }

      // 2. Trigger smooth 2D piece transition from source square to destination square
      setActive2DMove({
        id: Date.now() + Math.random(),
        from,
        to,
        pieceType,
        color,
        flags,
        captured: captured || null,
        promotion: promotion || null,
        rookFrom,
        rookTo,
      });

      // Automatically remove the source & destination highlights once the move animation is complete (520ms)
      if (moveHighlightTimerRef.current) {
        clearTimeout(moveHighlightTimerRef.current);
      }
      moveHighlightTimerRef.current = setTimeout(() => {
        setLastMoveSquares(null);
        setActive2DMove(null);
      }, 520);

      // 3. Trigger distinct special visual effects for Checkmate, Promotion, Castling, Capture, or Check
      const pieceNames: Record<string, string> = {
        p: 'Pawn',
        n: 'Knight',
        b: 'Bishop',
        r: 'Rook',
        q: 'Queen',
        k: 'King',
      };

      let nextEffect: typeof specialEffect = null;
      if (updatedState.isCheckmate) {
        nextEffect = {
          id: Date.now(),
          type: 'checkmate',
          square: to,
          label: 'CHECKMATE!',
          sublabel: `${san || to.toUpperCase()} • Victory secured`,
        };
      } else if (flags.includes('p') || Boolean(promotion)) {
        const promoKey = (promotion || 'q').toLowerCase();
        nextEffect = {
          id: Date.now(),
          type: 'promotion',
          square: to,
          promotedPiece: promoKey,
          label: 'PAWN PROMOTION!',
          sublabel: `Promoted to ${pieceNames[promoKey] || 'Queen'} on ${to.toUpperCase()}`,
        };
      } else if (flags.includes('k') || flags.includes('q')) {
        nextEffect = {
          id: Date.now(),
          type: 'castle',
          square: to,
          secondarySquare: rookTo,
          label: 'CASTLING!',
          sublabel: flags.includes('k') ? 'Kingside Castle (O-O)' : 'Queenside Castle (O-O-O)',
        };
      } else if (flags.includes('c') || flags.includes('e') || Boolean(captured)) {
        const capKey = (captured || 'p').toLowerCase();
        nextEffect = {
          id: Date.now(),
          type: 'capture',
          square: to,
          capturedPiece: capKey,
          capturedColor: color === 'w' ? 'b' : 'w',
          label: 'CAPTURE!',
          sublabel: `${pieceNames[pieceType.toLowerCase()] || 'Piece'} captures ${pieceNames[capKey] || 'piece'
            } on ${to.toUpperCase()}`,
        };
      } else if (updatedState.isCheck) {
        nextEffect = {
          id: Date.now(),
          type: 'check',
          square: to,
          label: 'CHECK!',
          sublabel: `King under attack (${san || to.toUpperCase()})`,
        };
      }

      if (nextEffect) {
        setSpecialEffect(nextEffect);
        if (specialEffectTimerRef.current) {
          clearTimeout(specialEffectTimerRef.current);
        }
        specialEffectTimerRef.current = setTimeout(() => {
          setSpecialEffect(null);
        }, 1450);
      }
    },
    []
  );

  const loadOnlineRoom = async (roomId: string) => {
    try {
      const data = await api.getRoom(roomId);
      setMode('online');
      syncRoomState(data.room, data.players);
      setChatMessages(data.room.chat_messages || []);
    } catch (err: any) {
      setChatError(err.message || 'Failed to load chess room');
    }
  };

  const syncRoomState = (updatedRoom: GameRoom, playersInfo?: any) => {
    setRoom(updatedRoom);

    // Ensure Player 1 (White) has White at bottom of their screen (boardFlipped = false)
    // and Player 2 (Black) has Black at bottom of their screen (boardFlipped = true)
    const isP1 = updatedRoom.player_one_id === currentUser.id;
    const isP2 = updatedRoom.player_two_id === currentUser.id;
    const orientKey = `${updatedRoom.id}_${isP1 ? 'P1' : isP2 ? 'P2' : 'SPEC'}`;
    if (autoOrientedRoomRef.current !== orientKey) {
      if (isP2 && !isP1) {
        setBoardFlipped(true);
      } else if (isP1) {
        setBoardFlipped(false);
      }
      autoOrientedRoomRef.current = orientKey;
    }

    if (playersInfo) {
      if (playersInfo.participants) {
        setParticipants(playersInfo.participants);
      }
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

    // Synchronize timers across both Player 1 and Player 2 screens
    if (typeof updatedRoom.game_state?.whiteTime === 'number') {
      setWhiteTime(updatedRoom.game_state.whiteTime);
    }
    if (typeof updatedRoom.game_state?.blackTime === 'number') {
      setBlackTime(updatedRoom.game_state.blackTime);
    }

    if (updatedRoom.game_state?.fen) {
      const prevFen = chessRef.current.fen();
      const fenChanged = prevFen !== updatedRoom.game_state.fen;

      chessRef.current.load(updatedRoom.game_state.fen);
      const newState = getChessState(chessRef.current);
      // Preserve full SAN history from room.move_history when loading from FEN
      if (updatedRoom.move_history?.length) {
        newState.history = updatedRoom.move_history.map((m: any) => m.move || m.san || '');
      }
      setGameState(newState);

      let animatedMove:
        | { from: string; to: string; pieceType?: string; flags?: string; captured?: string | null }
        | undefined;
      if (updatedRoom.move_history?.length && fenChanged) {
        const last = updatedRoom.move_history[updatedRoom.move_history.length - 1];
        if (last?.from && last?.to) {
          animatedMove = {
            from: last.from,
            to: last.to,
            pieceType: last.piece || 'p',
            flags: last.flags || '',
            captured: last.captured || null,
          };
          triggerMovePresentation(
            {
              from: last.from,
              to: last.to,
              pieceType: last.piece || 'p',
              color: last.color || (newState.turn === 'w' ? 'b' : 'w'),
              flags: last.flags || '',
              captured: last.captured || null,
              promotion: last.promotion || null,
              san: last.move || last.san || '',
            },
            newState
          );
        }
      } else if (!updatedRoom.move_history?.length) {
        setLastMoveSquares(null);
        setActive2DMove(null);
      }

      if (newState.isCheckmate && updatedRoom.winner_id === currentUser.id) {
        confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
      }

      rebuild3DPieces(animatedMove);
    } else {
      rebuild3DPieces();
    }
  };

  // --------------------------------------------------------------------
  // THREE.JS 3D SCENE SETUP — EXACT REFERENCE BOARD, FIXED CAMERA & SCULPTED PIECES
  // --------------------------------------------------------------------
  useEffect(() => {
    if (!mountRef.current || !is3DView) return;

    const container = mountRef.current;
    const width = container.clientWidth || 720;
    const height = container.clientHeight || 480;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const backdropTex = createReferenceBackdropTexture();
    scene.background = backdropTex;

    // Fixed reference camera framing: fits the 10.6x10.6 ornate board + 4 cardinal diamond crests cleanly on any screen
    const BASE_FOV = 28.8;
    const computeEffectiveFov = (aspect: number) => {
      if (aspect >= 1.05) return BASE_FOV;
      const baseTan = Math.tan((BASE_FOV * Math.PI) / 360);
      const reqTan = baseTan / Math.max(0.5, aspect * 0.94);
      return Math.min(58, (Math.atan(reqTan) * 360) / Math.PI);
    };

    const initialAspect = width / height;
    const camera = new THREE.PerspectiveCamera(
      computeEffectiveFov(initialAspect),
      initialAspect,
      0.1,
      100
    );
    cameraRef.current = camera;
    updateCameraPosition(camera, false);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
    } catch {
      setIs3DView(false);
      return;
    }

    rendererRef.current = renderer;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setSize(width, height);
    const maxPR = IS_SOFTWARE_GL
      ? 1.25
      : graphicsQuality === 'quality'
        ? Math.min(window.devicePixelRatio, 2)
        : graphicsQuality === 'balanced'
          ? 1.5
          : 1;
    renderer.setPixelRatio(maxPR);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    renderer.shadowMap.enabled = !IS_SOFTWARE_GL && graphicsQuality !== 'performance';
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const maxAniso = renderer.capabilities.getMaxAnisotropy?.() || 4;

    // Procedural Studio Environment Map for metallic gold & obsidian reflections
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmremGenerator.dispose();

    container.replaceChildren(renderer.domElement);

    // Studio Lighting Rig angled to sculpt 3D piece cylinders/spheres with zero flat glare on marble tiles
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x070a14, 0.68);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff4dc, 1.95);
    keyLight.position.set(-5.2, 14.5, -4.8);
    if (!IS_SOFTWARE_GL && graphicsQuality !== 'performance') {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.width = graphicsQuality === 'quality' ? 1024 : 512;
      keyLight.shadow.mapSize.height = graphicsQuality === 'quality' ? 1024 : 512;
      keyLight.shadow.camera.near = 2;
      keyLight.shadow.camera.far = 32;
      keyLight.shadow.camera.left = -5.4;
      keyLight.shadow.camera.right = 5.4;
      keyLight.shadow.camera.top = 5.4;
      keyLight.shadow.camera.bottom = -5.4;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    const frontFillLight = new THREE.DirectionalLight(0xffe6b8, 0.78);
    frontFillLight.position.set(5.8, 9.5, 6.2);
    scene.add(frontFillLight);

    const topBlueRimLight = new THREE.DirectionalLight(0x00c8ff, 1.75);
    topBlueRimLight.position.set(0, 10.5, -11.5);
    scene.add(topBlueRimLight);

    const leftGoldLight = new THREE.PointLight(0xffb703, 1.35, 22);
    leftGoldLight.position.set(-7.5, 4.5, 0);
    scene.add(leftGoldLight);

    const rightGoldLight = new THREE.PointLight(0xffb703, 1.35, 22);
    rightGoldLight.position.set(7.5, 4.5, 0);
    scene.add(rightGoldLight);

    // ------------------------------------------------------------------
    // REFERENCE 3D CHESS BOARD ARCHITECTURE (Sharp Mitered Frame, Veined Marble,
    // 4-Side Coordinates, Neon Cyan Corner Channels & 4 Cardinal Diamond Gems)
    // ------------------------------------------------------------------
    const boardGroup = new THREE.Group();
    scene.add(boardGroup);

    const goldArmorMat = new THREE.MeshStandardMaterial({
      color: 0xe5b23a,
      roughness: 0.22,
      metalness: 0.88,
      emissive: 0x3b2502,
      emissiveIntensity: 0.14,
      envMapIntensity: 0.75,
    });
    const darkObsidianFrameMat = new THREE.MeshPhysicalMaterial({
      color: 0x0b0f18,
      roughness: 0.24,
      metalness: 0.5,
      clearcoat: 0.55,
      clearcoatRoughness: 0.18,
      envMapIntensity: 0.45,
    });
    const gunmetalPlinthMat = new THREE.MeshStandardMaterial({
      color: 0x080c15,
      roughness: 0.3,
      metalness: 0.68,
      envMapIntensity: 0.4,
    });
    const neonCyanMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x00d0ff,
      emissiveIntensity: 2.3,
      roughness: 0.1,
      metalness: 0.2,
    });
    const neonGoldStripMat = new THREE.MeshStandardMaterial({
      color: 0xfde047,
      emissive: 0xffaa00,
      emissiveIntensity: 2.0,
      roughness: 0.1,
      metalness: 0.3,
    });

    // 1. Deep Stepped Pedestal Plinth Base
    const lowerPlinth = new THREE.Mesh(
      new THREE.BoxGeometry(10.04, 0.34, 10.12),
      gunmetalPlinthMat
    );
    lowerPlinth.position.y = -0.32;
    boardGroup.add(lowerPlinth);

    const midArmorSlab = new THREE.Mesh(
      new THREE.BoxGeometry(9.64, 0.28, 9.64),
      darkObsidianFrameMat
    );
    midArmorSlab.position.y = -0.17;
    midArmorSlab.receiveShadow = true;
    boardGroup.add(midArmorSlab);

    // Subtle front & back plinth gold trim molding + electric-blue LED bars
    for (const zSign of [-1, 1]) {
      const plinthGoldBar = new THREE.Mesh(
        new THREE.BoxGeometry(8.9, 0.045, 0.08),
        goldArmorMat
      );
      plinthGoldBar.position.set(0, -0.22, zSign * 5.04);
      boardGroup.add(plinthGoldBar);

      for (const xSign of [-1, 1]) {
        const plinthBlueLed = new THREE.Mesh(
          new THREE.BoxGeometry(1.35, 0.045, 0.09),
          neonCyanMat
        );
        plinthBlueLed.position.set(xSign * 3.3, -0.34, zSign * 5.05);
        boardGroup.add(plinthBlueLed);
      }
    }

    // 2. Dark Obsidian Coordinate Track Slab + Unified Reference Board Foundation Texture (9.64 x 9.64)
    const coordTrackSlab = new THREE.Mesh(
      new THREE.BoxGeometry(9.08, 0.16, 9.08),
      darkObsidianFrameMat
    );
    coordTrackSlab.position.y = -0.05;
    coordTrackSlab.receiveShadow = true;
    boardGroup.add(coordTrackSlab);

    const foundationTex = createReferenceBoardFoundationTexture(maxAniso);
    const foundationPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(9.64, 9.64),
      new THREE.MeshStandardMaterial({
        map: foundationTex,
        roughness: 0.35,
        metalness: 0.3,
      })
    );
    foundationPlane.rotation.x = -Math.PI / 2;
    foundationPlane.position.y = 0.032;
    foundationPlane.receiveShadow = true;
    boardGroup.add(foundationPlane);

    // 3. Sharp Mitered Inner Gold Bevel Frame around the 8x8 Grid (8.14 x 8.14)
    const innerGoldThickness = 0.075;
    const innerGoldHeight = 0.165;
    const innerTopBar = new THREE.Mesh(
      new THREE.BoxGeometry(8.15, innerGoldHeight, innerGoldThickness),
      goldArmorMat
    );
    innerTopBar.position.set(0, -0.005, -4.0375);
    boardGroup.add(innerTopBar);

    const innerBottomBar = new THREE.Mesh(
      new THREE.BoxGeometry(8.15, innerGoldHeight, innerGoldThickness),
      goldArmorMat
    );
    innerBottomBar.position.set(0, -0.005, 4.0375);
    boardGroup.add(innerBottomBar);

    const innerLeftBar = new THREE.Mesh(
      new THREE.BoxGeometry(innerGoldThickness, innerGoldHeight, 8.0),
      goldArmorMat
    );
    innerLeftBar.position.set(-4.0375, -0.005, 0);
    boardGroup.add(innerLeftBar);

    const innerRightBar = new THREE.Mesh(
      new THREE.BoxGeometry(innerGoldThickness, innerGoldHeight, 8.0),
      goldArmorMat
    );
    innerRightBar.position.set(4.0375, -0.005, 0);
    boardGroup.add(innerRightBar);

    // 4. Outer Raised Gold Frame Rails + Sharp Corner Brackets (9.16 x 9.16)
    const outerRailThickness = 0.12;
    const outerRailHeight = 0.21;
    for (const zSign of [-1, 1]) {
      const horizRail = new THREE.Mesh(
        new THREE.BoxGeometry(9.18, outerRailHeight, outerRailThickness),
        goldArmorMat
      );
      horizRail.position.set(0, 0.01, zSign * 4.53);
      boardGroup.add(horizRail);
    }
    for (const xSign of [-1, 1]) {
      const vertRail = new THREE.Mesh(
        new THREE.BoxGeometry(outerRailThickness, outerRailHeight, 9.06),
        goldArmorMat
      );
      vertRail.position.set(xSign * 4.53, 0.01, 0);
      boardGroup.add(vertRail);

      // Glowing golden energy strips along left & right outer armor flanks (matching reference)
      for (const zSeg of [-2.35, 2.35]) {
        const sideGoldStrip = new THREE.Mesh(
          new THREE.BoxGeometry(0.055, 0.06, 2.45),
          neonGoldStripMat
        );
        sideGoldStrip.position.set(xSign * 4.74, 0.03, zSeg);
        boardGroup.add(sideGoldStrip);
      }
    }

    // 5. Four Bold Mitered Corner Brackets + Glowing Electric-Blue Outer Corner L-Channels
    for (const xSign of [-1, 1]) {
      for (const zSign of [-1, 1]) {
        // Inner golden chamfered corner chevron
        const cornerBlock = new THREE.Mesh(
          new THREE.BoxGeometry(0.46, 0.23, 0.46),
          goldArmorMat
        );
        cornerBlock.position.set(xSign * 4.44, 0.02, zSign * 4.44);
        boardGroup.add(cornerBlock);

        const cornerDarkInlay = new THREE.Mesh(
          new THREE.BoxGeometry(0.28, 0.24, 0.28),
          darkObsidianFrameMat
        );
        cornerDarkInlay.position.set(xSign * 4.44, 0.022, zSign * 4.44);
        boardGroup.add(cornerDarkInlay);

        // Diagonal 45-degree gold bevel bar across each corner
        const diagGoldBar = new THREE.Mesh(
          new THREE.BoxGeometry(0.52, 0.245, 0.09),
          goldArmorMat
        );
        diagGoldBar.rotation.y = xSign * zSign > 0 ? -Math.PI / 4 : Math.PI / 4;
        diagGoldBar.position.set(xSign * 4.38, 0.025, zSign * 4.38);
        boardGroup.add(diagGoldBar);

        // Outer Neon Cyan L-Corner Channels (matching the bright blue corner lines in reference)
        const cyanHorizArm = new THREE.Mesh(
          new THREE.BoxGeometry(1.15, 0.065, 0.065),
          neonCyanMat
        );
        cyanHorizArm.position.set(xSign * 4.24, 0.02, zSign * 4.78);
        boardGroup.add(cyanHorizArm);

        const cyanVertArm = new THREE.Mesh(
          new THREE.BoxGeometry(0.065, 0.065, 1.15),
          neonCyanMat
        );
        cyanVertArm.position.set(xSign * 4.78, 0.02, zSign * 4.24);
        boardGroup.add(cyanVertArm);
      }
    }

    // 6. Four Cardinal Diamond Gem Crests (Top, Bottom, Left, Right Centers)
    const createCardinalDiamondCrest = () => {
      const crestGroup = new THREE.Group();

      // Sharp 4-pointed golden diamond bezel (rotated square prism + extruded wings)
      const outerDiamond = new THREE.Mesh(
        new THREE.BoxGeometry(0.58, 0.22, 0.58),
        goldArmorMat
      );
      outerDiamond.rotation.y = Math.PI / 4;
      crestGroup.add(outerDiamond);

      const innerSetting = new THREE.Mesh(
        new THREE.BoxGeometry(0.38, 0.24, 0.38),
        darkObsidianFrameMat
      );
      innerSetting.rotation.y = Math.PI / 4;
      innerSetting.position.y = 0.01;
      crestGroup.add(innerSetting);

      // Faceted glowing electric-blue diamond crystal core
      const crystalGem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.19, 0),
        neonCyanMat
      );
      crystalGem.scale.set(1.0, 0.65, 1.0);
      crystalGem.position.y = 0.11;
      crestGroup.add(crystalGem);

      const crystalCore = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.095, 0),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      crystalCore.scale.set(1.0, 0.7, 1.0);
      crystalCore.position.y = 0.14;
      crestGroup.add(crystalCore);

      // Flanking golden wing chevrons
      for (const side of [-1, 1]) {
        const wing = new THREE.Mesh(
          new THREE.BoxGeometry(0.45, 0.16, 0.14),
          goldArmorMat
        );
        wing.position.set(side * 0.44, 0.0, -0.06);
        wing.rotation.y = side * 0.22;
        crestGroup.add(wing);
      }

      return crestGroup;
    };

    const topCrest = createCardinalDiamondCrest();
    topCrest.position.set(0, 0.02, -4.76);
    boardGroup.add(topCrest);

    const bottomCrest = createCardinalDiamondCrest();
    bottomCrest.position.set(0, 0.02, 4.76);
    bottomCrest.rotation.y = Math.PI;
    boardGroup.add(bottomCrest);

    const leftCrest = createCardinalDiamondCrest();
    leftCrest.position.set(-4.76, 0.02, 0);
    leftCrest.rotation.y = Math.PI / 2;
    boardGroup.add(leftCrest);

    const rightCrest = createCardinalDiamondCrest();
    rightCrest.position.set(4.76, 0.02, 0);
    rightCrest.rotation.y = -Math.PI / 2;
    boardGroup.add(rightCrest);

    // 7. Coordinate Labels on ALL FOUR Sides (Top a-h, Bottom a-h, Left 8-1, Right 8-1)
    const coordPlaneGeo = new THREE.PlaneGeometry(0.38, 0.38);
    const labelRotZ = 0;
    for (let i = 0; i < 8; i++) {
      const fileTex = createCoordTexture(FILES[i], maxAniso);
      const fileMat = new THREE.MeshBasicMaterial({
        map: fileTex,
        transparent: true,
        depthWrite: false,
      });

      // Bottom file label (a-h)
      const bottomFileMesh = new THREE.Mesh(coordPlaneGeo, fileMat);
      bottomFileMesh.rotation.x = -Math.PI / 2;
      bottomFileMesh.rotation.z = labelRotZ;
      bottomFileMesh.position.set(i - 3.5, 0.036, 4.285);
      boardGroup.add(bottomFileMesh);

      // Top file label (a-h)
      const topFileMesh = new THREE.Mesh(coordPlaneGeo, fileMat);
      topFileMesh.rotation.x = -Math.PI / 2;
      topFileMesh.rotation.z = labelRotZ;
      topFileMesh.position.set(i - 3.5, 0.036, -4.285);
      boardGroup.add(topFileMesh);

      const rankTex = createCoordTexture(RANKS[i], maxAniso);
      const rankMat = new THREE.MeshBasicMaterial({
        map: rankTex,
        transparent: true,
        depthWrite: false,
      });

      // Left rank label (1-8)
      const leftRankMesh = new THREE.Mesh(coordPlaneGeo, rankMat);
      leftRankMesh.rotation.x = -Math.PI / 2;
      leftRankMesh.rotation.z = labelRotZ;
      leftRankMesh.position.set(-4.285, 0.036, 3.5 - i);
      boardGroup.add(leftRankMesh);

      // Right rank label (1-8)
      const rightRankMesh = new THREE.Mesh(coordPlaneGeo, rankMat);
      rightRankMesh.rotation.x = -Math.PI / 2;
      rightRankMesh.rotation.z = labelRotZ;
      rightRankMesh.position.set(4.285, 0.036, 3.5 - i);
      boardGroup.add(rightRankMesh);
    }

    // 8. 64 Evenly-Sized Veined Marble Squares (8x8 Grid with Crisp Seam Base)
    const seamBase = new THREE.Mesh(
      new THREE.BoxGeometry(8.02, 0.12, 8.02),
      new THREE.MeshStandardMaterial({
        color: 0x05070c,
        roughness: 0.45,
        metalness: 0.5,
      })
    );
    seamBase.position.y = -0.005;
    boardGroup.add(seamBase);

    squaresMeshesRef.current.clear();
    const squareGeo = new THREE.BoxGeometry(0.992, 0.14, 0.992);

    // Pre-generate 4 light cream-gold & 4 deep jet-obsidian veined marble square materials
    const lightMarbleMaterials = [0, 1, 2, 3].map(
      (idx) =>
        new THREE.MeshStandardMaterial({
          map: createMarbleSquareTexture(true, idx * 17 + 3, maxAniso),
          roughness: 0.56,
          metalness: 0.04,
          envMapIntensity: 0.14,
        })
    );
    const darkMarbleMaterials = [0, 1, 2, 3].map(
      (idx) =>
        new THREE.MeshStandardMaterial({
          map: createMarbleSquareTexture(false, idx * 23 + 7, maxAniso),
          roughness: 0.52,
          metalness: 0.08,
          envMapIntensity: 0.16,
        })
    );

    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const sqName = `${FILES[f]}${RANKS[r]}`;
        const isLight = (r + f) % 2 !== 0;
        const variantIdx = (r * 3 + f * 5) % 4;
        const mat = isLight
          ? lightMarbleMaterials[variantIdx]
          : darkMarbleMaterials[variantIdx];
        const mesh = new THREE.Mesh(squareGeo, mat);
        mesh.position.set(f - 3.5, 0, 3.5 - r);
        mesh.receiveShadow = true;
        mesh.userData = { square: sqName };
        boardGroup.add(mesh);
        squaresMeshesRef.current.set(sqName, mesh);
      }
    }

    const piecesGroup = new THREE.Group();
    piecesGroupRef.current = piecesGroup;
    scene.add(piecesGroup);

    const highlightsGroup = new THREE.Group();
    highlightsGroupRef.current = highlightsGroup;
    scene.add(highlightsGroup);

    const effectsGroup = new THREE.Group();
    effectsGroupRef.current = effectsGroup;
    scene.add(effectsGroup);

    // Restrained hover square border highlight mesh
    const hoverGroup = new THREE.Group();
    hoverGroup.visible = false;
    const hoverRing = new THREE.Mesh(
      new THREE.RingGeometry(0.41, 0.465, 4),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.42,
        side: THREE.DoubleSide,
      })
    );
    hoverRing.rotation.x = -Math.PI / 2;
    hoverRing.rotation.z = Math.PI / 4;
    hoverGroup.add(hoverRing);
    scene.add(hoverGroup);
    hoverHighlightMeshRef.current = hoverGroup;

    rebuild3DPieces();
    rebuildHighlights();

    // ------------------------------------------------------------------
    // FIXED CAMERA INTERACTION — CLICK, TAP, HOVER & DRAG-AND-DROP PIECE MOVEMENT
    // (No 360-degree camera orbit, rotation, or zoom)
    // ------------------------------------------------------------------
    let isLeftPressOnCanvas = false;
    let downPointer = { x: 0, y: 0 };
    let downSquare: Square | null = null;
    let lastTouchEndTime = 0;
    let lastHoverRaycastTime = 0;

    const canvas = renderer.domElement;
    canvas.style.touchAction = 'manipulation';

    const getSquareAtClientXY = (clientX: number, clientY: number): Square | null => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      if (
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.bottom
      ) {
        return null;
      }

      const mouseX = ((clientX - rect.left) / rect.width) * 2 - 1;
      const mouseY = -((clientY - rect.top) / rect.height) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), camera);

      const squareMeshes = Array.from(squaresMeshesRef.current.values());
      const squareHits = raycaster.intersectObjects(squareMeshes, false);
      const rawGroundSquare =
        squareHits.length > 0
          ? (squareHits[0].object.userData?.square as Square | undefined)
          : undefined;
      const groundSquare =
        rawGroundSquare && boardFlippedRef.current
          ? (`${FILES[7 - FILES.indexOf(rawGroundSquare[0])]}${RANKS[7 - RANKS.indexOf(rawGroundSquare[1])]}` as Square)
          : rawGroundSquare;

      // If a piece is already selected and the ray hits a legal destination board square on the ground,
      // prefer that legal destination square so tall 3D pieces in front of it never occlude the move target.
      if (
        selectedSquareRef.current &&
        groundSquare &&
        legalMovesRef.current.some((m) => m.to === groundSquare)
      ) {
        return groundSquare;
      }

      // Otherwise intersect both 3D piece meshes and board square meshes
      const pieceObjects = piecesGroupRef.current ? piecesGroupRef.current.children : [];
      const allHits = raycaster.intersectObjects([...pieceObjects, ...squareMeshes], true);
      for (const hit of allHits) {
        let obj: THREE.Object3D | null = hit.object;
        while (obj) {
          if (obj.userData?.square) {
            return obj.userData.square as Square;
          }
          obj = obj.parent;
        }
      }

      return groundSquare || null;
    };

    const boardDragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.07);
    let activeDragSquare: Square | null = null;
    let activeDragWorldPos: { x: number; z: number } | null = null;

    const getBoardPlaneHit = (clientX: number, clientY: number): { x: number; z: number } | null => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      const mouseX = ((clientX - rect.left) / rect.width) * 2 - 1;
      const mouseY = -((clientY - rect.top) / rect.height) * 2 + 1;
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), camera);
      const target = new THREE.Vector3();
      const hit = raycaster.ray.intersectPlane(boardDragPlane, target);
      if (!hit) return null;
      return {
        x: Math.max(-3.65, Math.min(3.65, target.x)),
        z: Math.max(-3.65, Math.min(3.65, target.z)),
      };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (isLeftPressOnCanvas && downSquare) {
        const moveDist = Math.hypot(e.clientX - downPointer.x, e.clientY - downPointer.y);
        if (moveDist >= 14) {
          const pieceOnDown = chessRef.current.get(downSquare);
          if (pieceOnDown && pieceOnDown.color === chessRef.current.turn()) {
            if (selectedSquareRef.current !== downSquare) {
              handleSquareSelectionRef.current(downSquare);
            }
            activeDragSquare = downSquare;
            activeDragWorldPos = getBoardPlaneHit(e.clientX, e.clientY);
          }
        }
      }

      const now = performance.now();
      if (now - lastHoverRaycastTime < 36) return;
      lastHoverRaycastTime = now;

      const sq = getSquareAtClientXY(e.clientX, e.clientY);
      hoveredSquareRef.current = sq;

      if (sq && hoverHighlightMeshRef.current) {
        const isLegalTarget = legalMovesRef.current.some((m) => m.to === sq);
        const pieceOnSq = chessRef.current.get(sq);
        const currentTurn = chessRef.current.turn();
        const isSelectablePiece = Boolean(pieceOnSq && pieceOnSq.color === currentTurn);

        if (isLegalTarget || isSelectablePiece) {
          const f = FILES.indexOf(sq[0]);
          const r = RANKS.indexOf(sq[1]);
          hoverHighlightMeshRef.current.position.set(f - 3.5, 0.074, 3.5 - r);
          hoverHighlightMeshRef.current.visible = sq !== selectedSquareRef.current;
          canvas.style.cursor = activeDragSquare ? 'grabbing' : 'pointer';
        } else {
          hoverHighlightMeshRef.current.visible = false;
          canvas.style.cursor = activeDragSquare ? 'grabbing' : 'default';
        }
      } else {
        if (hoverHighlightMeshRef.current) {
          hoverHighlightMeshRef.current.visible = false;
        }
        canvas.style.cursor = activeDragSquare ? 'grabbing' : 'default';
      }
    };

    const onMouseLeave = () => {
      hoveredSquareRef.current = null;
      if (hoverHighlightMeshRef.current) {
        hoverHighlightMeshRef.current.visible = false;
      }
      canvas.style.cursor = 'default';
    };

    const onMouseDown = (e: MouseEvent) => {
      if (Date.now() - lastTouchEndTime < 450) return;
      if (e.button === 0 && e.target === canvas) {
        isLeftPressOnCanvas = true;
        downPointer = { x: e.clientX, y: e.clientY };
        downSquare = getSquareAtClientXY(e.clientX, e.clientY);
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (Date.now() - lastTouchEndTime < 450) return;
      if (e.button === 0 && isLeftPressOnCanvas) {
        isLeftPressOnCanvas = false;
        activeDragSquare = null;
        activeDragWorldPos = null;
        const upSquare = getSquareAtClientXY(e.clientX, e.clientY);
        const moveDist = Math.hypot(e.clientX - downPointer.x, e.clientY - downPointer.y);

        if (moveDist < 14 && upSquare) {
          handleSquareSelectionRef.current(upSquare);
        } else if (downSquare && upSquare && downSquare !== upSquare) {
          // Support direct drag-and-drop from source square to destination square
          if (selectedSquareRef.current !== downSquare) {
            handleSquareSelectionRef.current(downSquare);
          }
          handleSquareSelectionRef.current(upSquare);
        }
        downSquare = null;
      }
    };

    let touchStartPos = { x: 0, y: 0 };
    let touchDownSquare: Square | null = null;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        touchDownSquare = getSquareAtClientXY(touchStartPos.x, touchStartPos.y);
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.changedTouches.length === 1) {
        activeDragSquare = null;
        activeDragWorldPos = null;
        const t = e.changedTouches[0];
        const moveDist = Math.hypot(t.clientX - touchStartPos.x, t.clientY - touchStartPos.y);
        lastTouchEndTime = Date.now();
        const upSquare = getSquareAtClientXY(t.clientX, t.clientY);

        if (moveDist < 20 && upSquare) {
          if (e.cancelable) e.preventDefault();
          handleSquareSelectionRef.current(upSquare);
        } else if (touchDownSquare && upSquare && touchDownSquare !== upSquare) {
          if (e.cancelable) e.preventDefault();
          if (selectedSquareRef.current !== touchDownSquare) {
            handleSquareSelectionRef.current(touchDownSquare);
          }
          handleSquareSelectionRef.current(upSquare);
        }
        touchDownSquare = null;
      }
    };

    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    canvas.addEventListener('mousemove', onMouseMove, { passive: true });
    canvas.addEventListener('mouseleave', onMouseLeave, { passive: true });
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    canvas.addEventListener('contextmenu', onContextMenu);

    let frameId = 0;
    let isDisposed = false;
    let prevFrameTime = performance.now();
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const afterDraw = (cb: () => void) => {
      if (isDisposed) return;
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (isDisposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    };

    const animate = () => {
      if (isDisposed) return;

      const now = performance.now();
      const dt = Math.min(0.05, Math.max(0.001, (now - prevFrameTime) / 1000));
      prevFrameTime = now;

      // 1. Unique Piece-Type Movement Animations (Pawn step, Knight curved L-leap, Bishop diagonal glide,
      //    Rook stable slide, Queen fluid float, King deliberate stride, Promotion ascension)
      const movingMeshes = new Set<THREE.Object3D>();
      if (activeAnimsRef.current.length > 0) {
        const remaining: typeof activeAnimsRef.current = [];
        for (const anim of activeAnimsRef.current) {
          movingMeshes.add(anim.mesh);
          const elapsed = now - anim.startTime;
          const t = prefersReducedMotion ? 1 : Math.min(1, elapsed / anim.duration);
          const innerGroup = anim.mesh.children[0] as THREE.Object3D | undefined;

          // Piece-specific easing & trajectory personality
          const dx = anim.toPos.x - anim.fromPos.x;
          const dz = anim.toPos.z - anim.fromPos.z;

          if (anim.pieceType === 'n') {
            // Knight: Smooth acceleration/deceleration along a curved L-shaped trajectory with raised leap arc
            const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
            const absX = Math.abs(dx);
            const absZ = Math.abs(dz);
            const easeFast = Math.pow(ease, 0.72);
            const easeSlow = Math.pow(ease, 1.48);
            if (absX >= absZ) {
              anim.mesh.position.x = anim.fromPos.x + dx * easeFast;
              anim.mesh.position.z = anim.fromPos.z + dz * easeSlow;
            } else {
              anim.mesh.position.x = anim.fromPos.x + dx * easeSlow;
              anim.mesh.position.z = anim.fromPos.z + dz * easeFast;
            }
            anim.mesh.position.y = 0.07 + Math.sin(t * Math.PI) * 0.84;
            if (innerGroup) {
              innerGroup.rotation.x = -0.74 + Math.sin(t * Math.PI * 2) * 0.13;
            }
          } else if (anim.pieceType === 'p') {
            // Pawn: Short, crisp, natural forward step
            const ease = 1 - Math.pow(1 - t, 3);
            anim.mesh.position.x = anim.fromPos.x + dx * ease;
            anim.mesh.position.z = anim.fromPos.z + dz * ease;
            anim.mesh.position.y = 0.07 + Math.sin(t * Math.PI) * 0.16;
            if (innerGroup) {
              innerGroup.rotation.x = -0.74 - Math.sin(t * Math.PI) * 0.065;
            }
          } else if (anim.pieceType === 'b') {
            // Bishop: Smooth, slicing diagonal glide
            const ease = 0.5 - 0.5 * Math.cos(t * Math.PI);
            anim.mesh.position.x = anim.fromPos.x + dx * ease;
            anim.mesh.position.z = anim.fromPos.z + dz * ease;
            anim.mesh.position.y = 0.07 + Math.sin(t * Math.PI) * 0.14;
          } else if (anim.pieceType === 'r') {
            // Rook: Stable, heavy, precise linear slide
            const ease =
              t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
            anim.mesh.position.x = anim.fromPos.x + dx * ease;
            anim.mesh.position.z = anim.fromPos.z + dz * ease;
            anim.mesh.position.y = 0.07 + Math.sin(t * Math.PI) * 0.055;
          } else if (anim.pieceType === 'q') {
            // Queen: Elegant, fluid royal glide
            const ease =
              t < 0.5
                ? 8 * t * t * t * t
                : 1 - Math.pow(-2 * t + 2, 4) / 2;
            anim.mesh.position.x = anim.fromPos.x + dx * ease;
            anim.mesh.position.z = anim.fromPos.z + dz * ease;
            anim.mesh.position.y = 0.07 + Math.sin(t * Math.PI) * 0.24;
          } else {
            // King: Controlled, deliberate sovereign stride
            const ease =
              t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
            anim.mesh.position.x = anim.fromPos.x + dx * ease;
            anim.mesh.position.z = anim.fromPos.z + dz * ease;
            anim.mesh.position.y = 0.07 + Math.sin(t * Math.PI) * 0.15;
          }

          if (anim.isPromotion) {
            const promoScale = t < 0.7 ? 0.72 + (t / 0.7) * 0.36 : 1.08 - ((t - 0.7) / 0.3) * 0.08;
            anim.mesh.scale.setScalar(promoScale);
          }

          if (t < 1) {
            remaining.push(anim);
          } else {
            anim.mesh.position.copy(anim.toPos);
            anim.mesh.scale.setScalar(1.0);
            if (innerGroup) {
              innerGroup.rotation.x = -0.74;
            }
          }
        }
        activeAnimsRef.current = remaining;
      }

      // 2. Smooth Piece Selection Lift ("Lifts up with glow"), Live Drag Follow & Deselection Lowering
      const damp = prefersReducedMotion ? 1 : 1 - Math.exp(-dt * 16);
      const selectedSq = selectedSquareRef.current;
      const hoveredSq = hoveredSquareRef.current;
      pieceMeshesBySquareRef.current.forEach((mesh, sq) => {
        if (movingMeshes.has(mesh)) return;
        const isSelected = sq === selectedSq;
        const isHovered = sq === hoveredSq && !isSelected;
        const isBeingDragged = sq === activeDragSquare && activeDragWorldPos !== null;

        const homeX = FILES.indexOf(sq[0]) - 3.5;
        const homeZ = 3.5 - RANKS.indexOf(sq[1]);
        const targetX = isBeingDragged && activeDragWorldPos ? activeDragWorldPos.x : homeX;
        const targetZ = isBeingDragged && activeDragWorldPos ? activeDragWorldPos.z : homeZ;

        const targetY = isBeingDragged
          ? 0.34
          : isSelected
            ? 0.27 + (prefersReducedMotion ? 0 : Math.sin(now * 0.0055) * 0.022)
            : isHovered
              ? 0.115
              : 0.07;
        const targetScale = isBeingDragged ? 1.07 : isSelected ? 1.055 : isHovered ? 1.02 : 1.0;

        mesh.position.x += (targetX - mesh.position.x) * damp;
        mesh.position.z += (targetZ - mesh.position.z) * damp;
        mesh.position.y += (targetY - mesh.position.y) * damp;
        const nextScale = mesh.scale.x + (targetScale - mesh.scale.x) * damp;
        mesh.scale.setScalar(nextScale);

        const innerGroup = mesh.children[0] as THREE.Object3D | undefined;
        if (innerGroup) {
          const targetPitch = isSelected || isBeingDragged ? -0.70 : -0.74;
          innerGroup.rotation.x += (targetPitch - innerGroup.rotation.x) * damp;
        }
      });

      // 3. Smooth Capture Fade-Out & Scale-Down Animation ("Capture Animation: Smooth fade effect")
      if (fadingCapturesRef.current.length > 0) {
        const remainingCaps: typeof fadingCapturesRef.current = [];
        for (const cap of fadingCapturesRef.current) {
          const t = Math.min(1, (now - cap.startTime) / cap.duration);
          const fadeOut = Math.pow(1 - t, 1.5);
          const scale = 1.0 - t * 0.28;
          cap.mesh.scale.setScalar(scale);
          cap.mesh.position.y = 0.07 + t * 0.18;

          cap.mesh.traverse((child) => {
            const m = (child as THREE.Mesh).material as THREE.Material | undefined;
            if (m && 'opacity' in m) {
              m.opacity = fadeOut * 0.9;
            }
          });

          const ringScale = 0.85 + t * 1.45;
          cap.ring.scale.set(ringScale, ringScale, 1);
          const ringMat = cap.ring.material as THREE.MeshBasicMaterial;
          ringMat.opacity = (1 - t) * 0.85;

          if (t < 1) {
            remainingCaps.push(cap);
          } else {
            cap.mesh.parent?.remove(cap.mesh);
            cap.ring.parent?.remove(cap.ring);
          }
        }
        fadingCapturesRef.current = remainingCaps;
      }

      // 4. Piece-Type Trail & Arrival Effects (Knight L-arc, Bishop beam, Rook tracks, Queen star, King rings, Invalid pulse)
      if (trailEffectsRef.current.length > 0) {
        const remainingEffects: typeof trailEffectsRef.current = [];
        for (const eff of trailEffectsRef.current) {
          const t = Math.min(1, (now - eff.startTime) / eff.duration);
          const baseOp = eff.baseOpacity ?? 0.85;

          if (eff.kind === 'arrival' || eff.kind === 'promotion') {
            const expand = 0.75 + t * 0.65;
            eff.mesh.scale.set(expand, expand, 1);
          } else if (eff.kind === 'invalid') {
            const pulse = 1 + Math.sin(t * Math.PI * 2) * 0.08;
            eff.mesh.scale.set(pulse, pulse, 1);
          }

          const op = t < 0.2 ? (t / 0.2) * baseOp : (1 - (t - 0.2) / 0.8) * baseOp;
          eff.mesh.traverse((child) => {
            const mat = (child as THREE.Mesh).material as THREE.Material | undefined;
            if (mat && 'opacity' in mat) {
              mat.opacity = Math.max(0, op);
            }
          });

          if (t < 1) {
            remainingEffects.push(eff);
          } else {
            eff.mesh.parent?.remove(eff.mesh);
          }
        }
        trailEffectsRef.current = remainingEffects;
      }

      // 5. Continuous Subtle Breathing Pulse for Selected Aura, Legal Move Dots & Check Ring
      if (highlightsGroupRef.current && !prefersReducedMotion) {
        const pulse = 0.5 + 0.5 * Math.sin(now * 0.006);
        highlightsGroupRef.current.children.forEach((child) => {
          const pType = child.userData?.pulseType;
          if (pType === 'selectionRing') {
            const s = 0.96 + pulse * 0.08;
            child.scale.set(s, s, 1);
          } else if (pType === 'legalOrb') {
            const s = 0.92 + pulse * 0.14;
            child.scale.set(s, s, 1);
          } else if (pType === 'checkRing') {
            const checkPulse = 0.5 + 0.5 * Math.sin(now * 0.01);
            const s = 0.94 + checkPulse * 0.16;
            child.scale.set(s, s, 1);
            const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
            if (mat) mat.opacity = 0.55 + checkPulse * 0.4;
          }
        });
      }

      renderer.render(scene, camera);
      if (IS_SOFTWARE_GL) {
        afterDraw(animate);
      } else {
        frameId = requestAnimationFrame(animate);
      }
    };
    animate();

    // ResizeObserver automatically centers and scales the 3D board across mobile and desktop viewports
    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current || !cameraRef.current) return;
      const newW = mountRef.current.clientWidth;
      const newH = mountRef.current.clientHeight;
      if (newW > 0 && newH > 0) {
        const aspect = newW / newH;
        cameraRef.current.aspect = aspect;
        cameraRef.current.fov = computeEffectiveFov(aspect);
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(newW, newH);
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(container);
    window.addEventListener('resize', handleResize);

    return () => {
      isDisposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('contextmenu', onContextMenu);
      activeAnimsRef.current = [];
      fadingCapturesRef.current = [];
      trailEffectsRef.current = [];
      pieceMeshesBySquareRef.current.clear();
      piecesGroupRef.current = null;
      highlightsGroupRef.current = null;
      effectsGroupRef.current = null;
      hoverHighlightMeshRef.current = null;
      envTarget.dispose();
      renderer.dispose();
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, [is3DView, boardTheme, graphicsQuality]);

  // --------------------------------------------------------------------
  // 2D MODE: FLAT BOARD + REAL INTERACTIVE 3D CHESS PIECES OVERLAY (!is3DView)
  // --------------------------------------------------------------------
  useEffect(() => {
    boardFlippedRef.current = boardFlipped;
    rebuild3DPieces();
    if (!is3DViewRef.current) {
      rebuild2DMode3DPieces();
    }
  }, [boardFlipped]);

  useEffect(() => {
    if (is3DView || !mount2DPiecesRef.current) return;

    const container = mount2DPiecesRef.current;
    const width = container.clientWidth || 392;
    const height = container.clientHeight || 392;

    const scene = new THREE.Scene();
    scene.background = null;

    // Orthographic camera (-4..+4 in X and Z) maps each of the 8x8 flat squares
    // with 100% pixel-exact alignment to world coordinates (col - 3.5, row - 3.5)
    const camera = new THREE.OrthographicCamera(-4, 4, 4, -4, 0.1, 50);
    camera.up.set(0, 0, -1);
    camera.position.set(0, 18, 0);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: !IS_SOFTWARE_GL,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(width, height);
    const maxDpr = IS_SOFTWARE_GL
      ? 1.0
      : graphicsQuality === 'quality'
        ? Math.min(window.devicePixelRatio || 1, 2.0)
        : graphicsQuality === 'balanced'
          ? Math.min(window.devicePixelRatio || 1, 1.5)
          : 1.0;
    renderer.setPixelRatio(maxDpr);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;

    container.innerHTML = '';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.pointerEvents = 'none';
    container.appendChild(renderer.domElement);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmremGenerator.dispose();

    // Studio Lighting for Sculpted 3D Pieces over the Flat 2D Board
    const ambientLight = new THREE.AmbientLight(0xdbeafe, 0.72);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xfffbeb, 0x091326, 0.85);
    hemiLight.position.set(0, 18, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 2.25);
    keyLight.position.set(4.5, 16.0, 9.5);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x00e5ff, 1.38);
    rimLight.position.set(-9.5, 11.5, -6.0);
    scene.add(rimLight);

    const goldFillLight = new THREE.DirectionalLight(0xfbbf24, 1.08);
    goldFillLight.position.set(8.5, 9.5, 10.0);
    scene.add(goldFillLight);

    const piecesGroup = new THREE.Group();
    scene.add(piecesGroup);
    pieces2DGroupRef.current = piecesGroup;

    const effectsGroup = new THREE.Group();
    scene.add(effectsGroup);
    effects2DGroupRef.current = effectsGroup;

    rebuild2DMode3DPieces();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 392;
      const h = container.clientHeight || 392;
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);
    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(container);

    let frameId = 0;
    let isDisposed = false;
    const gl = renderer.getContext() as WebGL2RenderingContext | WebGLRenderingContext;
    const isWebGL2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;

    const renderFrame = () => {
      if (isDisposed) return;
      const now = performance.now();

      // 1. Update active 3D piece move trajectories (smooth glide + raised Knight jump arc)
      const activeAnims = active2D3DAnimsRef.current;
      const animatingMeshes = new Set<THREE.Object3D>();

      if (activeAnims.length > 0) {
        for (let i = activeAnims.length - 1; i >= 0; i--) {
          const anim = activeAnims[i];
          const rawT = Math.min(1, (now - anim.startTime) / anim.duration);
          const easeT = 1 - Math.pow(1 - rawT, 3);
          const pos = new THREE.Vector3().lerpVectors(anim.fromPos, anim.toPos, easeT);

          let liftY = 0;
          let scaleBoost = 1.0;
          let pitchTilt = 0;
          let bankRoll = 0;

          if (anim.pieceType === 'n') {
            const jumpSin = Math.sin(rawT * Math.PI);
            liftY = Math.pow(jumpSin, 0.82) * 0.95;
            scaleBoost = 1.0 + jumpSin * 0.22;
            pitchTilt = Math.sin(rawT * Math.PI * 2) * 0.16;
            bankRoll = Math.sin(rawT * Math.PI) * 0.1;
          } else if (anim.pieceType === 'q') {
            const glideSin = Math.sin(rawT * Math.PI);
            liftY = glideSin * 0.26;
            scaleBoost = 1.0 + glideSin * 0.12;
            pitchTilt = Math.sin(rawT * Math.PI * 2) * 0.05;
          } else {
            const glideSin = Math.sin(rawT * Math.PI);
            liftY = glideSin * 0.22;
            scaleBoost = 1.0 + glideSin * 0.1;
            pitchTilt = Math.sin(rawT * Math.PI * 2) * 0.04;
          }

          if (anim.isPromotion) {
            scaleBoost += Math.sin(rawT * Math.PI) * 0.18;
          }

          pos.y = 0.06 + liftY;
          anim.mesh.position.copy(pos);
          anim.mesh.scale.setScalar(scaleBoost);
          anim.mesh.rotation.x = pitchTilt;
          anim.mesh.rotation.z = bankRoll;
          animatingMeshes.add(anim.mesh);

          if (rawT >= 1) {
            anim.mesh.position.copy(anim.toPos);
            anim.mesh.scale.setScalar(1.0);
            anim.mesh.rotation.x = 0;
            anim.mesh.rotation.z = 0;
            activeAnims.splice(i, 1);
          }
        }
      }

      // 2. Update 3D capture fade-out & scale-down animations
      const fadingCaptures = fading2D3DCapturesRef.current;
      if (fadingCaptures.length > 0 && effects2DGroupRef.current) {
        for (let i = fadingCaptures.length - 1; i >= 0; i--) {
          const cap = fadingCaptures[i];
          const t = Math.min(1, (now - cap.startTime) / cap.duration);
          const fadeAlpha = Math.pow(1 - t, 1.5);
          cap.mesh.scale.setScalar(Math.max(0.01, 1 - t * 0.48));
          cap.mesh.position.y = 0.06 + t * 0.22;
          cap.mesh.traverse((child) => {
            if (child instanceof THREE.Mesh && child.material) {
              child.material.opacity = fadeAlpha * 0.9;
            }
          });
          cap.ring.scale.setScalar(0.75 + t * 1.15);
          (cap.ring.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.85;

          if (t >= 1) {
            effects2DGroupRef.current.remove(cap.mesh);
            effects2DGroupRef.current.remove(cap.ring);
            fadingCaptures.splice(i, 1);
          }
        }
      }

      // 3. Apply Selection Lift & Live Drag-and-Drop 3D Tracking
      const currentSelected = selectedSquareRef.current;
      const dragState = drag2DPieceStateRef.current;

      piece2DMeshesBySquareRef.current.forEach((mesh, sq) => {
        if (animatingMeshes.has(mesh)) return;

        const basePos = squareTo2DWorldPos(sq, boardFlippedRef.current);

        if (dragState && dragState.active && dragState.square === sq) {
          mesh.position.x += (dragState.worldX - mesh.position.x) * 0.45;
          mesh.position.z += (dragState.worldZ - mesh.position.z) * 0.45;
          mesh.position.y += (0.38 - mesh.position.y) * 0.35;
          const nextScale = mesh.scale.x + (1.14 - mesh.scale.x) * 0.3;
          mesh.scale.setScalar(nextScale);
        } else if (sq === currentSelected) {
          const hoverBob = Math.sin(now * 0.005) * 0.025;
          mesh.position.x += (basePos.x - mesh.position.x) * 0.28;
          mesh.position.z += ((basePos.z - 0.08) - mesh.position.z) * 0.28;
          mesh.position.y += (0.28 + hoverBob - mesh.position.y) * 0.25;
          const nextScale = mesh.scale.x + (1.09 - mesh.scale.x) * 0.25;
          mesh.scale.setScalar(nextScale);
        } else {
          mesh.position.x += (basePos.x - mesh.position.x) * 0.28;
          mesh.position.z += (basePos.z - mesh.position.z) * 0.28;
          mesh.position.y += (0.06 - mesh.position.y) * 0.25;
          const nextScale = mesh.scale.x + (1.0 - mesh.scale.x) * 0.25;
          mesh.scale.setScalar(nextScale);
        }
      });

      renderer.render(scene, camera);

      if (IS_SOFTWARE_GL && isWebGL2) {
        const wgl2 = gl as WebGL2RenderingContext;
        const sync = wgl2.fenceSync(wgl2.SYNC_GPU_COMMANDS_COMPLETE, 0);
        wgl2.flush();
        const pollFence = () => {
          if (isDisposed) {
            if (sync) wgl2.deleteSync(sync);
            return;
          }
          if (!sync) {
            frameId = window.setTimeout(renderFrame, 16);
            return;
          }
          const status = wgl2.clientWaitSync(sync, 0, 0);
          if (status === wgl2.ALREADY_SIGNALED || status === wgl2.CONDITION_SATISFIED) {
            wgl2.deleteSync(sync);
            frameId = window.setTimeout(renderFrame, 8);
          } else {
            frameId = window.setTimeout(pollFence, 12);
          }
        };
        frameId = window.setTimeout(pollFence, 12);
      } else {
        frameId = requestAnimationFrame(renderFrame);
      }
    };

    renderFrame();

    return () => {
      isDisposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      active2D3DAnimsRef.current = [];
      fading2D3DCapturesRef.current = [];
      piece2DMeshesBySquareRef.current.clear();
      pieces2DGroupRef.current = null;
      effects2DGroupRef.current = null;
      envTarget.dispose();
      renderer.dispose();
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, [is3DView, boardFlipped, graphicsQuality, mount2DReady]);

  const updateCameraPosition = (camera: THREE.PerspectiveCamera, flipped: boolean) => {
    const theta = flipped ? Math.PI : 0;
    const phi = 0.215;
    const radius = 21.2;
    sphericalRef.current = { radius, theta, phi };
    camera.position.set(
      radius * Math.sin(phi) * Math.sin(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.cos(theta)
    );
    camera.lookAt(0, -0.05, flipped ? -0.14 : 0.14);
  };

  // Spawn a subtle restrained invalid-move square feedback pulse on the 3D board
  const spawnInvalidMovePulse = (square: Square) => {
    const effGroup = effectsGroupRef.current;
    if (!effGroup) return;
    const f = FILES.indexOf(square[0]);
    const r = RANKS.indexOf(square[1]);
    if (f < 0 || r < 0) return;

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.36, 0.46, 4),
      new THREE.MeshBasicMaterial({
        color: 0xf43f5e,
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.rotation.z = Math.PI / 4;
    ring.position.set(f - 3.5, 0.08, 3.5 - r);
    effGroup.add(ring);
    trailEffectsRef.current.push({
      mesh: ring,
      startTime: performance.now(),
      duration: 280,
      kind: 'invalid',
      baseOpacity: 0.65,
    });
  };

  // Spawn piece-type-specific 3D movement trail & arrival signature matching Reference Image 2
  const spawnPieceMoveSignature3D = (
    fromVec: THREE.Vector3,
    toVec: THREE.Vector3,
    pieceType: string,
    isPromotion: boolean
  ) => {
    const effGroup = effectsGroupRef.current;
    if (!effGroup) return;
    const now = performance.now();

    const trailContainer = new THREE.Group();
    const arrivalContainer = new THREE.Group();
    arrivalContainer.position.set(toVec.x, 0.078, toVec.z);

    if (pieceType === 'n') {
      // Knight: Glowing electric-blue curved L-arc trail + dual landing rings
      const dx = toVec.x - fromVec.x;
      const dz = toVec.z - fromVec.z;
      const midX = Math.abs(dx) >= Math.abs(dz) ? fromVec.x + dx * 0.72 : fromVec.x + dx * 0.18;
      const midZ = Math.abs(dx) >= Math.abs(dz) ? fromVec.z + dz * 0.18 : fromVec.z + dz * 0.72;

      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(fromVec.x, 0.08, fromVec.z),
        new THREE.Vector3(midX, 0.12, midZ),
        new THREE.Vector3(toVec.x, 0.08, toVec.z),
      ]);
      const tubeGeo = new THREE.TubeGeometry(curve, 24, 0.036, 8, false);
      const tubeMat = new THREE.MeshBasicMaterial({
        color: 0x00d8ff,
        transparent: true,
        opacity: 0.78,
      });
      trailContainer.add(new THREE.Mesh(tubeGeo, tubeMat));

      const ring1 = new THREE.Mesh(
        new THREE.RingGeometry(0.32, 0.42, 32),
        new THREE.MeshBasicMaterial({
          color: 0x00d8ff,
          transparent: true,
          opacity: 0.85,
          side: THREE.DoubleSide,
        })
      );
      ring1.rotation.x = -Math.PI / 2;
      arrivalContainer.add(ring1);
    } else if (pieceType === 'b') {
      // Bishop: Sleek diagonal cyan laser trail + diamond chevron arrival ring
      const dist = Math.hypot(toVec.x - fromVec.x, toVec.z - fromVec.z);
      const angle = Math.atan2(toVec.x - fromVec.x, toVec.z - fromVec.z);
      const beam = new THREE.Mesh(
        new THREE.PlaneGeometry(0.07, dist),
        new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.7,
          side: THREE.DoubleSide,
        })
      );
      beam.rotation.x = -Math.PI / 2;
      beam.rotation.z = -angle;
      beam.position.set((fromVec.x + toVec.x) / 2, 0.076, (fromVec.z + toVec.z) / 2);
      trailContainer.add(beam);

      const diamondRing = new THREE.Mesh(
        new THREE.RingGeometry(0.33, 0.42, 4),
        new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.85,
          side: THREE.DoubleSide,
        })
      );
      diamondRing.rotation.x = -Math.PI / 2;
      arrivalContainer.add(diamondRing);
    } else if (pieceType === 'r') {
      // Rook: Twin parallel precision slide tracks + fortress square arrival frame
      const dist = Math.hypot(toVec.x - fromVec.x, toVec.z - fromVec.z);
      const angle = Math.atan2(toVec.x - fromVec.x, toVec.z - fromVec.z);
      for (const offset of [-0.14, 0.14]) {
        const track = new THREE.Mesh(
          new THREE.PlaneGeometry(0.04, dist),
          new THREE.MeshBasicMaterial({
            color: 0x00d0ff,
            transparent: true,
            opacity: 0.68,
            side: THREE.DoubleSide,
          })
        );
        track.rotation.x = -Math.PI / 2;
        track.rotation.z = -angle;
        track.position.set(
          (fromVec.x + toVec.x) / 2 + Math.cos(angle) * offset,
          0.076,
          (fromVec.z + toVec.z) / 2 - Math.sin(angle) * offset
        );
        trailContainer.add(track);
      }

      const sqRing = new THREE.Mesh(
        new THREE.RingGeometry(0.36, 0.45, 4),
        new THREE.MeshBasicMaterial({
          color: 0x00d8ff,
          transparent: true,
          opacity: 0.85,
          side: THREE.DoubleSide,
        })
      );
      sqRing.rotation.x = -Math.PI / 2;
      sqRing.rotation.z = Math.PI / 4;
      arrivalContainer.add(sqRing);
    } else if (pieceType === 'q') {
      // Queen: Luminous royal glide ribbon + 8-ray radiant starburst halo on arrival
      const dist = Math.hypot(toVec.x - fromVec.x, toVec.z - fromVec.z);
      const angle = Math.atan2(toVec.x - fromVec.x, toVec.z - fromVec.z);
      const ribbon = new THREE.Mesh(
        new THREE.PlaneGeometry(0.11, dist),
        new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.65,
          side: THREE.DoubleSide,
        })
      );
      ribbon.rotation.x = -Math.PI / 2;
      ribbon.rotation.z = -angle;
      ribbon.position.set((fromVec.x + toVec.x) / 2, 0.076, (fromVec.z + toVec.z) / 2);
      trailContainer.add(ribbon);

      const qRing = new THREE.Mesh(
        new THREE.RingGeometry(0.32, 0.43, 32),
        new THREE.MeshBasicMaterial({
          color: 0x00e5ff,
          transparent: true,
          opacity: 0.9,
          side: THREE.DoubleSide,
        })
      );
      qRing.rotation.x = -Math.PI / 2;
      arrivalContainer.add(qRing);

      for (let i = 0; i < 4; i++) {
        const ray = new THREE.Mesh(
          new THREE.PlaneGeometry(0.045, 0.92),
          new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.75,
            side: THREE.DoubleSide,
          })
        );
        ray.rotation.x = -Math.PI / 2;
        ray.rotation.z = (i * Math.PI) / 4;
        arrivalContainer.add(ray);
      }
    } else if (pieceType === 'k') {
      // King: Dual-concentric sovereign gold + electric-blue aura rings
      const outerGold = new THREE.Mesh(
        new THREE.RingGeometry(0.38, 0.46, 36),
        new THREE.MeshBasicMaterial({
          color: 0xfbbf24,
          transparent: true,
          opacity: 0.9,
          side: THREE.DoubleSide,
        })
      );
      outerGold.rotation.x = -Math.PI / 2;
      arrivalContainer.add(outerGold);

      const innerBlue = new THREE.Mesh(
        new THREE.RingGeometry(0.28, 0.35, 36),
        new THREE.MeshBasicMaterial({
          color: 0x00d8ff,
          transparent: true,
          opacity: 0.85,
          side: THREE.DoubleSide,
        })
      );
      innerBlue.rotation.x = -Math.PI / 2;
      arrivalContainer.add(innerBlue);
    } else {
      // Pawn: Clean, crisp landing ring
      const pRing = new THREE.Mesh(
        new THREE.RingGeometry(0.28, 0.37, 28),
        new THREE.MeshBasicMaterial({
          color: isPromotion ? 0xfbbf24 : 0x38bdf8,
          transparent: true,
          opacity: 0.8,
          side: THREE.DoubleSide,
        })
      );
      pRing.rotation.x = -Math.PI / 2;
      arrivalContainer.add(pRing);
    }

    if (trailContainer.children.length > 0) {
      effGroup.add(trailContainer);
      trailEffectsRef.current.push({
        mesh: trailContainer,
        startTime: now,
        duration: 460,
        kind: 'trail',
        baseOpacity: 0.78,
      });
    }

    if (arrivalContainer.children.length > 0) {
      effGroup.add(arrivalContainer);
      trailEffectsRef.current.push({
        mesh: arrivalContainer,
        startTime: now,
        duration: isPromotion ? 620 : 480,
        kind: isPromotion ? 'promotion' : 'arrival',
        baseOpacity: 0.88,
      });
    }
  };

  // Convert a chess square (e.g. 'e4') to 2D-mode Orthographic 3D world coordinates (-3.5..+3.5)
  const squareTo2DWorldPos = (sqName: string, flipped: boolean): THREE.Vector3 => {
    const f = FILES.indexOf(sqName[0]);
    const r = 7 - RANKS.indexOf(sqName[1]);
    const col = flipped ? 7 - f : f;
    const row = flipped ? 7 - r : r;
    return new THREE.Vector3(col - 3.5, 0.06, row - 3.5);
  };

  // Rebuild and animate real 3D chess piece models on the flat 2D board (!is3DView)
  const rebuild2DMode3DPieces = (animatedMove?: {
    from: string;
    to: string;
    pieceType?: string;
    flags?: string;
    captured?: string | null;
  }) => {
    const group = pieces2DGroupRef.current;
    if (!group) return;

    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }
    piece2DMeshesBySquareRef.current.clear();

    const flipped = boardFlippedRef.current;

    // White Pieces Palette: Warm Sculpted Pearl-Ivory + Burnished 24K Royal Gold + Glowing Cyan Inlays
    const whiteBodyMat = new THREE.MeshPhysicalMaterial({
      color: 0xeedcc0,
      roughness: 0.24,
      metalness: 0.14,
      clearcoat: 0.55,
      clearcoatRoughness: 0.16,
      envMapIntensity: 0.56,
    });
    const whiteGoldRingMat = new THREE.MeshStandardMaterial({
      color: 0xd99b26,
      roughness: 0.18,
      metalness: 0.88,
      emissive: 0x3d2402,
      emissiveIntensity: 0.18,
      envMapIntensity: 0.82,
    });

    // Black Pieces Palette: Deep Glossy Obsidian-Gunmetal + Glowing Electric-Blue Rings + 24K Gold Crowns/Crosses
    const blackBodyMat = new THREE.MeshPhysicalMaterial({
      color: 0x0c1322,
      roughness: 0.18,
      metalness: 0.68,
      clearcoat: 0.85,
      clearcoatRoughness: 0.12,
      envMapIntensity: 0.68,
    });
    const blackNeonBlueRingMat = new THREE.MeshStandardMaterial({
      color: 0x1ed6ff,
      emissive: 0x00a8ff,
      emissiveIntensity: 1.85,
      roughness: 0.12,
      metalness: 0.45,
    });
    const cyanEnergyInlayMat = new THREE.MeshStandardMaterial({
      color: 0x67e8f9,
      emissive: 0x00d8ff,
      emissiveIntensity: 2.3,
      roughness: 0.08,
      metalness: 0.2,
    });

    active2D3DAnimsRef.current = [];

    let castlingRookAnim: { from: string; to: string } | null = null;
    if (animatedMove?.flags) {
      const rank = animatedMove.to[1];
      if (animatedMove.flags.includes('k')) {
        castlingRookAnim = { from: `h${rank}`, to: `f${rank}` };
      } else if (animatedMove.flags.includes('q')) {
        castlingRookAnim = { from: `a${rank}`, to: `d${rank}` };
      }
    }

    // Smooth 3D capture fade-out on the flat 2D board
    if (!is3DViewRef.current && animatedMove?.captured && effects2DGroupRef.current) {
      const isEnPassant = Boolean(animatedMove.flags?.includes('e'));
      const capSq = isEnPassant
        ? `${animatedMove.to[0]}${animatedMove.from[1]}`
        : animatedMove.to;
      const capVec = squareTo2DWorldPos(capSq, flipped);
      const movingPiece = chessRef.current.get(animatedMove.to as Square);
      const capturedIsWhite = movingPiece ? movingPiece.color === 'b' : false;

      const cloneTransparent = (mat: THREE.Material) => {
        const cloned = mat.clone();
        cloned.transparent = true;
        cloned.opacity = 0.9;
        return cloned;
      };

      const ghostMesh = createPieceMesh(
        animatedMove.captured.toLowerCase(),
        capturedIsWhite,
        cloneTransparent(capturedIsWhite ? whiteBodyMat : blackBodyMat),
        cloneTransparent(capturedIsWhite ? whiteGoldRingMat : blackNeonBlueRingMat),
        cloneTransparent(whiteGoldRingMat),
        cloneTransparent(cyanEnergyInlayMat),
        false
      );
      ghostMesh.position.copy(capVec);
      effects2DGroupRef.current.add(ghostMesh);

      const capRing = new THREE.Mesh(
        new THREE.RingGeometry(0.28, 0.44, 32),
        new THREE.MeshBasicMaterial({
          color: 0x00d8ff,
          transparent: true,
          opacity: 0.85,
          side: THREE.DoubleSide,
        })
      );
      capRing.rotation.x = -Math.PI / 2;
      capRing.position.set(capVec.x, 0.02, capVec.z);
      effects2DGroupRef.current.add(capRing);

      fading2D3DCapturesRef.current.push({
        mesh: ghostMesh,
        ring: capRing,
        startTime: performance.now(),
        duration: 390,
      });
    }

    const pieceDurationMap: Record<string, number> = {
      p: 255,
      n: 400,
      b: 310,
      r: 320,
      q: 350,
      k: 360,
    };

    const isCheckmateState = chessRef.current.isCheckmate();
    const defeatedTurn = chessRef.current.turn();

    const contactShadowGeo = new THREE.CircleGeometry(0.41, 32);
    const contactShadowMat = new THREE.MeshBasicMaterial({
      color: 0x02050c,
      transparent: true,
      opacity: 0.46,
      depthWrite: false,
    });

    const board = chessRef.current.board();
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const piece = board[r][f];
        if (piece) {
          const sqName = `${FILES[f]}${RANKS[7 - r]}`;
          const isWhite = piece.color === 'w';
          const pieceMesh = createPieceMesh(
            piece.type,
            isWhite,
            isWhite ? whiteBodyMat : blackBodyMat,
            isWhite ? whiteGoldRingMat : blackNeonBlueRingMat,
            whiteGoldRingMat,
            cyanEnergyInlayMat,
            false
          );

          // Grounding contact shadow disc beneath each 3D piece on the flat 2D square
          const shadowDisc = new THREE.Mesh(contactShadowGeo, contactShadowMat);
          shadowDisc.rotation.x = -Math.PI / 2;
          shadowDisc.scale.set(1.02, 0.78, 1.0);
          shadowDisc.position.set(0, 0.004, 0.17);
          pieceMesh.add(shadowDisc);

          pieceMesh.userData = { square: sqName, isPiece: true };

          if (isCheckmateState && piece.type === 'k' && piece.color === defeatedTurn) {
            const inner = pieceMesh.children[0];
            if (inner) {
              inner.rotation.z = 0.22;
            }
          }

          const targetVec = squareTo2DWorldPos(sqName, flipped);

          if (!is3DViewRef.current && animatedMove && animatedMove.to === sqName) {
            const startVec = squareTo2DWorldPos(animatedMove.from, flipped);
            const movingType = (animatedMove.pieceType || piece.type).toLowerCase();
            const isPromotion = Boolean(animatedMove.flags?.includes('p'));

            pieceMesh.position.copy(startVec);
            active2D3DAnimsRef.current.push({
              mesh: pieceMesh,
              fromPos: startVec,
              toPos: targetVec,
              pieceType: movingType,
              startTime: performance.now(),
              duration: pieceDurationMap[movingType] || 310,
              isPromotion,
            });
          } else if (!is3DViewRef.current && castlingRookAnim && castlingRookAnim.to === sqName) {
            const startVec = squareTo2DWorldPos(castlingRookAnim.from, flipped);
            pieceMesh.position.copy(startVec);
            active2D3DAnimsRef.current.push({
              mesh: pieceMesh,
              fromPos: startVec,
              toPos: targetVec,
              pieceType: 'r',
              startTime: performance.now(),
              duration: 330,
            });
          } else {
            pieceMesh.position.copy(targetVec);
          }

          piece2DMeshesBySquareRef.current.set(sqName, pieceMesh);
          group.add(pieceMesh);
        }
      }
    }
  };

  const rebuild3DPieces = (animatedMove?: {
    from: string;
    to: string;
    pieceType?: string;
    flags?: string;
    captured?: string | null;
  }) => {
    rebuild2DMode3DPieces(animatedMove);
    const group = piecesGroupRef.current;
    if (!group) return;

    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }
    pieceMeshesBySquareRef.current.clear();

    // White Pieces Palette: Warm Sculpted Pearl-Ivory + Burnished 24K Royal Gold + Glowing Cyan Inlays
    const whiteBodyMat = new THREE.MeshPhysicalMaterial({
      color: 0xeedcc0,
      roughness: 0.25,
      metalness: 0.14,
      clearcoat: 0.52,
      clearcoatRoughness: 0.18,
      envMapIntensity: 0.52,
    });
    const whiteGoldRingMat = new THREE.MeshStandardMaterial({
      color: 0xd99b26,
      roughness: 0.18,
      metalness: 0.88,
      emissive: 0x3d2402,
      emissiveIntensity: 0.16,
      envMapIntensity: 0.8,
    });

    // Black Pieces Palette: Deep Glossy Obsidian-Gunmetal + Glowing Electric-Blue Rings + 24K Gold Crowns/Crosses
    const blackBodyMat = new THREE.MeshPhysicalMaterial({
      color: 0x0c1322,
      roughness: 0.18,
      metalness: 0.68,
      clearcoat: 0.85,
      clearcoatRoughness: 0.12,
      envMapIntensity: 0.65,
    });
    const blackNeonBlueRingMat = new THREE.MeshStandardMaterial({
      color: 0x1ed6ff,
      emissive: 0x00a8ff,
      emissiveIntensity: 1.85,
      roughness: 0.12,
      metalness: 0.45,
    });
    const cyanEnergyInlayMat = new THREE.MeshStandardMaterial({
      color: 0x67e8f9,
      emissive: 0x00d8ff,
      emissiveIntensity: 2.3,
      roughness: 0.08,
      metalness: 0.2,
    });

    activeAnimsRef.current = [];

    // Detect castling rook coordinates if animatedMove was kingside ('k') or queenside ('q') castling
    let castlingRookAnim: { from: string; to: string } | null = null;
    if (animatedMove?.flags) {
      const rank = animatedMove.to[1];
      if (animatedMove.flags.includes('k')) {
        castlingRookAnim = { from: `h${rank}`, to: `f${rank}` };
      } else if (animatedMove.flags.includes('q')) {
        castlingRookAnim = { from: `a${rank}`, to: `d${rank}` };
      }
    }

    // Trigger Smooth 3D Capture Fade-Out Animation ("Capture Animation: Smooth fade effect")
    // Handles both standard captures on `animatedMove.to` and en-passant captures on `${to[0]}${from[1]}`
    if (is3DViewRef.current && animatedMove?.captured && effectsGroupRef.current) {
      const isEnPassant = Boolean(animatedMove.flags?.includes('e'));
      const capSq = isEnPassant
        ? `${animatedMove.to[0]}${animatedMove.from[1]}`
        : animatedMove.to;
      const capF = FILES.indexOf(capSq[0]);
      const capR = 7 - RANKS.indexOf(capSq[1]);

      // Determine the color of the captured piece (opposite of the moving piece currently at `animatedMove.to`)
      const movingPiece = chessRef.current.get(animatedMove.to as Square);
      const capturedIsWhite = movingPiece ? movingPiece.color === 'b' : false;

      const cloneTransparent = (mat: THREE.Material) => {
        const cloned = mat.clone();
        cloned.transparent = true;
        cloned.opacity = 0.9;
        return cloned;
      };

      const ghostMesh = createPieceMesh(
        animatedMove.captured.toLowerCase(),
        capturedIsWhite,
        cloneTransparent(capturedIsWhite ? whiteBodyMat : blackBodyMat),
        cloneTransparent(capturedIsWhite ? whiteGoldRingMat : blackNeonBlueRingMat),
        cloneTransparent(whiteGoldRingMat),
        cloneTransparent(cyanEnergyInlayMat),
        boardFlipped
      );
      const dispCapF = boardFlipped ? 7 - capF : capF;
      const dispCapR = boardFlipped ? 7 - capR : capR;
      ghostMesh.position.set(dispCapF - 3.5, 0.07, dispCapR - 3.5);
      effectsGroupRef.current.add(ghostMesh);

      const capRing = new THREE.Mesh(
        new THREE.RingGeometry(0.28, 0.44, 32),
        new THREE.MeshBasicMaterial({
          color: 0x00d8ff,
          transparent: true,
          opacity: 0.85,
          side: THREE.DoubleSide,
        })
      );
      capRing.rotation.x = -Math.PI / 2;
      capRing.position.set(dispCapF - 3.5, 0.082, dispCapR - 3.5);
      effectsGroupRef.current.add(capRing);

      fadingCapturesRef.current.push({
        mesh: ghostMesh,
        ring: capRing,
        startTime: performance.now(),
        duration: 420,
      });
    }

    const pieceDurationMap: Record<string, number> = {
      p: 245,
      n: 390,
      b: 305,
      r: 315,
      q: 345,
      k: 360,
    };

    const isCheckmateState = chessRef.current.isCheckmate();
    const defeatedTurn = chessRef.current.turn();

    const board = chessRef.current.board();
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const piece = board[r][f];
        if (piece) {
          const sqName = `${FILES[f]}${RANKS[7 - r]}`;
          const isWhite = piece.color === 'w';
          const pieceMesh = createPieceMesh(
            piece.type,
            isWhite,
            isWhite ? whiteBodyMat : blackBodyMat,
            isWhite ? whiteGoldRingMat : blackNeonBlueRingMat,
            whiteGoldRingMat,
            cyanEnergyInlayMat,
            boardFlipped
          );
          pieceMesh.userData = { square: sqName, isPiece: true };
          pieceMesh.traverse((child) => {
            child.userData = { square: sqName, isPiece: true };
          });

          // Subtle checkmate defeated-king tilt (without obscuring the board)
          if (isCheckmateState && piece.type === 'k' && piece.color === defeatedTurn) {
            const inner = pieceMesh.children[0];
            if (inner) {
              inner.rotation.z = 0.22;
            }
          }

          const dispF = boardFlipped ? 7 - f : f;
          const dispR = boardFlipped ? 7 - r : r;
          const targetVec = new THREE.Vector3(dispF - 3.5, 0.07, dispR - 3.5);

          if (is3DViewRef.current && animatedMove && animatedMove.to === sqName) {
            const fromF = FILES.indexOf(animatedMove.from[0]);
            const fromR = 7 - RANKS.indexOf(animatedMove.from[1]);
            const dispFromF = boardFlipped ? 7 - fromF : fromF;
            const dispFromR = boardFlipped ? 7 - fromR : fromR;
            const startVec = new THREE.Vector3(dispFromF - 3.5, 0.07, dispFromR - 3.5);
            const movingType = (animatedMove.pieceType || piece.type).toLowerCase();
            const isPromotion = Boolean(animatedMove.flags?.includes('p'));

            pieceMesh.position.copy(startVec);
            activeAnimsRef.current.push({
              mesh: pieceMesh,
              fromPos: startVec,
              toPos: targetVec,
              pieceType: movingType,
              startTime: performance.now(),
              duration: pieceDurationMap[movingType] || 300,
              isPromotion,
            });
            spawnPieceMoveSignature3D(startVec, targetVec, movingType, isPromotion);
          } else if (is3DViewRef.current && castlingRookAnim && castlingRookAnim.to === sqName) {
            const fromF = FILES.indexOf(castlingRookAnim.from[0]);
            const fromR = 7 - RANKS.indexOf(castlingRookAnim.from[1]);
            const dispFromF = boardFlipped ? 7 - fromF : fromF;
            const dispFromR = boardFlipped ? 7 - fromR : fromR;
            const startVec = new THREE.Vector3(dispFromF - 3.5, 0.07, dispFromR - 3.5);
            pieceMesh.position.copy(startVec);
            activeAnimsRef.current.push({
              mesh: pieceMesh,
              fromPos: startVec,
              toPos: targetVec,
              pieceType: 'r',
              startTime: performance.now(),
              duration: 325,
            });
            spawnPieceMoveSignature3D(startVec, targetVec, 'r', false);
          } else {
            pieceMesh.position.copy(targetVec);
          }

          pieceMeshesBySquareRef.current.set(sqName, pieceMesh);
          group.add(pieceMesh);
        }
      }
    }
  };

  // Sculpted Cyber-Luxury 3D Chess Pieces matching the Reference Image
  const createPieceMesh = (
    type: string,
    isWhite: boolean,
    bodyMat: THREE.Material,
    ringMat: THREE.Material,
    goldCrownMat: THREE.Material,
    cyanInlayMat: THREE.Material,
    flipped: boolean
  ): THREE.Group => {
    const outerGroup = new THREE.Group();
    if (flipped) {
      outerGroup.rotation.y = Math.PI;
    }

    // Inner presentation group pitched toward the fixed overhead-front camera (-0.74 rad around X)
    // so each piece's circular stepped base sits near the bottom of its square while its vertical
    // sculpted torso, collar, and crown rise toward the top of its square facing the viewer—matching
    // the exact perspective and proportions of the reference image without overlapping adjacent squares.
    const group = new THREE.Group();
    group.position.set(0, 0.02, 0.19);
    group.rotation.x = -0.74;
    group.scale.set(0.92, 0.78, 0.92);
    outerGroup.add(group);

    // Subtle dark bronze/obsidian shadow groove material so White pieces have bold contrast on light squares
    const grooveShadowMat = new THREE.MeshStandardMaterial({
      color: isWhite ? 0x4a3108 : 0x050811,
      roughness: 0.4,
      metalness: 0.6,
    });

    // 1. Shared Monumental Stepped Pedestal Base with Double Accent Rings
    const baseScale =
      type === 'k'
        ? 1.03
        : type === 'q'
          ? 1.01
          : type === 'p'
            ? 0.92
            : 0.97;

    const baseProfile = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.41 * baseScale, 0.0),
      new THREE.Vector2(0.41 * baseScale, 0.048),
      new THREE.Vector2(0.385 * baseScale, 0.068),
      new THREE.Vector2(0.38 * baseScale, 0.115),
      new THREE.Vector2(0.34 * baseScale, 0.16),
      new THREE.Vector2(0.31 * baseScale, 0.21),
      new THREE.Vector2(0.0, 0.21),
    ];
    const pedestalGeo = new THREE.LatheGeometry(baseProfile, 40);
    const pedestalMesh = new THREE.Mesh(pedestalGeo, bodyMat);
    pedestalMesh.castShadow = true;
    pedestalMesh.receiveShadow = true;
    group.add(pedestalMesh);

    // Dark shadow plinth rim at very bottom so White bases pop sharply against light marble tiles
    const bottomShadowRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.412 * baseScale, 0.016, 12, 44),
      grooveShadowMat
    );
    bottomShadowRim.rotation.x = Math.PI / 2;
    bottomShadowRim.position.y = 0.018;
    group.add(bottomShadowRim);

    // Outer bottom metallic/neon ring
    const lowerBaseRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.398 * baseScale, 0.024, 16, 44),
      ringMat
    );
    lowerBaseRing.rotation.x = Math.PI / 2;
    lowerBaseRing.position.y = 0.055;
    group.add(lowerBaseRing);

    // Second stepped pedestal ring
    const upperBaseRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.332 * baseScale, 0.021, 16, 44),
      ringMat
    );
    upperBaseRing.rotation.x = Math.PI / 2;
    upperBaseRing.position.y = 0.17;
    group.add(upperBaseRing);

    switch (type) {
      case 'p': {
        // Concave Lathe Stem
        const pawnStemPts = [
          new THREE.Vector2(0.0, 0.19),
          new THREE.Vector2(0.285, 0.19),
          new THREE.Vector2(0.23, 0.31),
          new THREE.Vector2(0.18, 0.44),
          new THREE.Vector2(0.165, 0.55),
          new THREE.Vector2(0.205, 0.59),
          new THREE.Vector2(0.0, 0.59),
        ];
        const stem = new THREE.Mesh(new THREE.LatheGeometry(pawnStemPts, 36), bodyMat);
        stem.castShadow = true;
        group.add(stem);

        // Bold Glowing/Gold Neck Collar + Shadow Seam
        const collarShadow = new THREE.Mesh(
          new THREE.TorusGeometry(0.208, 0.014, 12, 36),
          grooveShadowMat
        );
        collarShadow.rotation.x = Math.PI / 2;
        collarShadow.position.y = 0.575;
        group.add(collarShadow);

        const collarPlate = new THREE.Mesh(
          new THREE.CylinderGeometry(0.225, 0.215, 0.05, 36),
          ringMat
        );
        collarPlate.position.y = 0.605;
        group.add(collarPlate);

        const collarTorus = new THREE.Mesh(
          new THREE.TorusGeometry(0.222, 0.024, 16, 36),
          ringMat
        );
        collarTorus.rotation.x = Math.PI / 2;
        collarTorus.position.y = 0.605;
        group.add(collarTorus);

        // Large High-Gloss Spherical Head
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.242, 36, 36), bodyMat);
        head.position.y = 0.82;
        head.castShadow = true;
        group.add(head);
        break;
      }

      case 'r': {
        // Tapered Fortress Tower Column
        const towerPts = [
          new THREE.Vector2(0.0, 0.19),
          new THREE.Vector2(0.31, 0.19),
          new THREE.Vector2(0.275, 0.38),
          new THREE.Vector2(0.255, 0.58),
          new THREE.Vector2(0.285, 0.68),
          new THREE.Vector2(0.0, 0.68),
        ];
        const tower = new THREE.Mesh(new THREE.LatheGeometry(towerPts, 36), bodyMat);
        tower.castShadow = true;
        group.add(tower);

        // 8 Sharp Vertical Armor Flutes/Ribs on Tower Shaft
        for (let i = 0; i < 8; i++) {
          const angle = (i * Math.PI) / 4;
          const rib = new THREE.Mesh(
            new THREE.BoxGeometry(0.048, 0.42, 0.048),
            bodyMat
          );
          rib.position.set(Math.sin(angle) * 0.26, 0.43, Math.cos(angle) * 0.26);
          rib.rotation.y = angle;
          group.add(rib);
        }

        // Upper Turret Cornice Collar Ring
        const turretCollar = new THREE.Mesh(
          new THREE.TorusGeometry(0.298, 0.026, 16, 40),
          ringMat
        );
        turretCollar.rotation.x = Math.PI / 2;
        turretCollar.position.y = 0.69;
        group.add(turretCollar);

        // Turret Crown Drum
        const turretDrum = new THREE.Mesh(
          new THREE.CylinderGeometry(0.345, 0.305, 0.14, 36),
          bodyMat
        );
        turretDrum.position.y = 0.77;
        turretDrum.castShadow = true;
        group.add(turretDrum);

        const turretGoldRim = new THREE.Mesh(
          new THREE.TorusGeometry(0.342, 0.018, 14, 40),
          ringMat
        );
        turretGoldRim.rotation.x = Math.PI / 2;
        turretGoldRim.position.y = 0.835;
        group.add(turretGoldRim);

        // 6 Bold Sharp-Cornered Rectangular Battlements (Merlons)
        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI) / 3 + Math.PI / 6;
          const merlonGroup = new THREE.Group();
          merlonGroup.rotation.y = angle;

          const merlon = new THREE.Mesh(
            new THREE.BoxGeometry(0.15, 0.15, 0.105),
            bodyMat
          );
          merlon.position.set(0, 0.91, 0.285);
          merlon.castShadow = true;
          merlonGroup.add(merlon);

          if (isWhite) {
            const merlonGoldCap = new THREE.Mesh(
              new THREE.BoxGeometry(0.154, 0.024, 0.108),
              goldCrownMat
            );
            merlonGoldCap.position.set(0, 0.99, 0.285);
            merlonGroup.add(merlonGoldCap);
          }

          group.add(merlonGroup);
        }
        break;
      }

      case 'n': {
        // Lower Knight Pedestal Collar
        const knightCollar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.285, 0.315, 0.11, 36),
          bodyMat
        );
        knightCollar.position.y = 0.245;
        knightCollar.castShadow = true;
        group.add(knightCollar);

        const knightNeckRing = new THREE.Mesh(
          new THREE.TorusGeometry(0.292, 0.023, 16, 36),
          ringMat
        );
        knightNeckRing.rotation.x = Math.PI / 2;
        knightNeckRing.position.y = 0.295;
        group.add(knightNeckRing);

        // 3/4 Profile Warhorse Head & Mane Group (oriented so side profile & glowing eye face viewer)
        const horseGroup = new THREE.Group();
        horseGroup.position.y = 0.29;
        horseGroup.rotation.y = -0.22;
        group.add(horseGroup);

        // Sculpted Angular Warhorse Profile (ExtrudeGeometry with sharp bevels)
        const horseShape = new THREE.Shape();
        horseShape.moveTo(-0.22, 0.0);
        horseShape.lineTo(0.22, 0.0);
        // Chest & throat arch
        horseShape.bezierCurveTo(0.27, 0.16, 0.24, 0.34, 0.14, 0.44);
        // Under-jaw & chin
        horseShape.lineTo(0.24, 0.41);
        horseShape.lineTo(0.35, 0.44);
        // Angular muzzle & nose bridge
        horseShape.lineTo(0.39, 0.53);
        horseShape.lineTo(0.25, 0.68);
        // Sharp brow ridge & forehead
        horseShape.lineTo(0.16, 0.77);
        // Forward pointed ear
        horseShape.lineTo(0.13, 0.91);
        horseShape.lineTo(0.03, 0.81);
        // Crown & sweeping arched mane crest
        horseShape.bezierCurveTo(-0.15, 0.78, -0.31, 0.56, -0.28, 0.28);
        horseShape.lineTo(-0.22, 0.0);

        const extrudeOpts = {
          steps: 1,
          depth: 0.18,
          bevelEnabled: true,
          bevelThickness: 0.045,
          bevelSize: 0.038,
          bevelSegments: 2,
        };
        const horseGeo = new THREE.ExtrudeGeometry(horseShape, extrudeOpts);
        horseGeo.center();
        const horseMesh = new THREE.Mesh(horseGeo, bodyMat);
        horseMesh.position.set(0.03, 0.42, 0);
        horseMesh.castShadow = true;
        horseGroup.add(horseMesh);

        // Chiseled Cheek & Neck Armor Plates on Both Sides
        const cheekShape = new THREE.Shape();
        cheekShape.moveTo(-0.14, 0.05);
        cheekShape.lineTo(0.14, 0.08);
        cheekShape.lineTo(0.19, 0.34);
        cheekShape.lineTo(0.08, 0.54);
        cheekShape.lineTo(-0.12, 0.46);
        cheekShape.closePath();

        const cheekGeo = new THREE.ExtrudeGeometry(cheekShape, {
          steps: 1,
          depth: 0.25,
          bevelEnabled: true,
          bevelThickness: 0.025,
          bevelSize: 0.02,
          bevelSegments: 1,
        });
        cheekGeo.center();
        const cheekMesh = new THREE.Mesh(cheekGeo, bodyMat);
        cheekMesh.position.set(-0.01, 0.34, 0);
        horseGroup.add(cheekMesh);

        // Burnished Gold Brow & Jaw Armor Trim on White Knights so b1/g1 have sharp silhouette contrast
        if (isWhite) {
          const snoutBridgeTrim = new THREE.Mesh(
            new THREE.BoxGeometry(0.22, 0.028, 0.14),
            goldCrownMat
          );
          snoutBridgeTrim.position.set(0.24, 0.59, 0);
          snoutBridgeTrim.rotation.z = -0.68;
          horseGroup.add(snoutBridgeTrim);

          const chestTrim = new THREE.Mesh(
            new THREE.BoxGeometry(0.035, 0.32, 0.16),
            goldCrownMat
          );
          chestTrim.position.set(0.19, 0.22, 0);
          chestTrim.rotation.z = 0.18;
          horseGroup.add(chestTrim);
        }

        // Twin Sharp Pointed Ears with Gold/Metallic Inner Tips
        for (const zSide of [-0.075, 0.075]) {
          const ear = new THREE.Mesh(
            new THREE.ConeGeometry(0.05, 0.17, 4),
            bodyMat
          );
          ear.position.set(0.06, 0.87, zSide);
          ear.rotation.z = -0.18;
          ear.rotation.y = Math.PI / 4;
          horseGroup.add(ear);

          const earTip = new THREE.Mesh(
            new THREE.ConeGeometry(0.032, 0.1, 4),
            goldCrownMat
          );
          earTip.position.set(0.07, 0.91, zSide);
          earTip.rotation.z = -0.18;
          earTip.rotation.y = Math.PI / 4;
          horseGroup.add(earTip);
        }

        // Segmented Mane Crest Blades along Back of Neck
        for (let m = 0; m < 5; m++) {
          const t = m / 4;
          const maneBlade = new THREE.Mesh(
            new THREE.BoxGeometry(0.12, 0.11, 0.14),
            isWhite ? goldCrownMat : bodyMat
          );
          maneBlade.position.set(-0.15 - Math.sin(t * 1.4) * 0.06, 0.74 - m * 0.13, 0);
          maneBlade.rotation.z = 0.45 + t * 0.35;
          horseGroup.add(maneBlade);
        }

        // Sculpted Eye Sockets + Glowing Cyan Eyes & Armor Seam Grooves on Both Sides
        for (const zSide of [-1, 1]) {
          const eyeSocket = new THREE.Mesh(
            new THREE.BoxGeometry(0.076, 0.04, 0.022),
            grooveShadowMat
          );
          eyeSocket.position.set(0.15, 0.62, zSide * 0.136);
          eyeSocket.rotation.z = -0.35;
          horseGroup.add(eyeSocket);

          const eye = new THREE.Mesh(
            new THREE.BoxGeometry(0.06, 0.026, 0.024),
            cyanInlayMat
          );
          eye.position.set(0.15, 0.62, zSide * 0.142);
          eye.rotation.z = -0.35;
          horseGroup.add(eye);

          // Glowing cyan neck armor seam line
          const seamLine = new THREE.Mesh(
            new THREE.BoxGeometry(0.026, 0.36, 0.022),
            cyanInlayMat
          );
          seamLine.position.set(0.02, 0.32, zSide * 0.156);
          seamLine.rotation.z = -0.28;
          horseGroup.add(seamLine);
        }
        break;
      }

      case 'b': {
        // Contoured Lathe Column
        const bishopStemPts = [
          new THREE.Vector2(0.0, 0.19),
          new THREE.Vector2(0.295, 0.19),
          new THREE.Vector2(0.24, 0.34),
          new THREE.Vector2(0.195, 0.49),
          new THREE.Vector2(0.225, 0.58),
          new THREE.Vector2(0.0, 0.58),
        ];
        const stem = new THREE.Mesh(new THREE.LatheGeometry(bishopStemPts, 36), bodyMat);
        stem.castShadow = true;
        group.add(stem);

        // Bold Double Neck Collar Ring
        const neckCollar = new THREE.Mesh(
          new THREE.TorusGeometry(0.232, 0.025, 16, 36),
          ringMat
        );
        neckCollar.rotation.x = Math.PI / 2;
        neckCollar.position.y = 0.59;
        group.add(neckCollar);

        const goldSubCollar = new THREE.Mesh(
          new THREE.TorusGeometry(0.218, 0.015, 14, 36),
          goldCrownMat
        );
        goldSubCollar.rotation.x = Math.PI / 2;
        goldSubCollar.position.y = 0.625;
        group.add(goldSubCollar);

        // Pointed Gothic Mitre Head (Lathe Ogive Profile)
        const mitrePts = [
          new THREE.Vector2(0.0, 0.62),
          new THREE.Vector2(0.21, 0.63),
          new THREE.Vector2(0.245, 0.76),
          new THREE.Vector2(0.22, 0.90),
          new THREE.Vector2(0.14, 1.03),
          new THREE.Vector2(0.04, 1.12),
          new THREE.Vector2(0.0, 1.14),
        ];
        const mitre = new THREE.Mesh(new THREE.LatheGeometry(mitrePts, 36), bodyMat);
        mitre.castShadow = true;
        group.add(mitre);

        // Glowing Electric-Blue V-Chevron Energy Inlay on Front of Mitre (matching reference c8, f8, c1, f1)
        for (const side of [-1, 1]) {
          const chevronArm = new THREE.Mesh(
            new THREE.BoxGeometry(0.032, 0.17, 0.032),
            cyanInlayMat
          );
          chevronArm.position.set(side * 0.048, 0.86, 0.225);
          chevronArm.rotation.z = side * 0.42;
          chevronArm.rotation.x = -0.18;
          group.add(chevronArm);
        }

        // Golden Finial Orb & Pointed Tip
        const finialOrb = new THREE.Mesh(
          new THREE.SphereGeometry(0.055, 20, 20),
          goldCrownMat
        );
        finialOrb.position.y = 1.165;
        group.add(finialOrb);
        break;
      }

      case 'q': {
        // Fluted Royal Column Torso
        const queenTorsoPts = [
          new THREE.Vector2(0.0, 0.19),
          new THREE.Vector2(0.31, 0.19),
          new THREE.Vector2(0.25, 0.38),
          new THREE.Vector2(0.21, 0.56),
          new THREE.Vector2(0.24, 0.72),
          new THREE.Vector2(0.27, 0.77),
          new THREE.Vector2(0.0, 0.77),
        ];
        const torso = new THREE.Mesh(new THREE.LatheGeometry(queenTorsoPts, 40), bodyMat);
        torso.castShadow = true;
        group.add(torso);

        // Mid-waist glowing/gold ring
        const waistRing = new THREE.Mesh(
          new THREE.TorusGeometry(0.242, 0.02, 14, 36),
          ringMat
        );
        waistRing.rotation.x = Math.PI / 2;
        waistRing.position.y = 0.42;
        group.add(waistRing);

        // Upper Royal Collar Ring
        const upperCollar = new THREE.Mesh(
          new THREE.TorusGeometry(0.278, 0.025, 16, 40),
          ringMat
        );
        upperCollar.rotation.x = Math.PI / 2;
        upperCollar.position.y = 0.77;
        group.add(upperCollar);

        // Golden Royal Coronet Base Band
        const coronetCup = new THREE.Mesh(
          new THREE.CylinderGeometry(0.325, 0.245, 0.15, 36),
          goldCrownMat
        );
        coronetCup.position.y = 0.86;
        coronetCup.castShadow = true;
        group.add(coronetCup);

        // 8 Sharp Pointed Coronet Spikes + Golden Pearls + Glowing Cyan Crown Gems
        for (let i = 0; i < 8; i++) {
          const angle = (i * Math.PI) / 4;
          const rSpike = 0.295;
          const sx = Math.sin(angle) * rSpike;
          const sz = Math.cos(angle) * rSpike;

          const spike = new THREE.Mesh(
            new THREE.ConeGeometry(0.055, 0.17, 4),
            goldCrownMat
          );
          spike.position.set(sx, 0.99, sz);
          spike.rotation.y = angle + Math.PI / 4;
          group.add(spike);

          const pearl = new THREE.Mesh(
            new THREE.SphereGeometry(0.034, 14, 14),
            goldCrownMat
          );
          pearl.position.set(sx * 1.03, 1.08, sz * 1.03);
          group.add(pearl);

          // Glowing cyan jewel set into front-facing crown facets
          const jewel = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.03, 0),
            cyanInlayMat
          );
          jewel.position.set(Math.sin(angle) * 0.31, 0.86, Math.cos(angle) * 0.31);
          group.add(jewel);
        }

        // Inner Royal Dome + Small Golden Cross Finial (matching d8 & d1 in reference)
        const innerDome = new THREE.Mesh(
          new THREE.SphereGeometry(0.205, 28, 20),
          bodyMat
        );
        innerDome.position.y = 0.93;
        group.add(innerDome);

        const qCrossV = new THREE.Mesh(
          new THREE.BoxGeometry(0.058, 0.17, 0.058),
          goldCrownMat
        );
        qCrossV.position.y = 1.155;
        group.add(qCrossV);

        const qCrossH = new THREE.Mesh(
          new THREE.BoxGeometry(0.145, 0.055, 0.058),
          goldCrownMat
        );
        qCrossH.position.y = 1.17;
        group.add(qCrossH);
        break;
      }

      case 'k': {
        // Monumental Royal Torso
        const kingTorsoPts = [
          new THREE.Vector2(0.0, 0.19),
          new THREE.Vector2(0.325, 0.19),
          new THREE.Vector2(0.265, 0.40),
          new THREE.Vector2(0.23, 0.60),
          new THREE.Vector2(0.265, 0.77),
          new THREE.Vector2(0.295, 0.82),
          new THREE.Vector2(0.0, 0.82),
        ];
        const torso = new THREE.Mesh(new THREE.LatheGeometry(kingTorsoPts, 40), bodyMat);
        torso.castShadow = true;
        group.add(torso);

        // 8 Vertical Armor Flutes on King Torso
        for (let i = 0; i < 8; i++) {
          const angle = (i * Math.PI) / 4;
          const rib = new THREE.Mesh(
            new THREE.BoxGeometry(0.045, 0.48, 0.045),
            bodyMat
          );
          rib.position.set(Math.sin(angle) * 0.245, 0.50, Math.cos(angle) * 0.245);
          rib.rotation.y = angle;
          group.add(rib);
        }

        // Mid-torso ring + Wide Upper Royal Collar Ring
        const midRing = new THREE.Mesh(
          new THREE.TorusGeometry(0.258, 0.02, 14, 36),
          ringMat
        );
        midRing.rotation.x = Math.PI / 2;
        midRing.position.y = 0.44;
        group.add(midRing);

        const upperCollar = new THREE.Mesh(
          new THREE.TorusGeometry(0.298, 0.026, 16, 40),
          ringMat
        );
        upperCollar.rotation.x = Math.PI / 2;
        upperCollar.position.y = 0.82;
        group.add(upperCollar);

        // Beveled Royal Crown Housing
        const crownCup = new THREE.Mesh(
          new THREE.CylinderGeometry(0.345, 0.265, 0.18, 16),
          bodyMat
        );
        crownCup.position.y = 0.92;
        crownCup.castShadow = true;
        group.add(crownCup);

        // Golden Crown Rim Band + Crown Points
        const goldCrownBand = new THREE.Mesh(
          new THREE.CylinderGeometry(0.352, 0.335, 0.068, 16),
          goldCrownMat
        );
        goldCrownBand.position.y = 1.01;
        group.add(goldCrownBand);

        for (let i = 0; i < 8; i++) {
          const angle = (i * Math.PI) / 4;
          const jewel = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.032, 0),
            cyanInlayMat
          );
          jewel.position.set(Math.sin(angle) * 0.348, 1.01, Math.cos(angle) * 0.348);
          group.add(jewel);
        }

        // Inner Golden Dome
        const crownDome = new THREE.Mesh(
          new THREE.SphereGeometry(0.235, 28, 20),
          goldCrownMat
        );
        crownDome.position.y = 1.01;
        group.add(crownDome);

        // Bold, Sharp-Cornered 3D Golden Latin Cross at Apex (matching e8 & e1 in reference)
        const crossBase = new THREE.Mesh(
          new THREE.CylinderGeometry(0.068, 0.088, 0.06, 16),
          goldCrownMat
        );
        crossBase.position.y = 1.16;
        group.add(crossBase);

        const crossV = new THREE.Mesh(
          new THREE.BoxGeometry(0.09, 0.26, 0.068),
          goldCrownMat
        );
        crossV.position.y = 1.295;
        crossV.castShadow = true;
        group.add(crossV);

        const crossH = new THREE.Mesh(
          new THREE.BoxGeometry(0.23, 0.084, 0.068),
          goldCrownMat
        );
        crossH.position.y = 1.315;
        crossH.castShadow = true;
        group.add(crossH);
        break;
      }
    }

    return outerGroup;
  };

  // Find King Square when in Check
  const checkKingSquare = useMemo(() => {
    if (!gameState.isCheck) return null;
    const b = chessRef.current.board();
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const p = b[r][f];
        if (p && p.type === 'k' && p.color === gameState.turn) {
          return `${FILES[f]}${RANKS[7 - r]}`;
        }
      }
    }
    return null;
  }, [gameState]);

  const rebuildHighlights = () => {
    const group = highlightsGroupRef.current;
    if (!group) return;

    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }

    // 1. Selected piece square ("Piece Selected: Lifts up with glow" — square border + concentric aura ring)
    if (selectedSquare) {
      const f = FILES.indexOf(selectedSquare[0]);
      const r = RANKS.indexOf(selectedSquare[1]);

      const tile = new THREE.Mesh(
        new THREE.PlaneGeometry(0.95, 0.95),
        new THREE.MeshBasicMaterial({
          color: 0x00d8ff,
          opacity: 0.34,
          transparent: true,
          side: THREE.DoubleSide,
        })
      );
      tile.rotation.x = -Math.PI / 2;
      tile.position.set(f - 3.5, 0.072, 3.5 - r);
      group.add(tile);

      // Glowing electric-blue square border
      const sqBorder = new THREE.Mesh(
        new THREE.RingGeometry(0.61, 0.67, 4),
        new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.92,
          side: THREE.DoubleSide,
        })
      );
      sqBorder.rotation.x = -Math.PI / 2;
      sqBorder.rotation.z = Math.PI / 4;
      sqBorder.position.set(f - 3.5, 0.074, 3.5 - r);
      group.add(sqBorder);

      // Pulsing circular aura ring directly beneath the lifted piece
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.35, 0.45, 36),
        new THREE.MeshBasicMaterial({
          color: 0x00f0ff,
          transparent: true,
          opacity: 0.95,
          side: THREE.DoubleSide,
        })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(f - 3.5, 0.076, 3.5 - r);
      ring.userData = { pulseType: 'selectionRing' };
      group.add(ring);
    }

    // 2. Legal destination squares (glowing blue orbs & capture target rings)
    legalMoves.forEach((move) => {
      const dest = move.to as string;
      const f = FILES.indexOf(dest[0]);
      const r = RANKS.indexOf(dest[1]);
      const isCapture = move.captured !== undefined;

      if (isCapture) {
        const tile = new THREE.Mesh(
          new THREE.PlaneGeometry(0.92, 0.92),
          new THREE.MeshBasicMaterial({
            color: 0xf43f5e,
            opacity: 0.28,
            transparent: true,
            side: THREE.DoubleSide,
          })
        );
        tile.rotation.x = -Math.PI / 2;
        tile.position.set(f - 3.5, 0.072, 3.5 - r);
        group.add(tile);

        const capRing = new THREE.Mesh(
          new THREE.RingGeometry(0.36, 0.46, 32),
          new THREE.MeshBasicMaterial({
            color: 0xf43f5e,
            transparent: true,
            opacity: 0.92,
            side: THREE.DoubleSide,
          })
        );
        capRing.rotation.x = -Math.PI / 2;
        capRing.position.set(f - 3.5, 0.076, 3.5 - r);
        capRing.userData = { pulseType: 'legalOrb' };
        group.add(capRing);
      } else {
        // Soft outer cyan halo + bright inner glowing dot (matching Reference Image 2 legal move dots)
        const outerHalo = new THREE.Mesh(
          new THREE.CircleGeometry(0.22, 28),
          new THREE.MeshBasicMaterial({
            color: 0x00d0ff,
            transparent: true,
            opacity: 0.35,
            side: THREE.DoubleSide,
          })
        );
        outerHalo.rotation.x = -Math.PI / 2;
        outerHalo.position.set(f - 3.5, 0.073, 3.5 - r);
        outerHalo.userData = { pulseType: 'legalOrb' };
        group.add(outerHalo);

        const orb = new THREE.Mesh(
          new THREE.CircleGeometry(0.135, 28),
          new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.95,
            side: THREE.DoubleSide,
          })
        );
        orb.rotation.x = -Math.PI / 2;
        orb.position.set(f - 3.5, 0.076, 3.5 - r);
        orb.userData = { pulseType: 'legalOrb' };
        group.add(orb);
      }
    });

    // 3. Last move highlight (source and destination squares)
    if (lastMoveSquares) {
      const [from, to] = lastMoveSquares;
      [from, to].forEach((sq) => {
        const f = FILES.indexOf(sq[0]);
        const r = RANKS.indexOf(sq[1]);
        const mesh = new THREE.Mesh(
          new THREE.PlaneGeometry(0.94, 0.94),
          new THREE.MeshBasicMaterial({
            color: 0x00d8ff,
            opacity: 0.22,
            transparent: true,
            side: THREE.DoubleSide,
          })
        );
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(f - 3.5, 0.071, 3.5 - r);
        group.add(mesh);
      });
    }

    // 4. King in Check / Checkmate glowing crimson square + concentric pulsing rings
    if (checkKingSquare) {
      const f = FILES.indexOf(checkKingSquare[0]);
      const r = RANKS.indexOf(checkKingSquare[1]);
      const checkTile = new THREE.Mesh(
        new THREE.PlaneGeometry(0.96, 0.96),
        new THREE.MeshBasicMaterial({
          color: 0xef4444,
          opacity: 0.45,
          transparent: true,
          side: THREE.DoubleSide,
        })
      );
      checkTile.rotation.x = -Math.PI / 2;
      checkTile.position.set(f - 3.5, 0.072, 3.5 - r);
      group.add(checkTile);

      const checkOuterRing = new THREE.Mesh(
        new THREE.RingGeometry(0.39, 0.47, 36),
        new THREE.MeshBasicMaterial({
          color: 0xff2a4b,
          transparent: true,
          opacity: 0.92,
          side: THREE.DoubleSide,
        })
      );
      checkOuterRing.rotation.x = -Math.PI / 2;
      checkOuterRing.position.set(f - 3.5, 0.078, 3.5 - r);
      checkOuterRing.userData = { pulseType: 'checkRing' };
      group.add(checkOuterRing);

      const checkInnerRing = new THREE.Mesh(
        new THREE.RingGeometry(0.28, 0.34, 36),
        new THREE.MeshBasicMaterial({
          color: 0xfca5a5,
          transparent: true,
          opacity: 0.85,
          side: THREE.DoubleSide,
        })
      );
      checkInnerRing.rotation.x = -Math.PI / 2;
      checkInnerRing.position.set(f - 3.5, 0.079, 3.5 - r);
      checkInnerRing.userData = { pulseType: 'checkRing' };
      group.add(checkInnerRing);
    }
  };

  useEffect(() => {
    rebuildHighlights();
  }, [selectedSquare, legalMoves, lastMoveSquares, checkKingSquare]);

  const handleSquareSelection = (square: Square) => {
    if (gameState.isCheckmate || gameState.isDraw) return;
    if (isSubmittingMoveRef.current) return;

    if (mode === 'online' && room?.status === 'waiting') {
      setChatError('Waiting for opponent to accept the invitation and join the room.');
      return;
    }

    const currentTurn = chessRef.current.turn();
    const myColor =
      mode === 'ai'
        ? 'w'
        : room?.player_one_id === currentUser.id
          ? room.player_one_symbol
          : room?.player_two_symbol || 'w';

    if (currentTurn !== myColor) {
      spawnInvalidMovePulse(square);
      return;
    }

    const currentSelected = selectedSquareRef.current ?? selectedSquare;
    const currentLegalMoves =
      legalMovesRef.current.length > 0 ? legalMovesRef.current : legalMoves;

    // Clicking the already-selected square smoothly cancels the selection
    if (currentSelected === square) {
      selectedSquareRef.current = null;
      legalMovesRef.current = [];
      setSelectedSquare(null);
      setLegalMoves([]);
      if (mode === 'online' && room?.id) {
        wsService.send('board_highlight', { roomId: room.id, squares: null });
      }
      return;
    }

    const matchingMove = currentLegalMoves.find((m) => m.to === square);
    if (matchingMove && currentSelected) {
      if (matchingMove.promotion) {
        setPromotionPending({ from: currentSelected, to: square });
        return;
      }

      selectedSquareRef.current = null;
      legalMovesRef.current = [];
      setSelectedSquare(null);
      setLegalMoves([]);
      executeMove({ from: currentSelected, to: square });
      return;
    }

    const pieceAtSquare = chessRef.current.get(square);
    if (pieceAtSquare && pieceAtSquare.color === myColor) {
      const moves = chessRef.current.moves({ square, verbose: true });
      selectedSquareRef.current = square;
      legalMovesRef.current = moves;
      setSelectedSquare(square);
      setLegalMoves(moves);
      if (mode === 'online' && room?.id) {
        wsService.send('board_highlight', { roomId: room.id, squares: [square] });
      }
    } else {
      if (currentSelected || (pieceAtSquare && pieceAtSquare.color !== myColor)) {
        spawnInvalidMovePulse(square);
      }
      selectedSquareRef.current = null;
      legalMovesRef.current = [];
      setSelectedSquare(null);
      setLegalMoves([]);
      if (mode === 'online' && room?.id) {
        wsService.send('board_highlight', { roomId: room.id, squares: null });
      }
    }
  };

  handleSquareSelectionRef.current = handleSquareSelection;

  const handle2DPointerDown = (e: React.PointerEvent, sq: Square) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const piece = chessRef.current.get(sq);
    const myColor =
      mode === 'ai'
        ? 'w'
        : room?.player_one_id === currentUser.id
          ? room.player_one_symbol
          : room?.player_two_symbol || 'w';

    if (piece && piece.color === myColor && chessRef.current.turn() === myColor) {
      drag2DPieceStateRef.current = {
        square: sq,
        color: piece.color,
        type: piece.type,
        startClientX: e.clientX,
        startClientY: e.clientY,
        worldX: 0,
        worldZ: 0,
        active: false,
      };
    }
  };

  const handle2DPointerMove = (e: React.PointerEvent) => {
    const dragState = drag2DPieceStateRef.current;
    if (!dragState) return;

    const dx = e.clientX - dragState.startClientX;
    const dy = e.clientY - dragState.startClientY;
    if (!dragState.active && Math.hypot(dx, dy) > 6) {
      dragState.active = true;
      if (selectedSquareRef.current !== dragState.square) {
        handleSquareSelection(dragState.square);
      }
    }

    if (dragState.active) {
      setDragged2DPiece({
        square: dragState.square,
        color: dragState.color,
        type: dragState.type,
        clientX: e.clientX,
        clientY: e.clientY,
      });
    }
  };

  const handle2DPointerUp = (e: React.PointerEvent) => {
    const dragState = drag2DPieceStateRef.current;
    if (dragState && dragState.active) {
      const gridEl = grid2DContainerRef.current;
      if (gridEl) {
        const rect = gridEl.getBoundingClientRect();
        const u = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const v = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
        const col = Math.min(7, Math.max(0, Math.floor(u * 8)));
        const row = Math.min(7, Math.max(0, Math.floor(v * 8)));
        const flipped = boardFlippedRef.current;
        const fIdx = flipped ? 7 - col : col;
        const rIdx = flipped ? 7 - row : row;
        const destSq = `${FILES[fIdx]}${RANKS[7 - rIdx]}` as Square;
        if (destSq !== dragState.square) {
          handleSquareSelection(destSq);
        }
      }
    }
    drag2DPieceStateRef.current = null;
    setDragged2DPiece(null);
  };

  const executeMove = async (moveObj: { from: Square; to: Square; promotion?: string }) => {
    if (isSubmittingMoveRef.current) return;
    isSubmittingMoveRef.current = true;
    try {
      setChatError(null);
      if (mode === 'ai') {
        const result = chessRef.current.move(moveObj);
        if (!result) return;

        const newState = getChessState(chessRef.current);
        setGameState(newState);
        triggerMovePresentation(
          {
            from: moveObj.from,
            to: moveObj.to,
            pieceType: result.piece,
            color: result.color,
            flags: result.flags,
            captured: result.captured || null,
            promotion: result.promotion || null,
            san: result.san,
          },
          newState
        );
        rebuild3DPieces({
          from: moveObj.from,
          to: moveObj.to,
          pieceType: result.piece,
          flags: result.flags,
          captured: result.captured || null,
        });

        if (newState.isCheckmate) {
          confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
          return;
        }

        if (!newState.isCheckmate && !newState.isDraw) {
          setTimeout(() => {
            if (chessRef.current.turn() !== 'b') return;
            const aiMoveSan = getBestChessMove(chessRef.current, aiDifficulty);
            if (aiMoveSan) {
              const aiMoveObj = chessRef.current.move(aiMoveSan);
              if (aiMoveObj) {
                const updatedState = getChessState(chessRef.current);
                setGameState(updatedState);
                triggerMovePresentation(
                  {
                    from: aiMoveObj.from,
                    to: aiMoveObj.to,
                    pieceType: aiMoveObj.piece,
                    color: aiMoveObj.color,
                    flags: aiMoveObj.flags,
                    captured: aiMoveObj.captured || null,
                    promotion: aiMoveObj.promotion || null,
                    san: aiMoveObj.san,
                  },
                  updatedState
                );
                rebuild3DPieces({
                  from: aiMoveObj.from,
                  to: aiMoveObj.to,
                  pieceType: aiMoveObj.piece,
                  flags: aiMoveObj.flags,
                  captured: aiMoveObj.captured || null,
                });
              }
            }
          }, 550);
        }
      } else if (mode === 'online' && room) {
        const res = await api.submitMove(room.id, moveObj);
        syncRoomState(res.room);
      }
    } catch (err: any) {
      setChatError(err.message || 'Illegal chess move');
    } finally {
      isSubmittingMoveRef.current = false;
    }
  };

  const handlePromotionSelect = (piece: 'q' | 'r' | 'b' | 'n') => {
    if (!promotionPending) return;
    selectedSquareRef.current = null;
    legalMovesRef.current = [];
    setSelectedSquare(null);
    setLegalMoves([]);
    executeMove({
      from: promotionPending.from,
      to: promotionPending.to,
      promotion: piece,
    });
    setPromotionPending(null);
  };

  const handleDrawOffer = async () => {
    if (mode === 'online' && room) {
      try {
        const res = await api.roomAction(room.id, 'draw');
        syncRoomState(res.room);
      } catch (err: any) {
        setChatError(err.message || 'Failed to offer draw');
      }
    } else {
      handleRestart();
    }
  };

  const handleConfirmResign = async () => {
    setConfirmDialog(null);
    if (mode === 'online' && room) {
      try {
        const res = await api.roomAction(room.id, 'resign');
        syncRoomState(res.room);
      } catch (err: any) {
        setChatError(err.message || 'Failed to resign');
      }
    } else {
      handleRestart();
    }
  };

  const handleRestart = async () => {
    if (mode === 'ai') {
      chessRef.current.reset();
      setGameState(getChessState(chessRef.current));
      setSelectedSquare(null);
      setLegalMoves([]);
      setLastMoveSquares(null);
      setActive2DMove(null);
      setSpecialEffect(null);
      setWhiteTime(600);
      setBlackTime(600);
      rebuild3DPieces();
    } else if (mode === 'online' && room) {
      try {
        const res = await api.roomAction(room.id, 'rematch');
        syncRoomState(res.room);
      } catch (err: any) {
        setChatError(err.message || 'Failed to restart match');
      }
    }
  };

  const handleSendChat = async (e: React.FormEvent, quickEmoji?: string) => {
    e.preventDefault();
    const text = quickEmoji || chatInput.trim();
    if (!text || isSendingChat) return;
    if (!quickEmoji) setChatInput('');
    setChatError(null);

    if (room) {
      setIsSendingChat(true);
      try {
        const res = await api.sendRoomChat(room.id, text);
        appendUniqueChatMessage(res.message);
      } catch (err: any) {
        setChatError(err.message || 'Failed to send message');
      } finally {
        setIsSendingChat(false);
      }
    } else {
      // Local AI mode: display only the player's own message (NO automatic AI replies)
      const myMsg: RoomChatMessage = {
        id: `c-${Date.now()}`,
        sender_id: currentUser.id,
        sender_uid: currentUser.public_uid,
        sender_name: currentUser.username,
        content: text,
        created_at: new Date().toISOString(),
      };
      appendUniqueChatMessage(myMsg);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const formatMsgTimestamp = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const cycleTheme = () => {
    const order: BoardTheme[] = ['classic', 'cyber', 'royal'];
    const next = order[(order.indexOf(boardTheme) + 1) % order.length];
    setBoardTheme(next);
  };

  const symbolMap: Record<string, string> = {
    p: '♟',
    r: '♜',
    n: '♞',
    b: '♝',
    q: '♛',
    k: '♚',
  };

  // Shared Captured Pieces & Move History Content (used in Desktop collapsible panel & Mobile Drawer)
  const renderCapturedAndHistoryContent = () => (
    <>
      {/* Captured Pieces Card */}
      <div className="p-3 rounded-2xl bg-slate-950/90 border border-cyan-500/25 shadow-xl">
        <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-white mb-2">
          Captured Pieces
        </h5>
        <div className="space-y-1.5 text-xs">
          <div>
            <span className="text-[10px] text-slate-400 block">You (White)</span>
            <div className="flex flex-wrap gap-0.5 text-amber-200 text-sm min-h-[20px]">
              {gameState.capturedBlack.length === 0 ? (
                <span className="text-[10px] text-slate-600 italic">None yet</span>
              ) : (
                gameState.capturedBlack.map((p, idx) => (
                  <img
                    key={idx}
                    src={PIECE_IMAGE_MAP[`b${p.toLowerCase()}`]}
                    alt={p}
                    className="w-4 h-5 object-contain inline-block drop-shadow"
                  />
                ))
              )}
            </div>
          </div>
          <div className="pt-1 border-t border-slate-800/80">
            <span className="text-[10px] text-slate-400 block">Opponent (Black)</span>
            <div className="flex flex-wrap gap-1 text-cyan-300 text-sm min-h-[20px] items-center">
              {gameState.capturedWhite.length === 0 ? (
                <span className="text-[10px] text-slate-600 italic">None yet</span>
              ) : (
                gameState.capturedWhite.map((p, idx) => (
                  <img
                    key={idx}
                    src={PIECE_IMAGE_MAP[`w${p.toLowerCase()}`]}
                    alt={p}
                    className="w-4 h-5 object-contain inline-block drop-shadow"
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Move History Card */}
      <div className="flex-1 flex flex-col p-3 rounded-2xl bg-slate-950/90 border border-cyan-500/25 shadow-xl overflow-hidden min-h-[180px]">
        <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-800">
          <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-white">
            Move History
          </h5>
          <span className="text-[10px] font-mono text-cyan-400">
            {gameState.history.length} ply
          </span>
        </div>
        <div className="flex-1 overflow-y-auto space-y-1 font-mono text-[11px] pr-1">
          {gameState.history.length === 0 ? (
            <div className="text-slate-500 text-[11px] py-4 text-center">
              Click a white piece to make your opening move
            </div>
          ) : (
            Array.from({ length: Math.ceil(gameState.history.length / 2) }).map((_, i) => (
              <div
                key={i}
                className="px-2 py-1 rounded bg-slate-900/70 flex items-center justify-between"
              >
                <span className="text-slate-500 w-6">{i + 1}.</span>
                <span className="text-white font-bold flex-1">{gameState.history[i * 2]}</span>
                <span className="text-cyan-300 font-bold flex-1">
                  {gameState.history[i * 2 + 1] || '...'}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );

  // Ordered ranks/files for 2D mode respecting boardFlipped
  // Player 1 (White) -> boardFlipped=false -> rank 1 at bottom, files a..h left-to-right
  // Player 2 (Black) -> boardFlipped=true  -> rank 8 at bottom, files h..a left-to-right
  const displayRanks = boardFlipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const displayFiles = boardFlipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];

  const myAssignedColor: 'w' | 'b' =
    mode === 'ai'
      ? 'w'
      : room?.player_one_id === currentUser.id
        ? ((room.player_one_symbol as 'w' | 'b') || 'w')
        : room?.player_two_id === currentUser.id
          ? ((room.player_two_symbol as 'w' | 'b') || 'b')
          : 'w';

  const bottomPlayerIsWhite = !boardFlipped;
  const bottomPlayerTime = bottomPlayerIsWhite ? whiteTime : blackTime;
  const topPlayerTime = bottomPlayerIsWhite ? blackTime : whiteTime;
  const bottomPlayerTurn = bottomPlayerIsWhite ? gameState.turn === 'w' : gameState.turn === 'b';
  const topPlayerTurn = !bottomPlayerTurn;

  const bottomPlayerProfile =
    (bottomPlayerIsWhite && myAssignedColor === 'w') ||
      (!bottomPlayerIsWhite && myAssignedColor === 'b')
      ? {
        username: currentUser.username,
        public_uid: currentUser.public_uid,
        avatar_url:
          currentUser.avatar_url ||
          `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser.username}`,
        isMe: true,
        colorLabel: bottomPlayerIsWhite ? 'White (Bottom)' : 'Black (Bottom)',
        colorCode: bottomPlayerIsWhite ? ('w' as const) : ('b' as const),
      }
      : {
        username:
          mode === 'ai'
            ? `SaraQueen (${aiDifficulty})`
            : opponent?.username || 'Waiting for Opponent...',
        public_uid: opponent?.public_uid || '---',
        avatar_url:
          opponent?.avatar_url ||
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        isMe: false,
        colorLabel: bottomPlayerIsWhite ? 'White (Bottom)' : 'Black (Bottom)',
        colorCode: bottomPlayerIsWhite ? ('w' as const) : ('b' as const),
      };

  const topPlayerProfile =
    bottomPlayerProfile.isMe
      ? {
        username:
          mode === 'ai'
            ? `SaraQueen (${aiDifficulty})`
            : opponent?.username || 'Waiting for Opponent...',
        public_uid: opponent?.public_uid || '---',
        avatar_url:
          opponent?.avatar_url ||
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        isMe: false,
        colorLabel: bottomPlayerIsWhite ? 'Black (Top)' : 'White (Top)',
        colorCode: bottomPlayerIsWhite ? ('b' as const) : ('w' as const),
      }
      : {
        username: currentUser.username,
        public_uid: currentUser.public_uid,
        avatar_url:
          currentUser.avatar_url ||
          `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser.username}`,
        isMe: true,
        colorLabel: bottomPlayerIsWhite ? 'Black (Top)' : 'White (Top)',
        colorCode: bottomPlayerIsWhite ? ('b' as const) : ('w' as const),
      };

  return (
    <div
      ref={fullScreenRootRef}
      data-testid={isFullScreen ? 'chess-fullscreen-overlay' : 'chess-game-container'}
      data-fullscreen={isFullScreen ? 'true' : 'false'}
      className={
        isFullScreen
          ? 'fixed inset-0 z-[9999] w-screen h-[100dvh] bg-[#050811] flex items-center justify-center p-2 sm:p-4 overflow-hidden select-none'
          : 'flex-1 p-3 sm:p-5 pb-24 md:pb-6 max-w-[1440px] mx-auto flex flex-col xl:flex-row gap-5'
      }
    >
      {/* Top-Right Exit Full Screen Control (Visible Only in Full-Screen Chess Mode) */}
      {isFullScreen && (
        <button
          type="button"
          data-testid="exit-fullscreen-chess-btn"
          onClick={handleExitFullScreen}
          title="Exit Full Screen (Esc)"
          aria-label="Exit Full Screen"
          className="fixed top-3 right-3 sm:top-5 sm:right-5 z-[10000] px-3.5 py-2 rounded-xl bg-slate-900/95 hover:bg-slate-800 border border-cyan-400/50 text-white text-xs font-bold flex items-center gap-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.85)] transition-all active:scale-95"
        >
          <X className="w-4 h-4 text-cyan-400" />
          <span>Exit Full Screen</span>
        </button>
      )}

      {/* CSS Keyframes for smooth 2D piece movement, knight hops, and special move effects */}
      <style>{`
        @keyframes chess2dPieceGlide {
          0% {
            transform: translate(calc(var(--glide-dx, 0) * 100%), calc(var(--glide-dy, 0) * 100%)) scale(1.08);
            filter: drop-shadow(0 12px 16px rgba(34, 211, 238, 0.5));
          }
          55% {
            transform: translate(calc(var(--glide-dx, 0) * 20%), calc(var(--glide-dy, 0) * 20%)) scale(1.16);
          }
          100% {
            transform: translate(0%, 0%) scale(1);
            filter: drop-shadow(0 3px 5px rgba(0, 0, 0, 0.65));
          }
        }
        @keyframes chess2dKnightHop {
          0% {
            transform: translate(calc(var(--glide-dx, 0) * 100%), calc(var(--glide-dy, 0) * 100%)) scale(1.05);
          }
          50% {
            transform: translate(calc(var(--glide-dx, 0) * 42%), calc(var(--glide-dy, 0) * 42% - 14%)) scale(1.26) rotate(-6deg);
            filter: drop-shadow(0 18px 20px rgba(56, 189, 248, 0.65));
          }
          100% {
            transform: translate(0%, 0%) scale(1) rotate(0deg);
          }
        }
        @keyframes chess2dCaptureBurst {
          0% {
            transform: scale(0.45);
            opacity: 0.95;
          }
          70% {
            transform: scale(1.28);
            opacity: 0.55;
          }
          100% {
            transform: scale(1.55);
            opacity: 0;
          }
        }
        @keyframes chess2dPromoteAura {
          0% {
            transform: scale(0.6) rotate(0deg);
            opacity: 1;
          }
          60% {
            transform: scale(1.22) rotate(90deg);
            opacity: 0.85;
          }
          100% {
            transform: scale(1.45) rotate(180deg);
            opacity: 0;
          }
        }
      `}</style>

      {/* Main 3D / 2D Chess Arena Column */}
      <div
        className={
          isFullScreen
            ? 'w-full h-full flex items-center justify-center relative overflow-hidden'
            : 'flex-1 flex flex-col justify-between rounded-3xl bg-gradient-to-b from-[#0a1022]/95 via-[#070b16] to-[#0a0d1d]/95 border border-cyan-500/25 p-3 sm:p-5 shadow-2xl relative overflow-hidden'
        }
      >
        {/* Top Matchup Header Bar */}
        <div
          className={
            isFullScreen
              ? 'hidden'
              : 'grid grid-cols-1 lg:grid-cols-12 gap-3 items-center p-3 rounded-2xl bg-slate-950/85 border border-cyan-500/25 mb-3 z-10'
          }
        >
          {/* Left Player ("You") */}
          <div className="lg:col-span-5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={
                  currentUser.avatar_url ||
                  `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser.username}`
                }
                alt={currentUser.username}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser.username}`;
                }}
                className="w-11 h-11 rounded-full object-cover border-2 border-cyan-400 flex-shrink-0"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs sm:text-sm font-extrabold text-white truncate">
                    {currentUser.username}
                  </p>
                  <span
                    data-testid="my-color-badge"
                    className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${myAssignedColor === 'w'
                        ? 'bg-amber-200 text-slate-950'
                        : 'bg-indigo-950 text-cyan-300 border border-cyan-400/50'
                      }`}
                  >
                    {myAssignedColor === 'w' ? 'White' : 'Black'}
                  </span>
                </div>
                <p className="text-[10px] font-mono text-slate-400 truncate">
                  UID: {currentUser.public_uid}
                </p>
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Online
                </span>
              </div>
            </div>

            <div
              data-testid="white-clock-box"
              className={`px-3.5 py-1.5 rounded-xl border text-right transition-all ${gameState.turn === myAssignedColor
                  ? 'bg-cyan-950/80 border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.25)]'
                  : 'bg-slate-900/80 border-slate-800'
                }`}
            >
              <div className="flex items-center gap-1.5 font-mono text-sm sm:text-base font-black text-white">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                <span>{formatTime(myAssignedColor === 'w' ? whiteTime : blackTime)}</span>
              </div>
              <span className="block text-[10px] font-bold text-cyan-300">
                {mode === 'online' && room?.status === 'waiting'
                  ? 'Waiting for Join'
                  : gameState.turn === myAssignedColor
                    ? `• Your Turn (${myAssignedColor === 'w' ? 'White' : 'Black'})`
                    : 'Waiting'}
              </span>
            </div>
          </div>

          {/* Center Match Badge */}
          <div className="lg:col-span-2 flex flex-col items-center justify-center text-center py-1 border-y lg:border-y-0 lg:border-x border-slate-800/80 gap-1">
            <div className="flex items-center gap-1.5 text-cyan-400">
              <Crown className="w-4 h-4" />
              <span className="text-xs font-extrabold text-white">
                {mode === 'online' ? `${room?.max_players || 2}P Match` : 'Classic Match'}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">10 min • Synced</span>
          </div>

          {/* Right Player ("SaraQueen" or Opponent) */}
          <div className="lg:col-span-5 flex items-center justify-between gap-2">
            <div
              data-testid="black-clock-box"
              className={`px-3.5 py-1.5 rounded-xl border text-left transition-all ${gameState.turn !== myAssignedColor
                  ? 'bg-purple-950/80 border-purple-400 shadow-[0_0_15px_rgba(192,132,252,0.25)]'
                  : 'bg-slate-900/80 border-slate-800'
                }`}
            >
              <div className="flex items-center gap-1.5 font-mono text-sm sm:text-base font-black text-white">
                <Clock className="w-3.5 h-3.5 text-purple-400" />
                <span>{formatTime(myAssignedColor === 'w' ? blackTime : whiteTime)}</span>
              </div>
              <span className="block text-[10px] font-bold text-purple-300">
                {gameState.turn !== myAssignedColor
                  ? `• Opponent Turn (${myAssignedColor === 'w' ? 'Black' : 'White'})`
                  : 'Waiting'}
              </span>
            </div>

            <div className="flex items-center gap-3 min-w-0 text-right">
              <div className="min-w-0">
                <div className="flex items-center justify-end gap-1.5">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${myAssignedColor === 'w'
                        ? 'bg-indigo-950 text-cyan-300 border border-cyan-400/50'
                        : 'bg-amber-200 text-slate-950'
                      }`}
                  >
                    {myAssignedColor === 'w' ? 'Black' : 'White'}
                  </span>
                  <p className="text-xs sm:text-sm font-extrabold text-white truncate">
                    {mode === 'ai'
                      ? `SaraQueen (${aiDifficulty})`
                      : opponent?.username || 'Waiting for Opponent...'}
                  </p>
                </div>
                <p className="text-[10px] font-mono text-slate-400 truncate">
                  UID: {opponent?.public_uid || '---'}
                </p>
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
                  {mode === 'online' && room?.status === 'waiting' ? 'Invited' : 'Online'}{' '}
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                </span>
              </div>
              <img
                src={
                  opponent?.avatar_url ||
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
                }
                alt="Opponent"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.src = 'https://api.dicebear.com/7.x/bottts/svg?seed=SaraQueen';
                }}
                className="w-11 h-11 rounded-full object-cover border-2 border-purple-400 flex-shrink-0"
              />
            </div>
          </div>
        </div>

        {/* Chessboard Toolbar: Mode, Difficulty, Reset Camera, Flip Board, Show/Hide Panels, and Full Screen Button */}
        <div
          className={
            isFullScreen
              ? 'hidden'
              : 'flex flex-wrap items-center justify-between gap-2 mb-2.5 px-1 z-10'
          }
        >
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Mode Switcher */}
            <button
              type="button"
              onClick={() => {
                setMode('ai');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all ${mode === 'ai'
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/50'
                  : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white'
                }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>AI Mode</span>
            </button>

            {mode === 'ai' && (
              <div className="flex bg-slate-950 p-0.5 rounded-xl border border-slate-800">
                {(['easy', 'medium', 'hard'] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setAiDifficulty(d)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${aiDifficulty === d
                        ? 'bg-cyan-500 text-black'
                        : 'text-slate-400 hover:text-white'
                      }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            )}

            {/* Reset Camera Button (3D mode) */}
            {is3DView && (
              <button
                type="button"
                onClick={handleResetCamera}
                title="Reset 3D camera angle and zoom"
                className="px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-cyan-400/50 text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <Camera className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline">Reset Camera</span>
              </button>
            )}

            {/* Flip Board Button */}
            <button
              type="button"
              onClick={() => setBoardFlipped((f) => !f)}
              title="Flip board viewing orientation"
              className="px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-cyan-400/50 text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Flip Board</span>
            </button>
          </div>

          {/* Right Toolbar: Show/Hide Panels Toggle Button + Full Screen Button */}
          <div className="flex items-center gap-2">
            {/* Desktop Show/Hide Panels Button */}
            <button
              type="button"
              data-testid="toggle-panels-btn"
              onClick={() => setShowSidePanels((prev) => !prev)}
              title={
                showSidePanels
                  ? 'Hide Captured Pieces & Move History panels (Shortcut: P)'
                  : 'Show Captured Pieces & Move History panels (Shortcut: P)'
              }
              aria-expanded={showSidePanels}
              className={`hidden lg:flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${showSidePanels
                  ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/25'
                  : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-cyan-400'
                }`}
            >
              {showSidePanels ? (
                <>
                  <PanelRightClose className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Hide Panels</span>
                </>
              ) : (
                <>
                  <PanelRightOpen className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Show Panels</span>
                </>
              )}
            </button>

            {/* Mobile Panels Drawer Button */}
            <button
              type="button"
              data-testid="mobile-panels-btn"
              onClick={() => setShowMobilePanelsDrawer(true)}
              className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 text-xs font-bold"
            >
              <PanelRightOpen className="w-3.5 h-3.5" />
              <span>Panels</span>
            </button>

            {/* Full Screen Chessboard Button (Chess Only, Outside Board) */}
            <button
              type="button"
              data-testid="fullscreen-chess-btn"
              onClick={handleEnterFullScreen}
              title="Full Screen Chessboard Mode"
              aria-label="Full Screen"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/95 hover:bg-slate-800 text-cyan-300 border border-cyan-500/40 hover:border-cyan-400 text-xs font-bold transition-all shadow-sm"
            >
              <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>Full Screen</span>
            </button>
          </div>
        </div>

        {/* Center Board Area + Collapsible Captured Pieces & Move History Panels */}
        <div
          data-testid="chess-board-stage"
          style={
            isFullScreen
              ? {
                width: 'min(calc(100vw - 32px), calc(100dvh - 32px), 88dvh)',
                height: 'min(calc(100vw - 32px), calc(100dvh - 32px), 88dvh)',
                maxWidth: 'calc(100vw - 32px)',
                maxHeight: 'calc(100dvh - 32px)',
              }
              : undefined
          }
          className={
            isFullScreen
              ? 'relative aspect-square rounded-2xl overflow-hidden border-2 border-cyan-500/40 bg-[#060a16] shadow-[0_0_60px_rgba(0,0,0,0.95)] flex items-center justify-center'
              : 'relative flex-1 min-h-[370px] sm:min-h-[490px] rounded-2xl overflow-hidden border border-cyan-500/30 bg-[#060a16] flex items-stretch justify-between'
          }
        >
          {is3DView ? (
            <div
              key="chess-3d-view"
              className="relative w-full h-full flex-1 min-w-0 flex items-center justify-center transition-all duration-300"
            >
              <div
                ref={mountRef}
                data-testid="chess-3d-canvas"
                className={
                  isFullScreen
                    ? 'w-full h-full aspect-square cursor-pointer'
                    : 'w-full h-[380px] sm:h-[490px] cursor-pointer'
                }
              />
              {!isFullScreen && (
                <div className="absolute bottom-2.5 left-3 text-[10px] text-slate-400 bg-slate-950/75 px-2.5 py-1 rounded-lg border border-slate-800 pointer-events-none">
                  Tap, click, or drag a piece to make a legal move
                </div>
              )}
            </div>
          ) : (
            /* Professional Fixed 8x8 2D Chessboard Mode with Constant Base Square Colors,
               Transient Source/Destination Move Highlights, Smooth Piece Glide, and Top/Bottom Player Orientation */
            <div
              key="chess-2d-view"
              data-testid="chess-2d-board"
              data-perspective={bottomPlayerIsWhite ? 'white-bottom' : 'black-bottom'}
              className={
                isFullScreen
                  ? 'w-full h-full flex items-center justify-center'
                  : 'flex-1 p-2 sm:p-4 flex flex-col items-center justify-center gap-2'
              }
            >
              {/* Top Player Strip (Positioned above the 8x8 board, hidden in Full-Screen Mode) */}
              <div
                data-testid="board-top-player-bar"
                className={
                  isFullScreen
                    ? 'hidden'
                    : 'w-[296px] sm:w-[416px] px-3 py-1.5 rounded-xl bg-slate-950/90 border border-slate-800 flex items-center justify-between text-xs shadow-md'
                }
              >
                <div className="flex items-center gap-2 min-w-0">
                  <img
                    src={topPlayerProfile.avatar_url}
                    alt={topPlayerProfile.username}
                    className="w-6 h-6 rounded-full object-cover border border-purple-400/70"
                  />
                  <span className="font-bold text-slate-200 truncate">
                    {topPlayerProfile.username}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${topPlayerProfile.colorCode === 'w'
                        ? 'bg-amber-200 text-slate-950'
                        : 'bg-slate-800 text-cyan-300 border border-cyan-500/40'
                      }`}
                  >
                    {topPlayerProfile.colorLabel}
                  </span>
                </div>
                <div
                  className={`px-2 py-0.5 rounded-md font-mono font-bold text-xs flex items-center gap-1 ${topPlayerTurn
                      ? 'bg-purple-500/25 text-purple-200 border border-purple-400/60'
                      : 'bg-slate-900 text-slate-400'
                    }`}
                >
                  <Clock className="w-3 h-3 text-purple-400" />
                  <span>{formatTime(topPlayerTime)}</span>
                </div>
              </div>

              {/* Exact Reference Board Frame with Custom Uploaded 2D Board & Pieces */}
              <div
                className={
                  isFullScreen
                    ? 'relative w-full h-full max-w-full max-h-full aspect-square flex items-center justify-center select-none'
                    : 'relative w-[340px] xs:w-[380px] sm:w-[460px] md:w-[500px] lg:w-[530px] max-w-[94vw] max-h-[72vh] aspect-square flex items-center justify-center select-none'
                }
                style={
                  isFullScreen
                    ? {
                      width: '100%',
                      height: '100%',
                      maxWidth: '100%',
                      maxHeight: '100%',
                      aspectRatio: '1 / 1',
                    }
                    : undefined
                }
              >
                {/* 1. Custom Uploaded Chessboard Image (Pristine 1:1 square 8x8 foundation, always fixed orientation) */}
                <img
                  src="/assets/reference_board_clean_square.png"
                  alt="ChessVerse Board"
                  className="w-full h-full object-contain pointer-events-none select-none drop-shadow-[0_16px_48px_rgba(0,0,0,0.85)]"
                  draggable={false}
                />

                {/* 2. Exact 8x8 Playable Board Area (Overlay precisely aligned 832x832 in 1024x1024 = 9.375% margin, 81.25% size) */}
                <div
                  className="absolute pointer-events-auto"
                  style={{
                    left: '9.375%',
                    top: '9.375%',
                    width: '81.25%',
                    height: '81.25%',
                  }}
                >
                  {/* Interactive 8x8 Grid for Touch, Click, Drag-and-Drop, and Custom Pieces */}
                  <div
                    ref={grid2DContainerRef}
                    data-testid="chess-2d-grid"
                    className="absolute inset-0 grid grid-cols-8 grid-rows-8 z-20 touch-none select-none"
                    onPointerMove={handle2DPointerMove}
                    onPointerUp={handle2DPointerUp}
                    onPointerCancel={handle2DPointerUp}
                  >
                    {displayRanks.map((rIdx) =>
                      displayFiles.map((fIdx) => {
                        const sqName = `${FILES[fIdx]}${RANKS[7 - rIdx]}` as Square;
                        const piece = chessRef.current.board()[rIdx][fIdx];
                        const isSelected = selectedSquare === sqName;
                        const legalMove = legalMoves.find((m) => m.to === sqName);

                        const isTransientMoveSource = lastMoveSquares?.[0] === sqName;
                        const isTransientMoveDest = lastMoveSquares?.[1] === sqName;
                        const isRemoteHighlighted = remoteHighlightSquares?.includes(sqName) ?? false;
                        const isKingInCheck = checkKingSquare === sqName;
                        const isCaptureSquare =
                          specialEffect?.type === 'capture' && specialEffect.square === sqName;
                        const isCastleSquare =
                          specialEffect?.type === 'castle' &&
                          (specialEffect.square === sqName ||
                            specialEffect.secondarySquare === sqName);
                        const isPromoSquare =
                          specialEffect?.type === 'promotion' && specialEffect.square === sqName;

                        const isMovingPiece = active2DMove && active2DMove.to === sqName;
                        const isCastlingRook = active2DMove && active2DMove.rookTo === sqName;

                        let pieceAnimStyle: React.CSSProperties | undefined = undefined;
                        if (isMovingPiece && active2DMove) {
                          const fromF = FILES.indexOf(active2DMove.from[0]);
                          const fromR = 7 - RANKS.indexOf(active2DMove.from[1]);
                          const toF = FILES.indexOf(active2DMove.to[0]);
                          const toR = 7 - RANKS.indexOf(active2DMove.to[1]);
                          const dx = boardFlipped ? -(fromF - toF) : (fromF - toF);
                          const dy = boardFlipped ? -(fromR - toR) : (fromR - toR);
                          const isKnight = (active2DMove.pieceType || piece?.type || '').toLowerCase() === 'n';
                          pieceAnimStyle = {
                            ['--glide-dx' as any]: dx,
                            ['--glide-dy' as any]: dy,
                            animation: isKnight
                              ? 'chess2dKnightHop 460ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards'
                              : 'chess2dPieceGlide 420ms cubic-bezier(0.25, 1, 0.5, 1) forwards',
                            zIndex: 35,
                          };
                        } else if (isCastlingRook && active2DMove && active2DMove.rookFrom && active2DMove.rookTo) {
                          const fromF = FILES.indexOf(active2DMove.rookFrom[0]);
                          const toF = FILES.indexOf(active2DMove.rookTo[0]);
                          const dx = boardFlipped ? -(fromF - toF) : (fromF - toF);
                          pieceAnimStyle = {
                            ['--glide-dx' as any]: dx,
                            ['--glide-dy' as any]: 0,
                            animation: 'chess2dPieceGlide 420ms cubic-bezier(0.25, 1, 0.5, 1) forwards',
                            zIndex: 35,
                          };
                        }

                        const isDragged = dragged2DPiece?.square === sqName;

                        return (
                          <button
                            key={sqName}
                            type="button"
                            data-square={sqName}
                            data-highlighted={
                              isSelected || isTransientMoveSource || isTransientMoveDest || isRemoteHighlighted
                                ? 'true'
                                : 'false'
                            }
                            onPointerDown={(e) => handle2DPointerDown(e, sqName)}
                            onClick={() => handleSquareSelection(sqName)}
                            className="relative w-full h-full flex items-center justify-center select-none bg-transparent focus:outline-none cursor-pointer group"
                          >
                            {/* Transient Move Source Highlight */}
                            {isTransientMoveSource && (
                              <div
                                data-testid={`move-source-highlight-${sqName}`}
                                className="absolute inset-0 bg-cyan-400/25 ring-2 ring-inset ring-cyan-300/70 pointer-events-none transition-opacity duration-200"
                              />
                            )}

                            {/* Transient Move Destination Highlight */}
                            {isTransientMoveDest && (
                              <div
                                data-testid={`move-dest-highlight-${sqName}`}
                                className="absolute inset-0 bg-amber-400/25 ring-2 ring-inset ring-amber-300/80 shadow-[inset_0_0_12px_rgba(251,191,36,0.45)] pointer-events-none transition-opacity duration-200"
                              />
                            )}

                            {/* Selected Square / Remote Synchronized Square Highlight Overlay */}
                            {(isSelected || isRemoteHighlighted) && (
                              <div
                                data-testid={`selected-highlight-${sqName}`}
                                className="absolute inset-0 bg-cyan-400/30 ring-2 ring-inset ring-cyan-300 shadow-[inset_0_0_12px_rgba(34,211,238,0.45)] pointer-events-none"
                              />
                            )}

                            {/* Special Effect: King in Check Pulsing Danger Aura */}
                            {isKingInCheck && (
                              <div
                                data-testid="special-effect-check"
                                className="absolute inset-0 bg-rose-600/45 animate-pulse ring-2 ring-inset ring-rose-400 shadow-[inset_0_0_16px_#f43f5e] pointer-events-none"
                              />
                            )}

                            {/* Special Effect: Capture Shockwave Ring */}
                            {isCaptureSquare && (
                              <div
                                data-testid="special-effect-capture"
                                style={{ animation: 'chess2dCaptureBurst 520ms ease-out forwards' }}
                                className="absolute inset-1 rounded-full border-[3px] border-rose-400 bg-rose-500/30 shadow-[0_0_16px_#f43f5e] pointer-events-none z-20"
                              />
                            )}

                            {/* Special Effect: Castling Shield Halo */}
                            {isCastleSquare && (
                              <div
                                data-testid="special-effect-castle"
                                className="absolute inset-0.5 rounded-md border-2 border-cyan-300 bg-cyan-400/25 animate-pulse shadow-[0_0_14px_#22d3ee] pointer-events-none z-20"
                              />
                            )}

                            {/* Special Effect: Pawn Promotion Crown Aura */}
                            {isPromoSquare && (
                              <div
                                data-testid="special-effect-promotion"
                                style={{ animation: 'chess2dPromoteAura 680ms ease-out forwards' }}
                                className="absolute inset-0.5 rounded-full border-2 border-amber-300 bg-amber-400/35 shadow-[0_0_18px_#fbbf24] pointer-events-none z-20"
                              />
                            )}

                            {/* Custom Uploaded Chess Piece (Centered, Proportional, Transparent RGBA) */}
                            {piece && (
                              <div
                                style={pieceAnimStyle}
                                data-testid={`piece-${sqName}`}
                                className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-transform duration-150 ${isDragged
                                    ? 'opacity-20 scale-95'
                                    : isSelected
                                      ? 'scale-105 -translate-y-1 drop-shadow-[0_4px_12px_rgba(34,211,238,0.85)] z-30'
                                      : 'group-hover:scale-105 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] z-10'
                                  }`}
                              >
                                <img
                                  src={PIECE_IMAGE_MAP[`${piece.color}${piece.type}`]}
                                  alt={`${piece.color === 'w' ? 'White' : 'Black'} ${piece.type}`}
                                  className="w-full h-full object-contain select-none pointer-events-none"
                                  draggable={false}
                                />
                              </div>
                            )}

                            {/* Legal Destination Indicator (Dot for quiet move, Ring for legal capture) */}
                            {legalMove && (
                              <div
                                data-testid={`legal-move-${sqName}`}
                                className={`z-40 pointer-events-none ${piece
                                    ? 'absolute inset-1.5 rounded-full border-[3px] border-rose-500/90 shadow-[0_0_10px_#f43f5e]'
                                    : 'w-3.5 h-3.5 rounded-full bg-cyan-400/90 shadow-[0_0_10px_#22d3ee]'
                                  }`}
                              />
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Floating Dragged Piece following finger/cursor */}
                {dragged2DPiece && (
                  <div
                    className="fixed pointer-events-none z-50 select-none"
                    style={{
                      left: dragged2DPiece.clientX,
                      top: dragged2DPiece.clientY,
                      width: '80px',
                      height: '80px',
                      transform: 'translate(-50%, -50%) scale(1.12)',
                      filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.65)) drop-shadow(0 0 10px rgba(34,211,238,0.75))',
                    }}
                  >
                    <img
                      src={PIECE_IMAGE_MAP[`${dragged2DPiece.color}${dragged2DPiece.type}`]}
                      alt="Dragged Piece"
                      className="w-full h-full object-contain"
                      draggable={false}
                    />
                  </div>
                )}
              </div>

              {/* Bottom Local Player Strip (White at bottom for Player 1, Black at bottom for Player 2) */}
              <div
                data-testid="board-bottom-player-bar"
                className={
                  isFullScreen
                    ? 'hidden'
                    : 'w-[296px] sm:w-[416px] px-3 py-1.5 rounded-xl bg-slate-950/90 border border-cyan-500/35 flex items-center justify-between text-xs shadow-md'
                }
              >
                <div className="flex items-center gap-2 min-w-0">
                  <img
                    src={bottomPlayerProfile.avatar_url}
                    alt={bottomPlayerProfile.username}
                    className="w-6 h-6 rounded-full object-cover border border-cyan-400"
                  />
                  <span className="font-bold text-white truncate">
                    {bottomPlayerProfile.username}
                  </span>
                  <span
                    data-testid="bottom-player-color-indicator"
                    className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${bottomPlayerProfile.colorCode === 'w'
                        ? 'bg-amber-200 text-slate-950'
                        : 'bg-slate-800 text-cyan-300 border border-cyan-500/40'
                      }`}
                  >
                    {bottomPlayerProfile.colorLabel}
                  </span>
                </div>
                <div
                  className={`px-2 py-0.5 rounded-md font-mono font-bold text-xs flex items-center gap-1 ${bottomPlayerTurn
                      ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/60'
                      : 'bg-slate-900 text-slate-400'
                    }`}
                >
                  <Clock className="w-3 h-3 text-cyan-400" />
                  <span>{formatTime(bottomPlayerTime)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Collapsible Right-of-Board Panels (Captured Pieces + Move History) on Desktop */}
          <div
            data-testid="chess-side-panels"
            className={
              isFullScreen
                ? 'hidden'
                : `hidden lg:flex flex-col gap-3 transition-all duration-300 ease-in-out flex-shrink-0 pointer-events-auto overflow-hidden ${showSidePanels
                  ? 'w-52 p-3 opacity-100 translate-x-0'
                  : 'w-0 p-0 opacity-0 translate-x-8 border-0'
                }`
            }
          >
            {renderCapturedAndHistoryContent()}
          </div>

          {/* Mobile Slide-Out Drawer for Captured Pieces & Move History */}
          {showMobilePanelsDrawer && (
            <div className="lg:hidden absolute inset-0 z-40 bg-black/75 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
              <div className="w-72 max-w-[85%] h-full bg-[#080d1a] border-l border-cyan-500/40 p-4 flex flex-col gap-3 shadow-2xl">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-cyan-300">
                    Match Panels
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowMobilePanelsDrawer(false)}
                    className="p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-white"
                    aria-label="Close panels drawer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {renderCapturedAndHistoryContent()}
              </div>
            </div>
          )}

          {/* Distinct Special Move Tactical Callout Banner (Capture, Castling, Promotion, Check) */}
          {specialEffect && !gameState.isCheckmate && (
            <div
              data-testid="special-move-banner"
              className={`absolute top-12 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full font-extrabold text-xs tracking-wider uppercase flex items-center gap-2 shadow-xl z-30 pointer-events-none transition-all ${specialEffect.type === 'capture'
                  ? 'bg-rose-600/95 text-white border border-rose-300 shadow-rose-900/50'
                  : specialEffect.type === 'castle'
                    ? 'bg-cyan-600/95 text-white border border-cyan-200 shadow-cyan-900/50'
                    : specialEffect.type === 'promotion'
                      ? 'bg-amber-500/95 text-slate-950 border border-amber-200 shadow-amber-900/50'
                      : 'bg-rose-600/95 text-white border border-rose-300 animate-bounce'
                }`}
            >
              <ShieldAlert className="w-4 h-4" />
              <span>{specialEffect.label}</span>
              <span className="text-[10px] font-mono opacity-90 normal-case">
                • {specialEffect.sublabel}
              </span>
            </div>
          )}

          {/* Persistent Check Alert Pill when in Check */}
          {gameState.isCheck && !gameState.isCheckmate && !specialEffect && (
            <div className="absolute top-12 left-1/2 -translate-x-1/2 px-5 py-1.5 rounded-full bg-rose-600/95 text-white font-black text-xs tracking-wider uppercase flex items-center gap-2 shadow-lg shadow-rose-900/50 animate-bounce z-20 pointer-events-none">
              <ShieldAlert className="w-4 h-4" />
              King in Check!
            </div>
          )}

          {/* Checkmate / Draw Victory Overlay */}
          {(gameState.isCheckmate || gameState.isDraw) && (
            <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-30">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center mb-3 shadow-xl shadow-cyan-500/30">
                <Crown className="w-9 h-9 text-white" />
              </div>
              <h3 className="text-2xl font-black text-white mb-1">
                {gameState.isCheckmate
                  ? gameState.turn === 'b'
                    ? 'White Wins by Checkmate!'
                    : 'Black Wins by Checkmate!'
                  : 'Match Drawn!'}
              </h3>
              <p className="text-xs text-slate-400 mb-5">
                {gameState.isCheckmate
                  ? 'Brilliant tactical execution on the board.'
                  : 'Game concluded in a draw.'}
              </p>
              <button
                onClick={handleRestart}
                className="px-6 py-2.5 bg-gradient-to-r from-cyan-400 to-blue-500 text-black font-bold text-xs rounded-xl hover:brightness-110 shadow-lg flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Play Rematch
              </button>
            </div>
          )}

          {/* Pawn Promotion Popup */}
          {promotionPending && (
            <div
              data-testid="pawn-promotion-modal"
              className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 z-30"
            >
              <h4 className="text-sm font-bold text-cyan-300 uppercase tracking-wider mb-4">
                Choose Promotion Piece
              </h4>
              <div className="flex gap-3">
                {(['q', 'r', 'b', 'n'] as const).map((piece) => {
                  const turnColor = chessRef.current.turn();
                  const pieceImgSrc = PIECE_IMAGE_MAP[`${turnColor}${piece}`];
                  return (
                    <button
                      key={piece}
                      data-testid={`promote-to-${piece}`}
                      onClick={() => handlePromotionSelect(piece)}
                      className="w-16 h-20 rounded-2xl bg-slate-900 border-2 border-cyan-400/50 hover:border-cyan-300 hover:bg-cyan-500/20 flex flex-col items-center justify-center p-2 transition-all hover:scale-105 group"
                    >
                      <img
                        src={pieceImgSrc}
                        alt={piece}
                        className="w-10 h-10 object-contain drop-shadow transition-transform group-hover:scale-110"
                      />
                      <span className="text-[10px] font-bold font-sans uppercase text-cyan-300 mt-1">
                        {piece === 'q'
                          ? 'Queen'
                          : piece === 'r'
                            ? 'Rook'
                            : piece === 'b'
                              ? 'Bishop'
                              : 'Knight'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Confirmation Dialog for Resign / Exit Room */}
          {confirmDialog && (
            <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 z-40">
              <div className="w-full max-w-sm p-5 rounded-2xl bg-slate-900 border border-rose-500/40 shadow-2xl text-center space-y-4">
                <h4 className="text-sm font-extrabold text-white">
                  {confirmDialog === 'resign' ? 'Confirm Resignation?' : 'Exit Active Match Room?'}
                </h4>
                <p className="text-xs text-slate-300">
                  {confirmDialog === 'resign'
                    ? 'Resigning will immediately award victory to your opponent.'
                    : 'Are you sure you want to leave the current room and return to the dashboard?'}
                </p>
                <div className="flex justify-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (confirmDialog === 'resign') {
                        handleConfirmResign();
                      } else {
                        setConfirmDialog(null);
                        onExit();
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
                  >
                    {confirmDialog === 'resign' ? 'Yes, Resign' : 'Yes, Exit Room'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDialog(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* In-Game Settings Popover (Graphics Quality & AI Difficulty) */}
          {showSettingsPopover && (
            <div className="absolute bottom-4 left-4 z-30 w-72 p-4 rounded-2xl bg-slate-950/95 border border-cyan-400/40 shadow-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-extrabold uppercase text-white">
                  3D Graphics & Engine
                </span>
                <button
                  onClick={() => setShowSettingsPopover(false)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Close
                </button>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1.5">
                  Graphics Quality
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['performance', 'balanced', 'quality'] as const).map((q) => (
                    <button
                      key={q}
                      onClick={() => setGraphicsQuality(q)}
                      className={`py-1.5 rounded-lg text-[10px] font-bold capitalize border ${graphicsQuality === q
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400'
                          : 'bg-slate-900 text-slate-400 border-slate-800'
                        }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1.5">
                  AI Difficulty
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['easy', 'medium', 'hard'] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => setAiDifficulty(d)}
                      className={`py-1.5 rounded-lg text-[10px] font-bold capitalize border ${aiDifficulty === d
                          ? 'bg-purple-500/20 text-purple-300 border-purple-400'
                          : 'bg-slate-900 text-slate-400 border-slate-800'
                        }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Control Bar (New Game, Undo, Draw, Resign, Settings, Exit Room, 2D/3D Toggle, Theme) */}
        <div
          className={
            isFullScreen
              ? 'hidden'
              : 'flex flex-wrap items-center justify-between gap-3 pt-3 mt-3 border-t border-slate-800/80 z-10'
          }
        >
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleRestart}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-cyan-400 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
              <span>New Game</span>
            </button>

            <button
              onClick={handleUndo}
              disabled={mode !== 'ai' || gameState.history.length < 1}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-cyan-400 disabled:opacity-40 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all"
            >
              <Undo2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>Undo</span>
            </button>

            <button
              onClick={handleDrawOffer}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-cyan-400 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all"
            >
              <Scale className="w-3.5 h-3.5 text-cyan-400" />
              <span>Draw</span>
            </button>

            <button
              onClick={() => setConfirmDialog('resign')}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-rose-400 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all"
            >
              <Flag className="w-3.5 h-3.5 text-rose-400" />
              <span>Resign</span>
            </button>

            <button
              onClick={() => setShowSettingsPopover(!showSettingsPopover)}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-cyan-400 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all"
            >
              <Settings className="w-3.5 h-3.5 text-cyan-400" />
              <span>Settings</span>
            </button>

            <button
              onClick={() =>
                gameState.history.length > 0 && !gameState.isCheckmate && !gameState.isDraw
                  ? setConfirmDialog('exit')
                  : onExit()
              }
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-900/80 to-red-900/80 hover:from-rose-600 hover:to-red-600 border border-rose-500/40 text-white text-xs font-bold flex items-center gap-1.5 transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Exit Room</span>
            </button>
          </div>

          {/* Right Bottom: 2D / 3D Mode Selector + Theme Selector */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              data-testid="toggle-board-mode-btn"
              onClick={() => setIs3DView(!is3DView)}
              className="px-3.5 py-2 rounded-xl bg-slate-950 border border-cyan-500/30 hover:border-cyan-400 flex items-center gap-2 text-xs font-bold text-white transition-all"
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${is3DView ? 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]' : 'bg-amber-400'
                  }`}
              />
              <span>{is3DView ? '3D Board' : '2D Board'}</span>
            </button>

            <button
              type="button"
              onClick={cycleTheme}
              className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-400/50 flex items-center gap-2 text-xs font-bold text-slate-200 transition-all"
            >
              <span className="text-[10px] text-slate-400">Theme:</span>
              <span className="text-amber-300">{THEME_PALETTES[boardTheme].name}</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
            </button>
          </div>
        </div>
      </div>

      {/* Right Sidebar Column: Compact Real-Time Room Chat | Game Info + Quick Tips */}
      <div className={isFullScreen ? 'hidden' : 'w-full xl:w-80 flex flex-col gap-4'}>
        <div className="flex-1 flex flex-col min-h-[320px] p-3.5 rounded-2xl bg-slate-900/85 border border-cyan-500/20 shadow-xl">
          {/* Tabs: Chat | Game Info */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 mb-2.5">
            <button
              onClick={() => setRightTab('chat')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${rightTab === 'chat'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
                }`}
            >
              {room?.max_players === 3 ? '3P Room Chat' : 'Chat'}
            </button>
            <button
              onClick={() => setRightTab('info')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${rightTab === 'info'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
                }`}
            >
              Game Info
            </button>
          </div>

          {/* Room ID & Connected Status Row */}
          <div className="flex items-center justify-between px-1.5 pb-2 mb-2 border-b border-slate-800 text-xs">
            <button
              onClick={() => {
                navigator.clipboard.writeText(room?.room_code || 'LOCAL-AI');
                setRoomCodeCopied(true);
                setTimeout(() => setRoomCodeCopied(false), 2000);
              }}
              className="font-mono text-slate-300 hover:text-cyan-300 flex items-center gap-1"
            >
              <span>Room ID: #{room?.room_code || 'LOCAL-AI'}</span>
              {roomCodeCopied ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3 text-slate-500" />
              )}
            </button>
            <span className="text-emerald-400 font-semibold text-[11px]">Connected</span>
          </div>

          {/* 3-Player Participant Strip when room has 3 players */}
          {participants.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pb-2 mb-2 border-b border-slate-800/70">
              <Users className="w-3.5 h-3.5 text-cyan-400" />
              {participants.map((p) => (
                <span
                  key={p.id}
                  className="px-2 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-[10px] font-semibold text-slate-300"
                >
                  {p.username}
                </span>
              ))}
            </div>
          )}

          {chatError && (
            <div className="mb-2 px-2.5 py-1.5 rounded-lg bg-rose-950/70 border border-rose-500/40 text-[11px] text-rose-300 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{chatError}</span>
            </div>
          )}

          {rightTab === 'chat' ? (
            <>
              <div
                ref={chatContainerRef}
                data-testid="room-chat-messages"
                className="flex-1 overflow-y-auto space-y-1.5 max-h-60 pr-1"
              >
                {chatMessages.length === 0 ? (
                  <div className="py-8 text-center text-[11px] text-slate-500">
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
                            {formatMsgTimestamp(m.created_at)}
                          </span>
                        </div>
                        <div
                          className={`px-2.5 py-1.5 rounded-xl text-xs leading-snug max-w-[88%] break-words ${isMe
                              ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-tr-none'
                              : 'bg-slate-800 text-slate-100 border border-slate-700 rounded-tl-none'
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

              <form onSubmit={(e) => handleSendChat(e)} className="mt-2 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    data-testid="room-chat-input"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 h-9 px-3 bg-slate-950 border border-slate-800 rounded-full text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                  <button
                    type="submit"
                    data-testid="room-chat-send"
                    disabled={!chatInput.trim() || isSendingChat}
                    aria-label="Send message"
                    className="w-9 h-9 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white flex items-center justify-center hover:brightness-110 shadow disabled:opacity-40"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Quick Reaction Emojis Row */}
                <div className="flex items-center justify-around pt-0.5">
                  {['😀', '😍', '👍', '🔥', '💯'].map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={(e) => handleSendChat(e, emoji)}
                      className="text-sm hover:scale-125 transition-transform"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 space-y-2 text-xs pt-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Mode</span>
                <span className="font-bold text-cyan-300">
                  {mode === 'online'
                    ? `${room?.max_players || 2}-Player Multiplayer`
                    : `AI (${aiDifficulty})`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Board View</span>
                <span className="font-bold text-white">{is3DView ? '3D WebGL' : '2D Staunton'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Graphics</span>
                <span className="font-bold text-white capitalize">{graphicsQuality}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Board Theme</span>
                <span className="font-bold text-amber-300">
                  {THEME_PALETTES[boardTheme].name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Moves Played</span>
                <span className="font-mono text-white">{gameState.history.length}</span>
              </div>
              <div className="pt-2 space-y-1.5">
                <button
                  onClick={() => setBoardFlipped(!boardFlipped)}
                  className="w-full py-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-400 text-xs font-bold text-cyan-300 flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Flip Board Orientation
                </button>
                {is3DView && (
                  <button
                    onClick={handleResetCamera}
                    className="w-full py-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-400 text-xs font-bold text-slate-300 flex items-center justify-center gap-2"
                  >
                    <Camera className="w-3.5 h-3.5 text-cyan-400" />
                    Reset 3D Camera
                  </button>
                )}
              </div>
            </div>
          )}
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
              <span>Click Hide/Show Panels (or press P) to expand board</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span>Use Ctrl + Z to undo (local/AI mode)</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span>Switch seamlessly between 3D and 2D modes</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
