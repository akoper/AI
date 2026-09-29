# Deploy shipping_doc_extractor container to Google Cloud Run (PowerShell)
param (
    [string]$ProjectId = $env:GOOGLE_CLOUD_PROJECT,
    [string]$Region = "us-central1",
    [string]$ServiceName = "shipping-doc-extractor",
    [string]$GeminiApiKey = "",
    [string]$GeminiModel = "gemini-2.5-flash"
)

if (-not $ProjectId) {
    $ProjectId = (gcloud config get-value project 2>$null)
}

if (-not $ProjectId) {
    Write-Error "Google Cloud project ID not found. Please provide -ProjectId or set GOOGLE_CLOUD_PROJECT."
    exit 1
}

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " Deploying $ServiceName to Google Cloud Run" -ForegroundColor Cyan
Write-Host " Project: $ProjectId" -ForegroundColor Cyan
Write-Host " Region:  $Region" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

Write-Host "--> Enabling required APIs..." -ForegroundColor Yellow
gcloud services enable run.googleapis.com cloudbuild.googleapis.com containerregistry.googleapis.com --project=$ProjectId

$envVars = "NODE_ENV=production,GEMINI_MODEL=$GeminiModel"
if ($GeminiApiKey) {
    $envVars += ",GEMINI_API_KEY=$GeminiApiKey"
}

Write-Host "--> Submitting build to Google Cloud Build & deploying to Cloud Run..." -ForegroundColor Yellow
gcloud run deploy $ServiceName `
    --source . `
    --project=$ProjectId `
    --region=$Region `
    --platform=managed `
    --allow-unauthenticated `
    --port=8080 `
    --memory=1Gi `
    --cpu=1 `
    --set-env-vars=$envVars

Write-Host "==================================================" -ForegroundColor Green
Write-Host " Deployment Complete!" -ForegroundColor Green
$ServiceUrl = (gcloud run services describe $ServiceName --project=$ProjectId --region=$Region --format="value(status.url)")
Write-Host " Service URL: $ServiceUrl" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
