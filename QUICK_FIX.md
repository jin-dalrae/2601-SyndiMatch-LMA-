# Quick Fix for Cloud Run Deployment

## Most Common Issues:

### 1. Server Not Listening on 0.0.0.0 ✅ FIXED
**Problem**: Cloud Run requires listening on `0.0.0.0`, not `localhost`

**Fix Applied**: Updated `server/index.js` to listen on `0.0.0.0`

### 2. Check Your Deployment

Go to [Cloud Run Console](https://console.cloud.google.com/run) and:

1. **Click on your service**
2. **Check the "Logs" tab** - Look for errors
3. **Check the "Revisions" tab** - Make sure latest revision is active

### 3. Common Error Messages

#### "Cannot GET /"
- **Cause**: Server not starting properly
- **Fix**: Check logs for startup errors

#### "502 Bad Gateway"
- **Cause**: Server crashed or not responding
- **Fix**: Check logs, verify MongoDB connection

#### "Module not found"
- **Cause**: Missing dependencies
- **Fix**: Make sure `package.json` has all dependencies

### 4. Quick Test Commands

```bash
# 1. Test locally first
MONGODB_URI=your-uri PORT=8080 node server/index.js

# 2. Test health endpoint
curl http://localhost:8080/api/health

# 3. If local works, deploy:
gcloud run deploy syndimatch-api \
  --source . \
  --region us-west1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --set-env-vars "MONGODB_URI=your-mongodb-uri"
```

### 5. What to Check in Cloud Console

1. **Service Status**: Should be "Active"
2. **Latest Revision**: Should show green checkmark
3. **Logs**: Look for:
   - ✅ "Server running on 0.0.0.0:8080"
   - ✅ "MongoDB connected"
   - ❌ Any error messages

### 6. Still Failing?

Share the error message from Cloud Run logs and I'll help fix it!

Common places to find errors:
- Cloud Run → Your Service → **Logs** tab
- Cloud Build → **Build History** (if using source deployment)


