# Google Cloud Deployment Guide

This guide explains how to containerize and deploy the **Shipping Document & Invoice AI Extractor** to **Google Cloud Run**.

---

## Prerequisites

1. **Google Cloud Account & Project**: Ensure you have a Google Cloud Project with billing enabled.
2. **Google Cloud SDK (`gcloud` CLI)**: Installed and authenticated (`gcloud auth login`).
3. **Google Gemini API Key**: From [Google AI Studio](https://aistudio.google.com/).

---

## Quick Deployment (Automated)

### Using PowerShell (Windows)
```powershell
.\deploy-gcp.ps1 -ProjectId "YOUR_GCP_PROJECT_ID" -Region "us-central1" -GeminiApiKey "YOUR_GEMINI_API_KEY"
```

### Using Bash (Linux / macOS / WSL)
```bash
chmod +x deploy-gcp.sh
GOOGLE_CLOUD_PROJECT="YOUR_GCP_PROJECT_ID" ./deploy-gcp.sh
```

---

## Step-by-Step Manual Deployment

### 1. Configure GCP Project & Enable APIs
```bash
# Set your active GCP project
gcloud config set project YOUR_PROJECT_ID

# Enable Cloud Run, Cloud Build, and Container Registry APIs
gcloud services enable run.googleapis.com cloudbuild.googleapis.com containerregistry.googleapis.com
```

### 2. Option A: Direct Source Deploy (Recommended)
Cloud Build will automatically read the `Dockerfile` in the root folder, build the multi-stage image, and deploy it to Cloud Run:

```bash
gcloud run deploy shipping-doc-extractor \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --set-env-vars NODE_ENV=production,GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
```

---

### 3. Option B: Build and Push via Artifact Registry / Container Registry

#### Step 3.1: Build & Submit Image
```bash
# Build image using Cloud Build
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/shipping-doc-extractor:latest .
```

#### Step 3.2: Deploy Image to Cloud Run
```bash
gcloud run deploy shipping-doc-extractor \
  --image gcr.io/YOUR_PROJECT_ID/shipping-doc-extractor:latest \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --set-env-vars NODE_ENV=production,GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
```

---

## Environment Variables

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `NODE_ENV` | Application environment | `production` |
| `PORT` | Listening port for Cloud Run | `8080` |
| `GEMINI_API_KEY` | Google Gemini API Key | `AIzaSy...` |
| `GEMINI_MODEL` | Gemini Model ID | `gemini-2.5-flash` |
| `DATABASE_PATH` | Path to SQLite DB file | `/app/data/shipping_docs.db` |

### Updating Environment Variables After Deployment:
```bash
gcloud run services update shipping-doc-extractor \
  --update-env-vars GEMINI_API_KEY="NEW_KEY_HERE" \
  --region us-central1
```

---

## Persistent Storage Note

By default, Cloud Run instances have ephemeral file systems. The SQLite database is created in `/app/data/shipping_docs.db`. 
For persistent storage across restarts and scaling:
- **Cloud Run Volume Mounts**: Mount a Cloud Storage bucket or Google Cloud Filestore (NFS) to `/app/data`.
- **Cloud SQL**: Migrate to Cloud SQL (PostgreSQL / MySQL) for multi-instance production scalability.
