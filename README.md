<div align="center">
  <img src="public/logo.svg" alt="MindScroll Logo" width="120" height="120" />
  <h1>MindScroll</h1>
  <p><strong>Intent-driven, infinitely adaptive short-form video feed.</strong></p>

  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
  [![Next.js 16](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue?logo=typescript)](https://www.typescriptlang.org/)
  
  <br />
  <p>
    <a href="#sparkles-features">Features</a> •
    <a href="#rocket-quick-start">Quick Start</a> •
    <a href="#gear-architecture">Architecture</a> •
    <a href="#key-environment-variables">Environment</a>
  </p>
</div>

---

## 🧠 What is MindScroll?

MindScroll reimagines the short-video experience. Instead of an opaque algorithm deciding what you watch, **you set the intent**. 

Type or speak exactly what you want—*"explain quantum computing simply,"* *"calm lo-fi beats,"* or *"high-intensity workout motivation."* MindScroll instantly builds a curated YouTube feed tailored to your prompt. As you watch, it analyzes your engagement signals in real-time, constantly refining and adapting the feed to match your evolving interests.

**No doom-scrolling. Just mindful, intent-driven discovery.**

---

## :sparkles: Features

- **🎯 Intent-Driven Curation**: Describe your mood or learning goal, and let AI build the perfect feed.
- **🎙️ Voice Input (Optional)**: Seamlessly dictate your intent using NVIDIA Riva gRPC integration.
- **⚡ Real-Time Adaptation**: The feed evolves dynamically based on what you watch and like.
- **🧠 AI-Powered Scoring**: Google Gemini analyzes video transcripts, metadata, and intent to rank content intelligently.
- **🚀 High Performance**: Built on Next.js 16 App Router, styled with Tailwind CSS v4, and animated with Framer Motion.
- **🛡️ Production Ready**: Includes rate limiting, Upstash Redis caching, MongoDB Atlas integration, and Vercel Cron jobs.

---

## :rocket: Quick Start

### 1. Clone the repository
```bash
git clone https://github.com/sayan365/mindscroll.git
cd mindscroll
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy the example environment file and fill in your keys:
```bash
cp .env.example .env.local
```
*(See the [Environment Variables](#key-environment-variables) section below for required keys).*

### 4. Database Setup (Local)
If you don't have a MongoDB Atlas cluster yet, you can quickly spin up a local instance using Docker:
```bash
docker compose up -d
```
*(MongoDB UI will be available at `http://localhost:8081`)*

### 5. Start the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## :key: Environment Variables

To run MindScroll, you'll need a few API keys. Check out `.env.example` for detailed instructions.

| Variable | Required | Description |
|:---|:---:|:---|
| `GEMINI_API_KEY` | ✅ | [Google AI Studio](https://aistudio.google.com/app/apikey) |
| `YOUTUBE_API_KEY` | ✅ | [Google Cloud Console](https://console.cloud.google.com) (Enable YouTube Data API v3) |
| `MONGODB_URI` | ✅ | MongoDB connection string (Atlas or Local) |
| `MONGODB_DB` | ✅ | Database name (e.g., `mindscroll`) |
| `CRON_SECRET` | ✅ | Secure random string to protect the Vercel cron endpoint |
| `UPSTASH_REDIS_REST_URL` | ❌ | [Upstash Redis](https://upstash.com/) URL (Falls back to in-memory if empty) |
| `UPSTASH_REDIS_REST_TOKEN` | ❌ | [Upstash Redis](https://upstash.com/) Token |
| `NVIDIA_API_KEY` | ❌ | Needed for voice transcription |
| `NEXT_PUBLIC_HAS_NVIDIA`| ❌ | Set to `"true"` to enable the UI mic button |

---

## :cloud: Deploying to Vercel

MindScroll is optimized for Vercel. 

1. Push your repository to GitHub.
2. Import the project in your Vercel Dashboard.
3. Add all the required **Environment Variables**.
4. Make sure to generate a strong `CRON_SECRET` (e.g., `openssl rand -hex 32`) and add it to your Vercel environment variables.
5. Deploy!

> **Note:** Vercel Cron will automatically trigger `/api/cron/refresh-pools` once per day to keep the video pools fresh, using the `CRON_SECRET` for authentication.

---

## :gear: Architecture

MindScroll's backend is a symphony of AI and traditional APIs:

1. **Input:** User submits an intent via text or voice.
2. **Analysis:** Google Gemini parses the intent, extracting core topic tags and the desired mood.
3. **Sourcing:** The backend queries the YouTube Data API v3 for relevant videos based on the extracted tags.
4. **Scoring:** Gemini evaluates and scores the retrieved videos against the user's original intent.
5. **Storage:** Sessions, signals, and video metadata are persisted in MongoDB Atlas.
6. **Delivery:** The highly responsive frontend serves the feed, continuously reporting watch/like signals back to the server to refine upcoming content.

---

## :handshake: Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details on how to get started, set up your development environment, and submit pull requests.

---

## :scroll: License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

<div align="center">
  <i>Built with ❤️ for mindful media consumption.</i>
</div>
