param([int]$DurationSeconds = 210, [string]$Label = 'resources')
$ErrorActionPreference = 'Stop'
if ($Label -notmatch '^[a-zA-Z0-9_-]+$') { throw 'Invalid label' }
New-Item -ItemType Directory -Force -Path (Join-Path $PSScriptRoot 'results') | Out-Null
$samples = [System.Collections.Generic.List[object]]::new()
$startedAt = [DateTime]::UtcNow
while (([DateTime]::UtcNow - $startedAt).TotalSeconds -lt $DurationSeconds) {
    $timestamp = [DateTime]::UtcNow.ToString('o')
    docker stats --no-stream --format '{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}' tnl-sim-50k-backend-sim-1 tnl-sim-50k-mysql-sim-1 | ForEach-Object {
        $fields = $_.Split('|')
        $samples.Add(@{ timestamp = $timestamp; container = $fields[0]; cpu = $fields[1]; memory = $fields[2] })
    }
    Start-Sleep -Seconds 5
}
$ErrorActionPreference = 'Continue'
$timeoutCount = @(docker logs --since $startedAt.ToString('o') tnl-sim-50k-backend-sim-1 2>&1 | Select-String 'SQLTransientConnectionException:.*Connection is not available, request timed out').Count
@{ samples = $samples; connectionPoolTimeouts = $timeoutCount } | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 -LiteralPath (Join-Path $PSScriptRoot "results/$Label-resources.json")
