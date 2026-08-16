# Veritas Backend (Node.js + Express + MongoDB)

Real, runnable starter backend for the Digital Evidence Verification & Cyber Safety Platform.

## What's real vs. placeholder

| Feature | Status |
|---|---|
| Auth (register/login/JWT/sessions) | ✅ Fully working |
| File upload, SHA-256 hashing, dedup | ✅ Fully working (genuine crypto hash) |
| EXIF/metadata extraction | ✅ Fully working (uses `exifr`, real image metadata) |
| AI-generated image detection | ✅ Real — calls a **free** Hugging Face Inference API model. Returns `inconclusive` (not a fake number) if no API key is set. |
| Chat/text risk classifier (blackmail, threats, fraud) | ✅ Real — transparent, rule-based, explainable classifier (see `src/services/aiService.js`). No black box, no external cost. |
| Deepfake video / voice-clone detection | ⚠️ Not included — needs a specialized trained model or paid API; wire it into `evidenceController.analyzeEvidence` when you pick one. |
| Manipulation heatmap (ELA / splicing) | ⚠️ Not included — same reason as above. |
| Firebase | Not used here. Add Firebase Cloud Messaging in the Flutter app if you want push notifications; everything else (auth, storage, DB) is Node/Mongo per your request. |

## Setup

```bash
cd backend
npm install
cp .env.example .env
# edit .env: set MONGO_URI and (optionally) HUGGINGFACE_API_KEY
npm run dev
```

Get a **free** Hugging Face token: https://huggingface.co/settings/tokens — paste it into `HUGGINGFACE_API_KEY` in `.env`. Without it, image analysis still runs but returns `inconclusive` instead of guessing.

MongoDB: use a local `mongod`, or a free MongoDB Atlas cluster — just paste the connection string into `MONGO_URI`.

## API Reference

Base URL: `http://localhost:5000/api`

### Auth
| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/auth/register` | `{name, email, password}` | Returns `{token, user}` |
| POST | `/auth/login` | `{email, password}` | Returns `{token, user}`, logs a session |
| GET | `/auth/me` | — (Bearer token) | Current user |
| GET | `/auth/sessions` | — (Bearer token) | Active/past sessions |
| POST | `/auth/logout-all` | — (Bearer token) | Revokes all sessions |

### Evidence
| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/evidence/upload` | `multipart/form-data`, field `file` | Hashes + extracts metadata, creates Evidence ID |
| POST | `/evidence/:id/analyze` | — | Runs AI analysis (image AI-detection today) |
| POST | `/evidence/analyze-text` | `{text}` | Rule-based chat risk analysis |
| GET | `/evidence` | — | List your evidence |
| GET | `/evidence/:id` | — | Get one item, logs access + timeline event |

### Cases
| Method | Path | Body |
|---|---|---|
| POST | `/cases` | `{title, category}` |
| GET | `/cases` | — |
| GET | `/cases/:id` | — |
| POST | `/cases/:id/evidence` | `{evidenceId}` |
| PATCH | `/cases/:id/status` | `{status}` |
| POST | `/cases/:id/notes` | `{text}` |

All routes except register/login require `Authorization: Bearer <token>`.

## Security notes for production
- Put uploads in encrypted object storage (S3 + SSE, or similar), not local disk.
- Add virus/malware scanning (e.g. ClamAV) before accepting uploads.
- Add 2FA (TOTP) — the `User` model already has fields reserved for it.
- Put this behind HTTPS/TLS; `helmet()` is already enabled for basic header hardening.
- Add audit-log shipping (don't just keep logs in Mongo documents for high-scale use).
