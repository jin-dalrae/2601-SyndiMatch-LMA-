# SyndiMatch Agents - Google Cloud Run Deployment Guide

## Prerequisites

1. **Google Cloud SDK** installed and authenticated
   ```bash
   gcloud auth login
   gcloud config set project syndimatch-7383b
   ```

2. **Docker** installed (for local builds)

3. **Enable required APIs**:
   ```bash
   gcloud services enable run.googleapis.com
   gcloud services enable containerregistry.googleapis.com
   gcloud services enable cloudbuild.googleapis.com
   ```

## Option 1: Deploy with Script (Recommended)

1. **Make the script executable**:
   ```bash
   chmod +x deploy-cloudrun.sh
   ```

2. **Set up secrets** (if using Secret Manager):
   ```bash
   # Create secrets
   echo -n "your-mongodb-uri" | gcloud secrets create MONGODB_URI --data-file=-
   echo -n "your-anthropic-key" | gcloud secrets create ANTHROPIC_API_KEY --data-file=-
   echo -n "your-cdp-key-name" | gcloud secrets create CDP_API_KEY_NAME --data-file=-
   echo -n "your-cdp-private-key" | gcloud secrets create CDP_API_KEY_PRIVATE_KEY --data-file=-
   echo -n "base-sepolia" | gcloud secrets create CDP_NETWORK --data-file=-
   ```

3. **Run the deployment script**:
   ```bash
   ./deploy-cloudrun.sh
   ```

## Option 2: Manual Deployment

### Step 1: Build and Push Docker Image

```bash
cd agents

# Build the image
docker build -t gcr.io/syndimatch-7383b/syndimatch-agents:latest .

# Push to Google Container Registry
docker push gcr.io/syndimatch-7383b/syndimatch-agents:latest
```

### Step 2: Deploy to Cloud Run

```bash
gcloud run deploy syndimatch-agents \
  --image gcr.io/syndimatch-7383b/syndimatch-agents:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 3600 \
  --max-instances 10 \
  --min-instances 0 \
  --set-env-vars "MONGODB_URI=your-mongodb-uri,ANTHROPIC_API_KEY=your-key,CDP_NETWORK=base-sepolia"
```

### Step 3: Set Environment Variables (Alternative - Using Secret Manager)

For better security, use Secret Manager:

```bash
# Create secrets
gcloud secrets create MONGODB_URI --data-file=- <<< "your-mongodb-uri"
gcloud secrets create ANTHROPIC_API_KEY --data-file=- <<< "your-anthropic-key"

# Update service to use secrets
gcloud run services update syndimatch-agents \
  --region us-central1 \
  --update-secrets MONGODB_URI=MONGODB_URI:latest,ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest
```

## Option 3: Deploy with Cloud Build

1. **Set substitution variables**:
   ```bash
   gcloud builds submit --config=cloudbuild.yaml \
     --substitutions=_MONGODB_URI="your-uri",_ANTHROPIC_API_KEY="your-key"
   ```

## Configuration

### Environment Variables

Required:
- `MONGODB_URI` - Your MongoDB connection string
- `ANTHROPIC_API_KEY` - Anthropic Claude API key (optional, for AI features)
- `CDP_API_KEY_NAME` - Coinbase CDP API key name (optional)
- `CDP_API_KEY_PRIVATE_KEY` - Coinbase CDP private key (optional)
- `CDP_NETWORK` - Network (base-sepolia or base)

Optional:
- `PORT` - Port number (default: 8080, Cloud Run sets this automatically)
- `SYNDIMATCH_TEST_MODE` - Set to "true" for faster testing

### Resource Allocation

Recommended settings:
- **Memory**: 2Gi (agents use LangChain/LangGraph which can be memory-intensive)
- **CPU**: 2 (for faster processing)
- **Timeout**: 3600s (1 hour - syndications can take time)
- **Max Instances**: 10 (scale up during peak)
- **Min Instances**: 0 (scale to zero when idle to save costs)

## Testing the Deployment

1. **Get the service URL**:
   ```bash
   gcloud run services describe syndimatch-agents \
     --region us-central1 \
     --format 'value(status.url)'
   ```

2. **Test health endpoint**:
   ```bash
   curl https://your-service-url.run.app/health
   ```

3. **Test API endpoint**:
   ```bash
   curl https://your-service-url.run.app/api/health
   ```

## Monitoring

### View Logs
```bash
gcloud run services logs read syndimatch-agents --region us-central1
```

### View Metrics
- Go to [Cloud Run Console](https://console.cloud.google.com/run)
- Select `syndimatch-agents` service
- View metrics, logs, and revisions

## Updating the Service

### Update Environment Variables
```bash
gcloud run services update syndimatch-agents \
  --region us-central1 \
  --update-env-vars "NEW_VAR=value"
```

### Rollback to Previous Revision
```bash
gcloud run services update-traffic syndimatch-agents \
  --region us-central1 \
  --to-revisions REVISION_NAME=100
```

## Cost Optimization

1. **Set min-instances to 0** (scales to zero when idle)
2. **Use appropriate memory/CPU** (start with 1Gi/1 CPU, scale up if needed)
3. **Set request timeout** appropriately (don't set too high)
4. **Monitor usage** in Cloud Console

## Troubleshooting

### Container fails to start
- Check logs: `gcloud run services logs read syndimatch-agents --region us-central1`
- Verify environment variables are set correctly
- Check MongoDB connection string format

### Out of memory errors
- Increase memory allocation: `--memory 4Gi`

### Timeout errors
- Increase timeout: `--timeout 7200` (2 hours)

### Connection refused
- Verify `PORT` environment variable is set (Cloud Run sets this automatically)
- Check that the service is listening on `0.0.0.0`, not `127.0.0.1`

## Next Steps

1. Update your frontend/Node.js server to call the Cloud Run service URL
2. Set up monitoring and alerts
3. Configure custom domain (optional)
4. Set up CI/CD pipeline for automatic deployments

## API Endpoints

Once deployed, your service will have these endpoints:

- `GET /health` - Health check
- `GET /api/health` - API health check
- `POST /api/syndications/run` - Run a new syndication
- `POST /api/syndications/resume` - Resume a syndication
- `GET /api/syndications/{id}` - Get syndication status
- `WS /ws` - WebSocket for real-time updates


