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
  /**
   * Optional: a custom model (e.g. built from your own Modelfile with a
   * baked-in SYSTEM prompt) used specifically for the "raw" persona. When
   * set, the app skips sending its own system message for that persona so
   * it doesn't override the one baked into the model.
   */
  rawModel: string;
}

const DEFAULT_SETTINGS: RawMindSettings = {
  ollamaUrl: "",
  model: "maanis/rawmind",
  rawModel: "",
};

const SETTINGS_KEY = "rawmind_settings";
const CHAT_PREFIX = "rawmind_chat_";

export function loadSettings(): RawMindSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<RawMindSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
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