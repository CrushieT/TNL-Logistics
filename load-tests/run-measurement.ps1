param(
    [ValidateSet('diagnostics', 'simulation')][string]$Mode = 'diagnostics',
    [string]$Label = 'measurement',
    [string]$Endpoint = '',
    [int]$Samples = 10
)
$ErrorActionPreference = 'Stop'
if ($Label -notmatch '^[a-zA-Z0-9_-]+$') { throw 'Label must contain only letters, digits, underscores and hyphens' }
New-Item -ItemType Directory -Force -Path (Join-Path $PSScriptRoot 'results') | Out-Null
$settings = @{}
Get-Content -LiteralPath (Join-Path $PSScriptRoot '../.env.loadtest') | ForEach-Object {
    if ($_ -match '^([^#=]+)=(.*)$') { $settings[$matches[1].Trim()] = $matches[2].Trim().Trim('"').Trim("'") }
}
$env:LOADTEST_PASSWORD = $settings['LOADTEST_SEED_PASSWORD']
if (!$env:LOADTEST_PASSWORD) { throw 'LOADTEST_SEED_PASSWORD is required' }
$script = if ($Mode -eq 'diagnostics') { 'endpoint-diagnostics.js' } else { 'realistic-simulation.js' }
try {
    $ErrorActionPreference = 'Continue'
    if ($Mode -eq 'simulation') {
        # Sanitize the built-in export after the unchanged workload finishes.
        docker run --rm -e BASE_URL=http://host.docker.internal:8080 -e LOADTEST_PASSWORD -v "${PSScriptRoot}:/scripts" grafana/k6 run --summary-export "/scripts/results/$Label.json" "/scripts/$script"
        $simulationExitCode = $LASTEXITCODE
        $summaryFile = Join-Path $PSScriptRoot "results/$Label.json"
        if (Test-Path -LiteralPath $summaryFile) {
            $summary = Get-Content -Raw -LiteralPath $summaryFile | ConvertFrom-Json
            @{ metrics = $summary.metrics; root_group = $summary.root_group } | ConvertTo-Json -Depth 30 | Set-Content -Encoding UTF8 -LiteralPath $summaryFile
        }
        $LASTEXITCODE = $simulationExitCode
    } else {
        docker run --rm -e BASE_URL=http://host.docker.internal:8080 -e LOADTEST_PASSWORD -e "ENDPOINT=$Endpoint" -e "SAMPLES=$Samples" -e "SUMMARY_PATH=/scripts/results/$Label.json" -v "${PSScriptRoot}:/scripts" grafana/k6 run "/scripts/$script"
    }
    $measurementExitCode = $LASTEXITCODE
} finally {
    $ErrorActionPreference = 'Stop'
    Remove-Item Env:LOADTEST_PASSWORD
}
exit $measurementExitCode
