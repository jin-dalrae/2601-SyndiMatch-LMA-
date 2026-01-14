# Cloud Run Deployment Troubleshooting Guide

## Common Issues and Solutions

### 1. Check Build Logs

Go to [Google Cloud Console](https://console.cloud.google.com/run) → Your Service → **Logs** tab

Look for errors like:
- `Module not found`
- `Cannot find module`
- `Port already in use`
- `Connection refused`

### 2. Common Errors

#### Error: "Cannot find module"
**Solution**: Make sure all dependencies are in `package.json`

```bash
# Check if all required modules are listed
cat package.json

# If missing, add them:
npm install --save express cors mongodb dotenv
```

#### Error: "Port binding failed"
**Solution**: Cloud Run sets PORT automatically. Make sure your code uses `process.env.PORT`:

```javascript
const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
```

#### Error: "MongoDB connection failed"
**Solution**: Set environment variables in Cloud Run:

```bash
gcloud run services update syndimatch-api \
  --region us-west1 \
  --set-env-vars "MONGODB_URI=your-mongodb-uri"
```

#### Error: "fetch is not defined" (Node.js < 18)
**Solution**: Node.js 18+ has built-in fetch. Make sure Dockerfile uses Node 18+:

```dockerfile
FROM node:18-slim
```

### 3. Step-by-Step Debugging

#### Step 1: Test Docker Build Locally

```bash
# Build locally
docker build -t syndimatch-test .

# Run locally
docker run -p 8080:8080 \
  -e PORT=8080 \
  -e MONGODB_URI=your-uri \
  syndimatch-test

# Test
curl http://localhost:8080/api/health
```

#### Step 2: Check Cloud Run Service Status

1. Go to [Cloud Run Console](https://console.cloud.google.com/run)
2. Click on your service
3. Check **Revisions** tab - see if latest revision is active
4. Check **Logs** tab - look for startup errors

#### Step 3: Verify Environment Variables

In Cloud Run Console → Your Service → **Variables & Secrets**:
- `MONGODB_URI` - Must be set
- `AGENTS_SERVICE_URL` - Optional (for Python integration)
- `PORT` - Automatically set by Cloud Run

#### Step 4: Check Service Health

```bash
# Get service URL
SERVICE_URL=$(gcloud run services describe syndimatch-api \
  --region us-west1 \
  --format 'value(status.url)')

# Test health endpoint
curl $SERVICE_URL/api/health
```

### 4. Fix Common Dockerfile Issues

#### Issue: Missing files in Docker image

**Fix**: Make sure `.dockerignore` doesn't exclude needed files:

```dockerfile
# .dockerignore should NOT exclude:
# - server/
# - package.json
# - index.html
# - js/
# - styles/
```

#### Issue: Wrong working directory

**Fix**: Ensure Dockerfile sets WORKDIR correctly:

```dockerfile
WORKDIR /app
COPY server/ ./server/  # Files go to /app/server/
```

### 5. Deployment Commands

#### Deploy with source (recommended)

```bash
gcloud run deploy syndimatch-api \
  --source . \
  --region us-west1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --timeout 300 \
  --set-env-vars "MONGODB_URI=your-mongodb-uri"
```

#### Deploy with existing image

```bash
# Build and push first
gcloud builds submit --tag gcr.io/PROJECT_ID/syndimatch-api

# Then deploy
gcloud run deploy syndimatch-api \
  --image gcr.io/PROJECT_ID/syndimatch-api \
  --region us-west1
```

### 6. Check Logs

#### View recent logs

```bash
gcloud run services logs read syndimatch-api \
  --region us-west1 \
  --limit 50
```

#### Stream logs in real-time

```bash
gcloud run services logs tail syndimatch-api \
  --region us-west1
```

### 7. Common Fixes

#### Fix: Server crashes on startup

**Check**:
1. MongoDB connection string is correct
2. All required environment variables are set
3. Server code doesn't have syntax errors

**Test locally first**:
```bash
MONGODB_URI=your-uri node server/index.js
```

#### Fix: 502 Bad Gateway

**Causes**:
- Server not listening on `0.0.0.0`
- Wrong port
- Server crashes before responding

**Solution**:
```javascript
// Make sure server listens on all interfaces
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on 0.0.0.0:${PORT}`);
});
```

#### Fix: Timeout errors

**Solution**: Increase timeout in Cloud Run:

```bash
gcloud run services update syndimatch-api \
  --region us-west1 \
  --timeout 300
```

### 8. Quick Health Check Script

Create `test-deployment.sh`:

```bash
#!/bin/bash
SERVICE_URL="https://your-service-url.run.app"

echo "Testing $SERVICE_URL..."

# Health check
curl -f "$SERVICE_URL/api/health" || echo "❌ Health check failed"

# Test MongoDB connection (if endpoint exists)
curl -f "$SERVICE_URL/api/syndications" || echo "❌ MongoDB connection failed"

echo "✅ Tests complete"
```

### 9. Still Not Working?

1. **Check Cloud Run Console**:
   - Service status
   - Latest revision
   - Logs for errors

2. **Verify Dockerfile**:
   ```bash
   docker build -t test . && docker run test
   ```

3. **Test locally with same env vars**:
   ```bash
   export MONGODB_URI=your-uri
   export PORT=8080
   node server/index.js
   ```

4. **Check Node.js version compatibility**:
   - Ensure Node 18+ for built-in fetch
   - Check `package.json` engines if specified

### 10. Get Help

If still stuck, check:
- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- Service logs in Cloud Console
- Build logs in Cloud Build

## Quick Checklist

- [ ] Dockerfile uses Node 18+
- [ ] Server listens on `0.0.0.0` and `process.env.PORT`
- [ ] All dependencies in `package.json`
- [ ] `MONGODB_URI` environment variable set
- [ ] `.dockerignore` doesn't exclude needed files
- [ ] Service is deployed and active
- [ ] Health endpoint returns 200 OK


