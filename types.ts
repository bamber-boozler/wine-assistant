
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface WineEntry {
  [key: string]: string;
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  inventory: WineEntry[] | null;
  error: string | null;
}
