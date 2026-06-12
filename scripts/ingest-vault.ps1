# Trigger LightRAG to scan and ingest the memory vault
# Run AFTER start-rag.bat is running
$response = Invoke-RestMethod -Uri "http://localhost:9621/documents/scan" -Method POST -ContentType "application/json"
Write-Host "Ingest triggered: $($response | ConvertTo-Json)"
