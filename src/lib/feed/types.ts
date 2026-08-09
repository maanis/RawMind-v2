export interface IntentProfile {
  topics: string[];
  goal_mix: {
    learning: number;
    entertainment: number;
  };
  tone: "light" | "serious" | "fun" | "balanced";
  energy: "low" | "medium" | "high";
  strictness: number;
}

export interface GeneratedQueryPlan {
  normalizedIntent: string;
  searchQueries: string[];
  intentProfile: IntentProfile;
}

export interface FeedSignal {
  sessionId: string;
  deviceId: string;
  videoId: string;
  type: "watchTime" | "like";
  value: number | boolean;
  timestamp: number;
}

export interface UserProfile {
  deviceId: string;
  topicAffinities: Record<string, number>;
  channelAffinities: Record<string, number>;
  seenVideoIds: string[];
  totalLikes: number;
  totalSignals: number;
  createdAt: string;
  updatedAt: string;
}

export interface FeedSession {
  sessionId: string;
  deviceId: string;
  prompt: string;
  promptSignature: string;
  queryPlan: GeneratedQueryPlan;
  remainingCount: number;
  totalVideos: number;
  depleted: boolean;
  refillCount: number;
  refillInProgress: boolean;
  recentServedChannels: string[];
  createdAt: string;
  updatedAt: string;
}

export interface StoredVideo {
  sessionId: string;
  deviceId: string;
  videoId: string;
  title: string;
  channelTitle: string;
  description: string;
  thumbnailUrl: string;
  publishedAt?: string;
  sourceQueries: string[];
  topicTags: string[];
  sourceRank: number;
  baseScore: number;
  served: boolean;
  servedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FeedVideo {
  id: string;
  title: string;
  channelTitle: string;
  reason: string;
  originalQuery: string;
  thumbnailUrl: string;
  relevanceScore: number;
}

export interface FeedPage {
  sessionId: string;
  intentProfile: IntentProfile;
  videos: FeedVideo[];
  profile?: UserProfile;
  remainingCount: number;
  hasMore: boolean;
  refilling: boolean;
}
