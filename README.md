<div align="center">
  <img src="public/logo.svg" alt="RawMind Logo" width="120" height="120" />
  <h1>RawMind</h1>
  <p><strong>An intent-driven AI experience for discovery, conversation, and personalized media.</strong></p>

  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
  [![Next.js 16](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue?logo=typescript)](https://www.typescriptlang.org/)

  <br />
  <p>
    <a href="#sparkles-features">Features</a> •
    <a href="#rocket-getting-started">Getting Started</a> •
    <a href="#gear-architecture">Architecture</a> •
    <a href="#key-environment-variables">Environment</a>
  </p>
</div>

---

## 🧠 What is RawMind?

RawMind is a Next.js app that brings together two complementary AI experiences:

- an intent-driven video feed that turns a prompt into a tailored YouTube experience
- a persona-based chat experience that lets you explore ideas with different styles and tones

You can type a prompt, speak it aloud, and let the app build a more relevant stream of content around your intent.

---

## ✨ Features

- 🎯 Intent-driven feed curation from text or voice prompts
- 🗣️ Optional voice input with NVIDIA Riva support
- 🔄 Adaptive experience that reacts to watch and interaction signals
- 🧠 Gemini-powered ranking and topic analysis
- 💬 RawMind persona chat with configurable Ollama-backed models
- ⚡ Modern Next.js, TypeScript, and Tailwind UI with light and dark mode

---

## 🚀 Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/your-username/rawmind.git
cd rawmind
```

### 2. Install dependencies
```bash
pnpm install
```

### 3. Create your environment file
```bash
cp .env.example .env.local
```
If there is no local example file in your checkout, create `.env.local` manually and add the variables listed below.

### 4. Start MongoDB locally (optional)
```bash
docker compose up -d
```
This starts the local MongoDB service used by the feed and cron features.

### 5. Run the app
```bash
pnpm dev
```
Open http://localhost:3000 to view the app.

---

## 🔑 Environment Variables

Create a `.env.local` file with the values below.

| Variable | Required | Description |
|:---|:---:|:---|
| `GEMINI_API_KEY` | ✅ | Google AI Studio API key for ranking and analysis |
| `YOUTUBE_API_KEY` | ✅ | YouTube Data API v3 key |
| `MONGODB_URI` | ✅ | MongoDB connection string |
| `MONGODB_DB` | ✅ | Database name |
| `CRON_SECRET` | ✅ | Secret used to protect the cron endpoint |
| `UPSTASH_REDIS_REST_URL` | ❌ | Optional Upstash Redis URL |
| `UPSTASH_REDIS_REST_TOKEN` | ❌ | Optional Upstash Redis token |
| `NVIDIA_API_KEY` | ❌ | Needed for voice transcription |
| `NEXT_PUBLIC_HAS_NVIDIA` | ❌ | Set to `"true"` to enable the microphone UI |

---

## 🧱 Architecture

RawMind combines a few layers to deliver the experience:

1. Input: the user submits an intent via text or voice.
2. Analysis: Gemini extracts topics, mood, and relevance cues from the prompt.
3. Sourcing: the app queries YouTube for candidate videos.
4. Ranking: Gemini scores the videos against the original intent.
5. Storage: sessions, signals, and metadata are persisted in MongoDB.
6. Delivery: the UI presents the feed and the RawMind chat flow in real time.

---

## 🧪 Scripts

```bash
pnpm dev
pnpm build
pnpm lint
pnpm test
```

---

## 🤝 Contributing

Contributions are welcome. Please see [CONTRIBUTING.md](CONTRIBUTING.md) for the contribution workflow.

---

## 📄 License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

<div align="center">
  <i>Built for curious minds and sharper conversations.</i>
</div>
