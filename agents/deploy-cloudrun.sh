#!/bin/bash
# SyndiMatch Agents - Google Cloud Run Deployment Script

set -e

# Configuration
PROJECT_ID="syndimatch-7383b"
SERVICE_NAME="syndimatch-agents"
REGION="us-central1"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo "🚀 Deploying SyndiMatch Agents to Cloud Run..."

# Set the project
gcloud config set project ${PROJECT_ID}

# Build the Docker image
echo "📦 Building Docker image..."
cd "$(dirname "$0")"
docker build -t ${IMAGE_NAME}:latest .

# Push to Google Container Registry
echo "📤 Pushing image to GCR..."
docker push ${IMAGE_NAME}:latest

# Deploy to Cloud Run
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
  --image ${IMAGE_NAME}:latest \
  --platform managed \
  --region ${REGION} \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 3600 \
  --max-instances 10 \
  --min-instances 0 \
  --set-env-vars "PORT=8080" \
  --set-secrets "MONGODB_URI=MONGODB_URI:latest,ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest,CDP_API_KEY_NAME=CDP_API_KEY_NAME:latest,CDP_API_KEY_PRIVATE_KEY=CDP_API_KEY_PRIVATE_KEY:latest,CDP_NETWORK=CDP_NETWORK:latest"

# Get the service URL
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format 'value(status.url)')

echo "✅ Deployment complete!"
echo "📍 Service URL: ${SERVICE_URL}"
echo "📊 View logs: gcloud run services logs read ${SERVICE_NAME} --region ${REGION}"


