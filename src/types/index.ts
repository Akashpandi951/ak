export interface UserStats {
  chess: {
    wins: number;
    losses: number;
    draws: number;
    rating: number;
  };
  ttt: {
    wins: number;
    losses: number;
    draws: number;
  };
}

export interface UserProfile {
  id: string;
  username: string;
  public_uid: string;
  avatar_url: string;
  status_text?: string;
  status_message?: string;
  created_at: string;
  stats: UserStats;
  privacy_settings: {
    show_online: boolean;
    allow_invites: boolean;
  };
  isOnline?: boolean;
  rating?: number;
  wins?: number;
  losses?: number;
  draws?: number;
}

export interface MatchHistoryItem {
  id: string;
  user_id: string;
  opponent_name: string;
  opponent_avatar: string;
  game_type: 'chess' | 'ttt';
  result: 'Won' | 'Lost' | 'Draw';
  time_ago: string;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_uid?: string;
  sender_name?: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read: boolean;
}

export interface Conversation {
  conversationId: string;
  contact: {
    id: string;
    username: string;
    public_uid: string;
    avatar_url: string;
    status_text?: string;
    isOnline: boolean;
  };
  lastMessage: Message | null;
  unreadCount: number;
}

export interface GameInvitation {
  id: string;
  inviter_id: string;
  invitee_id: string;
  game_type: 'chess' | 'ttt';
  status: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired';
  room_id: string;
  created_at: string;
  inviter?: {
    id: string;
    username: string;
    public_uid: string;
    avatar_url: string;
  };
}

export interface RoomChatMessage {
  id: string;
  room_id?: string;
  sender_id: string;
  sender_uid?: string;
  sender_name: string;
  content: string;
  created_at: string;
}

export interface RoomParticipantInfo {
  id: string;
  username: string;
  public_uid: string;
  avatar_url: string;
  role?: string;
}

export interface GameRoom {
  id: string;
  room_code: string;
  game_type: 'chess' | 'ttt';
  mode: 'online' | 'ai';
  max_players?: 2 | 3;
  participants?: string[];
  player_one_id: string;
  player_two_id: string | null;
  player_three_id?: string | null;
  player_one_symbol: string;
  player_two_symbol: string;
  player_three_symbol?: string;
  current_turn: string;
  game_state: any;
  state_version: number;
  winner_id: string | null;
  status: 'waiting' | 'active' | 'finished';
  move_history: any[];
  chat_messages: RoomChatMessage[];
  created_at: string;
  updated_at: string;
}
