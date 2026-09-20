# Seekr

**AI-powered gallery search for your phone.** Seekr is a React Native (Expo) app that indexes your on-device photo library and lets you find photos by describing what's in them — search for `horse`, `receipt`, or `sunset` and get matching photos back instantly.

Each photo is described by a vision-language model running as a companion FastAPI + Ollama backend on your laptop. The generated descriptions and tags are stored locally in SQLite, so searching is fast and works fully offline afterward.

## Features

- **Full-gallery indexing** — scans your entire photo library, sends each photo to the backend for AI description, and shows live progress via a sticky notification. Indexing is resumable across sessions.
- **Semantic text search** — search across descriptions and tags with whole-word matching and automatic plural handling (e.g. `dog` matches `dogs`).
- **Photo viewer** — fullscreen viewing with pinch-to-zoom, swipe left/right to navigate, swipe down to close, and one-tap share.
- **Long-press radial menu** — gestures directly on a photo to:
  - Open it in the system gallery
  - Share
  - View fullscreen
  - Enter multi-select mode
  - Save to a collection
- **Collections** — organize photos into named boards (the Collections tab).
- **Multi-select** — select multiple photos and share.
- **Backend connection setup** — enter your laptop's backend URL once; it's persisted and reused on launch.
- **Dark & light mode** — follows the system appearance.

## How it works

```
┌──────────────────┐   POST /index (image)   ┌──────────────────────────┐
│   Seekr (app)    │ ───────────────────────► │  FastAPI + Ollama        │
│                  │ ◄─────────────────────── │  backend on your laptop  │
│  Expo / RN       │   { description, tags }  │  (vision-language model) │
│  SQLite storage  │                          └──────────────────────────┘
└──────────────────┘
```

1. The app reads your photo library via `expo-media-library` (batches of 20).
2. Each unindexed photo is uploaded to the backend, which runs a vision-language model to produce a caption and a set of tags.
3. The description and tags are saved to an on-device SQLite database (`photosearch.db`) via `expo-sqlite`.
4. Searches run against the local database — no network needed for searching afterward.

`react-native-executorch` is initialized at startup as groundwork for on-device model inference, but image understanding is currently handled by the external backend.

## Prerequisites

- **Node.js** and **npm**
- An **Android device/emulator or iOS simulator** setup for Expo
- A running **FastAPI + Ollama backend** reachable over your local network

> Note: on Android, cleartext (HTTP) traffic to your local backend is enabled via `expo-build-properties`.

### Backend API contract

Seekr expects a backend exposing two endpoints:

| Endpoint  | Method | Request                          | Response                                   |
| --------- | ------ | -------------------------------- | ------------------------------------------ |
| `/`       | GET    | —                                | `{ "status": "running" }`                  |
| `/index`  | POST   | multipart `file` (image/jpeg)    | `{ "description": "...", "tags": ["..."] }` |

The backend should be bound to `0.0.0.0` so the phone can reach it. On your phone, enter your laptop's LAN address (e.g. `192.168.100.239:8000`) in the in-app **Backend** setup screen.

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the app:

   ```bash
   npx expo start
   ```

3. Open the app in Expo Go, a device simulator, or a development build.

4. On first launch, connect to your backend by entering your laptop's URL (`http://<laptop-ip>:8000`).

5. Tap **Start Indexing Gallery** to begin describing your photos.

> Requires media-library and notification permissions, which the app prompts for.

## Commands

| Command                  | Description                          |
| ------------------------ | ------------------------------------ |
| `npm start` / `npx expo start` | Start the development server    |
| `npm run android`        | Build and run on Android             |
| `npm run ios`            | Build and run on iOS                 |
| `npm run web`            | Run in the browser                   |
| `npm run lint`           | Run ESLint                           |
| `eas build`              | Build a production/dev build via EAS |

## Project structure

```
app/                        expo-router routes (file-based)
  _layout.tsx               Root layout; initializes react-native-executorch
  (tabs)/                   Bottom tabs (Home, Collections)
  modal.tsx                 Example modal route
screens/
  HomeScreen.tsx            Main screen: search, indexing, gestures, viewer
components/
  PhotoViewer.tsx           Fullscreen photo viewer (zoom, swipe, share)
app/(tabs)/explore.tsx      Collections browsing screen
services/
  database.ts               SQLite schema + queries (photos, collections, settings)
  vlm.ts                    Backend API client (description/tags)
  indexingService.ts        Progress notifications during indexing
constants/theme.ts          Color palette (light/dark)
```

## Tech stack

- [Expo SDK 54](https://expo.dev) + React Native 0.81
- [expo-router](https://docs.expo.dev/router/introduction) v6 — file-based navigation
- [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite) — on-device storage
- [expo-media-library](https://docs.expo.dev/versions/latest/sdk/media-library) — photo library access
- [expo-notifications](https://docs.expo.dev/versions/latest/sdk/notifications) — indexing progress
- [react-native-executorch](https://github.com/facebook/react-native-executorch) — on-device ML runtime (initialized)
- [react-native-reanimated](https://docs.swmansion.com/react-native-reanimated) — animations
- [@expo/vector-icons](https://docs.expo.dev/guides/icons) (Feather, MaterialCommunityIcons)

## License

Private project.
