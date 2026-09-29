#!/usr/bin/env bash
# Deploy shipping_doc_extractor container to Google Cloud Run
set -e

# Configuration (Customize as needed)
PROJECT_ID=${GOOGLE_CLOUD_PROJECT:-$(gcloud config get-value project 2>/dev/null)}
REGION="us-central1"
SERVICE_NAME="shipping-doc-extractor"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest"
GEMINI_MODEL=${GEMINI_MODEL:-"gemini-2.5-flash"}

if [ -z "$PROJECT_ID" ]; then
  echo "Error: Google Cloud project ID not found. Please set GOOGLE_CLOUD_PROJECT or run 'gcloud config set project <PROJECT_ID>'."
  exit 1
fi

echo "=================================================="
echo " Deploying ${SERVICE_NAME} to Google Cloud Run"
echo " Project: ${PROJECT_ID}"
echo " Region:  ${REGION}"
echo "=================================================="

# Enable required Google Cloud services
echo "--> Enabling required APIs..."
gcloud services enable run.googleapis.com cloudbuild.googleapis.com containerregistry.googleapis.com --project="${PROJECT_ID}"

# Option A: Build and deploy directly using Cloud Build & Cloud Run
echo "--> Submitting build to Google Cloud Build & deploying to Cloud Run..."
gcloud run deploy "${SERVICE_NAME}" \
  --source . \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080 \
  --memory=1Gi \
  --cpu=1 \
  --set-env-vars="NODE_ENV=production,GEMINI_MODEL=${GEMINI_MODEL}"

echo "=================================================="
echo " Deployment Complete!"
echo " Service URL: $(gcloud run services describe ${SERVICE_NAME} --project=${PROJECT_ID} --region=${REGION} --format='value(status.url)')"
echo "=================================================="
echo "Note: If you need to set your Gemini API Key in Cloud Run, run:"
echo "gcloud run services update ${SERVICE_NAME} --update-env-vars GEMINI_API_KEY=\"<YOUR_API_KEY>\" --region=${REGION} --project=${PROJECT_ID}"
