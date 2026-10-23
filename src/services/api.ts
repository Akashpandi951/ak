/**
 * ChessVerse 3D - API and WebSocket Client Service
 * Supports per-tab session isolation (sessionStorage + localStorage fallback)
 * so multiple browser tabs can sign into distinct player accounts simultaneously.
 */
import {
  UserProfile,
  Conversation,
  Message,
  GameInvitation,
  GameRoom,
  RoomChatMessage,
  RoomParticipantInfo,
} from '../types/index.ts';

const TOKEN_KEY = 'chessverse_auth_token';

// Per-tab in-memory + sessionStorage token so multiple tabs never overwrite each other's player session
let tabAuthToken: string | null = null;

export function getAuthToken(): string | null {
  if (tabAuthToken) return tabAuthToken;
  try {
    const sessionTok = sessionStorage.getItem(TOKEN_KEY);
    if (sessionTok) {
      tabAuthToken = sessionTok;
      return sessionTok;
    }
    const localTok = localStorage.getItem(TOKEN_KEY);
    if (localTok) {
      tabAuthToken = localTok;
      sessionStorage.setItem(TOKEN_KEY, localTok);
      return localTok;
    }
  } catch {
    // Ignore storage access errors
  }
  return null;
}

export function setAuthToken(token: string) {
  tabAuthToken = token;
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Ignore storage access errors
  }
  wsService.connect(token);
}

export function clearAuthToken() {
  tabAuthToken = null;
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Ignore storage access errors
  }
  wsService.disconnect();
}

// In-flight GET deduplication and short TTL cache to prevent burst HTTP 429 rate-limits
const inFlightGetRequests = new Map<string, Promise<any>>();
const recentGetCache = new Map<string, { timestamp: number; data: any }>();
const GET_CACHE_TTL_MS = 850;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function performFetchWithRetry<T>(
  endpoint: string,
  options: RequestInit,
  headers: Record<string, string>
): Promise<T> {
  const maxRetries = 4;
  let lastError: Error | null = null;

  const backendBase = (import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
  const targetUrl = endpoint.startsWith('http') ? endpoint : `${backendBase}${endpoint}`;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(targetUrl, {
        ...options,
        headers,
      });

      if (
        (response.status === 429 ||
          response.status === 502 ||
          response.status === 503 ||
          response.status === 504) &&
        attempt < maxRetries
      ) {
        const retryAfterHeader = response.headers.get('Retry-After');
        let delayMs = 400 * Math.pow(2, attempt) + Math.floor(Math.random() * 220);
        if (retryAfterHeader) {
          const parsedSec = Number(retryAfterHeader);
          if (!Number.isNaN(parsedSec) && parsedSec > 0) {
            delayMs = Math.min(5000, parsedSec * 1000);
          }
        }
        await sleep(delayMs);
        continue;
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || `HTTP error ${response.status}`);
      }

      return data as T;
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const isMethodGet = !options.method || options.method.toUpperCase() === 'GET';
      const isRetryableError =
        lastError.message.includes('429') ||
        lastError.message.includes('502') ||
        lastError.message.includes('503') ||
        lastError.message.includes('504') ||
        (isMethodGet && lastError.name === 'TypeError');

      if (isRetryableError && attempt < maxRetries) {
        const delayMs = 400 * Math.pow(2, attempt) + Math.floor(Math.random() * 220);
        await sleep(delayMs);
        continue;
      }
      throw lastError;
    }
  }

  throw lastError || new Error('Request failed');
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const method = (options.method || 'GET').toUpperCase();
  if (method !== 'GET') {
    // Mutating requests invalidate recent GET cache so subsequent reads see fresh state
    recentGetCache.clear();
    return performFetchWithRetry<T>(endpoint, options, headers);
  }

  const cacheKey = `${token || 'anon'}:${endpoint}`;
  const cached = recentGetCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < GET_CACHE_TTL_MS) {
    return cached.data as T;
  }

  const existingInFlight = inFlightGetRequests.get(cacheKey);
  if (existingInFlight) {
    return existingInFlight as Promise<T>;
  }

  const promise = performFetchWithRetry<T>(endpoint, options, headers)
    .then((data) => {
      recentGetCache.set(cacheKey, { timestamp: Date.now(), data });
      return data;
    })
    .finally(() => {
      inFlightGetRequests.delete(cacheKey);
    });

  inFlightGetRequests.set(cacheKey, promise);
  return promise;
}

// REST API Methods
export const api = {
  // Consolidated Bootstrap
  async getBootstrap(): Promise<{
    user: UserProfile;
    invitations: GameInvitation[];
    friends: UserProfile[];
    pendingRequests: any[];
    conversations: Conversation[];
    leaderboard: { chess: UserProfile[]; ttt: UserProfile[] };
    history: any[];
  }> {
    return request('/api/bootstrap');
  },

  // Auth
  async register(username: string, password: string): Promise<{ user: UserProfile; token: string }> {
    const res = await request<{ user: UserProfile; token: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    setAuthToken(res.token);
    return res;
  },

  async login(username: string, password: string): Promise<{ user: UserProfile; token: string }> {
    const res = await request<{ user: UserProfile; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    setAuthToken(res.token);
    return res;
  },

  async getMe(): Promise<{ user: UserProfile }> {
    return request<{ user: UserProfile }>('/api/auth/me');
  },

  async deleteAccount(): Promise<{ success: boolean }> {
    const res = await request<{ success: boolean }>('/api/auth/delete', { method: 'DELETE' });
    clearAuthToken();
    return res;
  },

  async updateProfile(updates: {
    avatar_url?: string;
    privacy_settings?: any;
    new_username?: string;
    new_password?: string;
    status_message?: string;
  }): Promise<{ user: UserProfile }> {
    return request<{ user: UserProfile }>('/api/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  async getMatchHistory(): Promise<{ history: any[] }> {
    return request<{ history: any[] }>('/api/matches/history');
  },

  // Users & Search
  async searchUsers(query: string): Promise<{ users: UserProfile[] }> {
    return request<{ users: UserProfile[] }>(`/api/users/search?q=${encodeURIComponent(query)}`);
  },

  async getUser(userId: string): Promise<{ user: UserProfile }> {
    return request<{ user: UserProfile }>(`/api/users/${userId}`);
  },

  async getLeaderboard(): Promise<{ chess: UserProfile[]; ttt: UserProfile[] }> {
    return request<{ chess: UserProfile[]; ttt: UserProfile[] }>('/api/leaderboard');
  },

  // Friends
  async getFriends(): Promise<{ friends: UserProfile[]; pendingRequests: any[] }> {
    return request<{ friends: UserProfile[]; pendingRequests: any[] }>('/api/friends');
  },

  async sendFriendRequest(targetUserId: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>('/api/friends/request', {
      method: 'POST',
      body: JSON.stringify({ targetUserId }),
    });
  },

  async respondFriendRequest(
    friendshipId: string,
    action: 'accept' | 'decline'
  ): Promise<{ success: boolean }> {
    return request<{ success: boolean }>('/api/friends/respond', {
      method: 'POST',
      body: JSON.stringify({ friendshipId, action }),
    });
  },

  // 1-to-1 Chat
  async getConversations(): Promise<{ conversations: Conversation[] }> {
    return request<{ conversations: Conversation[] }>('/api/chat/conversations');
  },

  async getMessages(otherUserId: string): Promise<{ messages: Message[] }> {
    return request<{ messages: Message[] }>(`/api/chat/messages/${otherUserId}`);
  },

  async sendMessage(receiverId: string, content: string): Promise<{ message: Message }> {
    return request<{ message: Message }>('/api/chat/send', {
      method: 'POST',
      body: JSON.stringify({ receiverId, content }),
    });
  },

  // Invitations
  async getInvitations(): Promise<{ invitations: GameInvitation[] }> {
    return request<{ invitations: GameInvitation[] }>('/api/invitations');
  },

  async sendInvitation(
    inviteeId: string,
    gameType: 'chess' | 'ttt',
    maxPlayers: 2 | 3 = 2
  ): Promise<{ invitation: GameInvitation; room: GameRoom }> {
    return request<{ invitation: GameInvitation; room: GameRoom }>('/api/invitations/send', {
      method: 'POST',
      body: JSON.stringify({ inviteeId, gameType, maxPlayers }),
    });
  },

  async respondInvitation(
    invitationId: string,
    action: 'accept' | 'decline'
  ): Promise<{ success: boolean; roomId: string; room?: GameRoom }> {
    return request<{ success: boolean; roomId: string; room?: GameRoom }>(
      '/api/invitations/respond',
      {
        method: 'POST',
        body: JSON.stringify({ invitationId, action }),
      }
    );
  },

  // Rooms (2-Player and 3-Player supported with strict room access control)
  async createRoom(
    gameType: 'chess' | 'ttt',
    mode: 'online' | 'ai',
    maxPlayers: 2 | 3 = 2
  ): Promise<{ room: GameRoom }> {
    return request<{ room: GameRoom }>('/api/rooms/create', {
      method: 'POST',
      body: JSON.stringify({ gameType, mode, maxPlayers }),
    });
  },

  async joinRoom(roomCode: string): Promise<{
    room: GameRoom;
    players?: {
      playerOne: RoomParticipantInfo | null;
      playerTwo: RoomParticipantInfo | null;
      playerThree: RoomParticipantInfo | null;
      participants: RoomParticipantInfo[];
    };
  }> {
    return request('/api/rooms/join', {
      method: 'POST',
      body: JSON.stringify({ roomCode }),
    });
  },

  async getRoom(roomId: string): Promise<{
    room: GameRoom;
    players: {
      playerOne: RoomParticipantInfo | null;
      playerTwo: RoomParticipantInfo | null;
      playerThree?: RoomParticipantInfo | null;
      participants?: RoomParticipantInfo[];
    };
  }> {
    return request(`/api/rooms/${roomId}`);
  },

  async getRoomMessages(roomId: string): Promise<{
    roomId: string;
    messages: RoomChatMessage[];
  }> {
    return request(`/api/rooms/${roomId}/messages`);
  },

  async submitMove(roomId: string, move: any): Promise<{ room: GameRoom }> {
    return request<{ room: GameRoom }>(`/api/rooms/${roomId}/move`, {
      method: 'POST',
      body: JSON.stringify({ move }),
    });
  },

  async sendRoomChat(roomId: string, content: string): Promise<{ message: RoomChatMessage }> {
    return request<{ message: RoomChatMessage }>(`/api/rooms/${roomId}/chat`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  },

  async roomAction(
    roomId: string,
    action: 'resign' | 'draw' | 'rematch'
  ): Promise<{ room: GameRoom }> {
    return request<{ room: GameRoom }>(`/api/rooms/${roomId}/action`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
  },
};

// WebSocket Service with room subscription & auto-reconnect management
type EventCallback = (data: any) => void;

class WebSocketClient {
  private socket: WebSocket | null = null;
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private subscribedRooms: Set<string> = new Set();
  private reconnectTimer: any = null;
  private currentToken: string | null = null;

  connect(token?: string) {
    const authToken = token || getAuthToken();
    if (!authToken) return;

    // If token changed in this tab, close previous socket and reconnect with new token
    if (
      this.socket &&
      this.currentToken &&
      this.currentToken !== authToken &&
      (this.socket.readyState === WebSocket.OPEN ||
        this.socket.readyState === WebSocket.CONNECTING)
    ) {
      this.socket.close();
      this.socket = null;
    }

    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN ||
        this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    this.currentToken = authToken;
    let wsUrl: string;
    const backendBase = (import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
    if (backendBase) {
      try {
        const urlObj = new URL(backendBase);
        const wsProto = urlObj.protocol === 'https:' ? 'wss:' : 'ws:';
        wsUrl = `${wsProto}//${urlObj.host}/ws`;
      } catch {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        wsUrl = `${protocol}//${window.location.host}/ws`;
      }
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${protocol}//${window.location.host}/ws`;
    }

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.socket?.send(JSON.stringify({ type: 'auth', token: authToken }));
      };

      this.socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          const { type, ...data } = payload;
          if (type === 'auth_success') {
            // Re-subscribe to all active rooms on connect/reconnect
            for (const roomId of this.subscribedRooms) {
              this.socket?.send(JSON.stringify({ type: 'join_room', roomId }));
            }
            this.emit('reconnected', data);
          }
          this.emit(type, data);
        } catch (e) {
          console.error('WS parse error:', e);
        }
      };

      this.socket.onclose = () => {
        this.socket = null;
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
          const activeToken = getAuthToken();
          if (activeToken) {
            this.connect(activeToken);
          }
        }, 1500);
      };

      this.socket.onerror = () => {
        this.socket?.close();
      };
    } catch (err) {
      console.warn('WS connection failed, retrying:', err);
    }
  }

  subscribeRoom(roomId: string) {
    if (!roomId) return;
    this.subscribedRooms.add(roomId);
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: 'join_room', roomId }));
    } else {
      this.connect();
    }
  }

  unsubscribeRoom(roomId: string) {
    if (!roomId) return;
    this.subscribedRooms.delete(roomId);
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: 'leave_room', roomId }));
    }
  }

  send(type: string, data: any) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type, ...data }));
    }
  }

  on(event: string, callback: EventCallback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => this.off(event, callback);
  }

  off(event: string, callback: EventCallback) {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(callback);
    }
  }

  private emit(event: string, data: any) {
    const set = this.listeners.get(event);
    if (set) {
      for (const cb of set) {
        cb(data);
      }
    }
  }

  disconnect() {
    clearTimeout(this.reconnectTimer);
    this.subscribedRooms.clear();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}

export const wsService = new WebSocketClient();
