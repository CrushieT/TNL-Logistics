param([Parameter(Mandatory = $true)][string]$Label)
$ErrorActionPreference = 'Stop'
if ($Label -notmatch '^[a-zA-Z0-9_-]+$') { throw 'Invalid label' }
New-Item -ItemType Directory -Force -Path (Join-Path $PSScriptRoot 'results') | Out-Null
$settings = @{}
Get-Content -LiteralPath (Join-Path $PSScriptRoot '../.env.loadtest') | ForEach-Object {
    if ($_ -match '^([^#=]+)=(.*)$') { $settings[$matches[1].Trim()] = $matches[2].Trim().Trim('"').Trim("'") }
}
$login = Invoke-RestMethod -Uri 'http://localhost:8080/api/v1/auth/login' -Method Post -ContentType 'application/json' -Body (@{
    username = 'loadtest-admin'; password = $settings['LOADTEST_SEED_PASSWORD']
} | ConvertTo-Json)
$headers = @{ Authorization = "Bearer $($login.token)" }
$cycles = Invoke-RestMethod -Uri 'http://localhost:8080/api/v1/collections/cycles' -Headers $headers
$results = foreach ($cycle in $cycles) {
    $collection = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/collections/weekly?targetDate=$cycle" -Headers $headers
    $collection.items = @($collection.items | Sort-Object clientId)
    $dashboard = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/dashboard/summary?cycle=$cycle" -Headers $headers
    # Save response data only; omit authentication and device sessions.
    @{ cycle = $cycle; collection = $collection; dashboard = $dashboard }
}
$results | ConvertTo-Json -Depth 30 | Set-Content -Encoding UTF8 -LiteralPath (Join-Path $PSScriptRoot "results/$Label-financial.json")
Write-Output "Captured $($cycles.Count) cycle responses."
