import { FeedSession, StoredVideo, UserProfile } from "@/lib/feed/types";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function freshnessBoost(publishedAt?: string) {
  if (!publishedAt) return 0;

  const published = new Date(publishedAt).getTime();
  const ageDays = (Date.now() - published) / (1000 * 60 * 60 * 24);
  if (Number.isNaN(ageDays)) return 0;
  if (ageDays < 30) return 0.08;
  if (ageDays < 180) return 0.04;
  return 0;
}

export function rankUnreadVideos(videos: StoredVideo[], session: FeedSession, profile: UserProfile) {
  const recentChannels = new Set(session.recentServedChannels);
  const mixed = applyFreshnessMix(videos);
  return [...mixed].sort((left, right) => {
    const leftScore = scoreVideo(left, recentChannels, profile);
    const rightScore = scoreVideo(right, recentChannels, profile);
    return rightScore - leftScore;
  });
}

export function applyFreshnessMix(videos: StoredVideo[]): StoredVideo[] {
  if (videos.length <= 1) return videos;

  const now = Date.now();
  const fresh = videos.filter((video) => {
    const created = new Date(video.createdAt).getTime();
    return Number.isFinite(created) && now - created < 48 * 3600_000;
  });
  const topPerformers = [...videos].sort((a, b) => b.baseScore - a.baseScore);
  const exploration = videos.filter((video) => !video.served).sort(() => Math.random() - 0.5);
  const n = videos.length;

  const mixed = [
    ...fresh.slice(0, Math.floor(n * 0.6)),
    ...topPerformers.slice(0, Math.floor(n * 0.3)),
    ...exploration.slice(0, Math.floor(n * 0.1)),
  ];

  const seen = new Set<string>();
  return mixed.filter((video) => {
    if (seen.has(video.videoId)) return false;
    seen.add(video.videoId);
    return true;
  });
}

export function scoreVideo(video: StoredVideo, recentChannels: Set<string>, profile: UserProfile) {
  const topicAffinity = video.topicTags.reduce(
    (sum, topic) => sum + (profile.topicAffinities[topic] ?? 0),
    0
  );
  const channelAffinity = profile.channelAffinities[video.channelTitle.toLowerCase()] ?? 0;
  const diversityPenalty = recentChannels.has(video.channelTitle) ? 0.16 : 0;
  const score =
    video.baseScore +
    freshnessBoost(video.publishedAt) +
    clamp(topicAffinity, -1.5, 1.5) * 0.12 +
    clamp(channelAffinity, -1.5, 1.5) * 0.18 -
    diversityPenalty;

  return Number(score.toFixed(4));
}
