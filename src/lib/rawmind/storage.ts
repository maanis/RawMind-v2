import { PersonaId, Religion } from "./personas";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface RawMindSettings {
  ollamaUrl: string;
  model: string;
}

const SETTINGS_KEY = "rawmind_settings";
const CHAT_PREFIX = "rawmind_chat_";

export function loadSettings(): RawMindSettings {
  if (typeof window === "undefined") return { ollamaUrl: "", model: "dolphin-mixtral" };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ollamaUrl: "", model: "dolphin-mixtral" };
    return JSON.parse(raw) as RawMindSettings;
  } catch {
    return { ollamaUrl: "", model: "dolphin-mixtral" };
  }
}

export function saveSettings(settings: RawMindSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function chatKey(personaId: PersonaId, religion?: Religion) {
  return `${CHAT_PREFIX}${personaId}${religion ? `_${religion}` : ""}`;
}

export function loadChat(personaId: PersonaId, religion?: Religion): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(chatKey(personaId, religion));
    if (!raw) return [];
    return JSON.parse(raw) as ChatMessage[];
  } catch {
    return [];
  }
}

export function saveChat(personaId: PersonaId, messages: ChatMessage[], religion?: Religion) {
  if (typeof window === "undefined") return;
  localStorage.setItem(chatKey(personaId, religion), JSON.stringify(messages));
}

export function clearChat(personaId: PersonaId, religion?: Religion) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(chatKey(personaId, religion));
}
