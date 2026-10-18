param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('normal', 'peak', 'growth')][string]$Run,
    [string]$Label = ''
)

$ErrorActionPreference = 'Stop'
if (-not $Label) {
    $Label = "acceptance-$Run"
}
if ($Label -notmatch '^[a-zA-Z0-9_-]+$') {
    throw 'Label must contain only letters, digits, underscores and hyphens'
}

New-Item -ItemType Directory -Force -Path (Join-Path $PSScriptRoot 'results') | Out-Null

# 1. Read test password from .env.loadtest
$settings = @{}
Get-Content -LiteralPath (Join-Path $PSScriptRoot '../.env.loadtest') | ForEach-Object {
    if ($_ -match '^([^#=]+)=(.*)$') {
        $settings[$matches[1].Trim()] = $matches[2].Trim().Trim('"').Trim("'")
    }
}
$password = $settings['LOADTEST_SEED_PASSWORD']
if (-not $password) { throw 'LOADTEST_SEED_PASSWORD is required in .env.loadtest' }

# 2. Configure target by run mode
if ($Run -eq 'growth') {
    $baseUrl = 'http://host.docker.internal:8084'
    $courierVUs = 9
    $backendContainer = 'tnl-admin-opt-growth-backend-growth-1'
    $mysqlContainer = 'tnl-admin-opt-growth-mysql-growth-1'
    $mysqlPort = 3309
} elseif ($Run -eq 'peak') {
    $baseUrl = 'http://host.docker.internal:8080'
    $courierVUs = 9
    $backendContainer = 'tnl-sim-50k-backend-sim-1'
    $mysqlContainer = 'tnl-sim-50k-mysql-sim-1'
    $mysqlPort = 3308
} else { # normal
    $baseUrl = 'http://host.docker.internal:8080'
    $courierVUs = 5
    $backendContainer = 'tnl-sim-50k-backend-sim-1'
    $mysqlContainer = 'tnl-sim-50k-mysql-sim-1'
    $mysqlPort = 3308
}

Write-Host "=========================================================="
Write-Host " Running Acceptance Benchmark: $Run (Label: $Label)"
Write-Host " Target: $baseUrl | Couriers: $courierVUs | DB Port: $mysqlPort"
Write-Host "=========================================================="

# 3. Check Mem Reduct status before run
$memReductBefore = (Get-Process *memreduct* -ErrorAction SilentlyContinue).Count -gt 0
Write-Host "Mem Reduct running before run: $memReductBefore"

# 4. Record pre-run business counts
function Get-DbCounts($container) {
    $query = "SELECT (SELECT COUNT(*) FROM shipment) AS shipments, (SELECT COUNT(*) FROM parcel_unit) AS parcels, (SELECT COUNT(*) FROM tracking_event) AS events, (SELECT COUNT(*) FROM waybill) AS waybills, (SELECT COUNT(*) FROM soa) AS soas, (SELECT COUNT(*) FROM payment) AS payments;"
    $raw = @($query | docker exec -i $container sh -c 'MYSQL_PWD=$MYSQL_PASSWORD exec mysql -u $MYSQL_USER $MYSQL_DATABASE')
    if ($LASTEXITCODE -ne 0) { throw 'Failed to read simulation database counts' }
    $dataLine = ($raw | Where-Object { $_ -match '^\d+' } | Select-Object -First 1)
    if ($dataLine) {
        $cols = $dataLine.ToString().Trim() -split "\s+"
        return @{
            shipments = [long]$cols[0]
            parcels = [long]$cols[1]
            events = [long]$cols[2]
            waybills = [long]$cols[3]
            soas = [long]$cols[4]
            payments = [long]$cols[5]
        }
    }
    return $null
}

$monitorJob = $null
$k6ExitCode = $null
$runnerExitCode = 0
$summaryFileHost = Join-Path $PSScriptRoot "results/$Label.json"

try {
    $countsBefore = Get-DbCounts $mysqlContainer
    Write-Host "Business record counts before run:"
    Write-Host ($countsBefore | Out-String)

    # 5. Start background resource monitoring
    $startedAtUtc = [DateTime]::UtcNow

    $monitorJob = Start-Job -ScriptBlock {
        param($backend, $mysql, $durationSec)
        $start = [DateTime]::UtcNow
        while (([DateTime]::UtcNow - $start).TotalSeconds -lt $durationSec) {
            $ts = [DateTime]::UtcNow.ToString('o')
            $raw = docker stats --no-stream --format '{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}' $backend $mysql 2>$null
            if ($LASTEXITCODE -ne 0) { throw 'Failed to collect resource samples' }
            if ($raw) {
                foreach ($line in ($raw -split "`n")) {
                    if ($line.Trim()) {
                        $parts = $line.Trim().Split('|')
                        Write-Output @{ timestamp = $ts; container = $parts[0]; cpu = $parts[1]; memory = $parts[2] }
                    }
                }
            }
            Start-Sleep -Seconds 5
        }
    } -ArgumentList $backendContainer, $mysqlContainer, 690

    # 6. Execute k6 benchmark (60s warm-up + 600s measured = 660s)
    Write-Host "Launching k6 container for 60s warm-up + 600s measured run..."
    $summaryFileContainer = "/scripts/results/$Label.json"

    try {
        $env:LOADTEST_PASSWORD = $password
        docker run --rm `
            -e BASE_URL=$baseUrl `
            -e LOADTEST_PASSWORD `
            -e COURIER_VUS=$courierVUs `
            -e WARMUP_SECONDS=60 `
            -e MEASURED_SECONDS=600 `
            -e SUMMARY_PATH=$summaryFileContainer `
            -v "${PSScriptRoot}:/scripts" `
            grafana/k6 run /scripts/concurrent-acceptance.js

        $k6ExitCode = $LASTEXITCODE
        $runnerExitCode = $k6ExitCode
    } finally {
        Remove-Item Env:LOADTEST_PASSWORD -ErrorAction SilentlyContinue
    }

    Write-Host "k6 run finished with exit code $k6ExitCode"

    # 7. Stop resource monitor and collect samples
    Stop-Job -Job $monitorJob
    $jobOutput = Receive-Job -Job $monitorJob
    if ($monitorJob.State -eq 'Failed') { throw 'Resource monitoring failed' }

    # Count Hikari timeouts and container restarts/OOM kills
    $backendLogs = docker logs --since $startedAtUtc.ToString('o') $backendContainer 2>&1
    if ($LASTEXITCODE -ne 0) { throw 'Failed to collect backend logs' }
    $hikariTimeouts = @($backendLogs | Select-String 'SQLTransientConnectionException:.*Connection is not available, request timed out').Count
    $heapErrors = @($backendLogs | Select-String 'java.lang.OutOfMemoryError').Count
    $restartCount = (docker inspect $backendContainer --format '{{.RestartCount}}')
    if ($LASTEXITCODE -ne 0) { throw 'Failed to inspect backend restart count' }

    # 8. Check Mem Reduct after run
    $memReductAfter = (Get-Process *memreduct* -ErrorAction SilentlyContinue).Count -gt 0

    # 9. Record post-run business counts
    $countsAfter = Get-DbCounts $mysqlContainer
    Write-Host "Business record counts after run:"
    Write-Host ($countsAfter | Out-String)

    # 10. Sanitize and save resource metrics
    $resourceResults = @{
        run = $Run
        label = $Label
        startedAtUtc = $startedAtUtc.ToString('o')
        completedAtUtc = [DateTime]::UtcNow.ToString('o')
        memReduct = @{ before = $memReductBefore; after = $memReductAfter }
        countsBefore = $countsBefore
        countsAfter = $countsAfter
        hikariTimeouts = $hikariTimeouts
        javaHeapErrors = $heapErrors
        containerRestartCount = $restartCount
        samples = $jobOutput
    }

    $resourceFile = Join-Path $PSScriptRoot "results/$Label-resources.json"
    $resourceResults | ConvertTo-Json -Depth 6 | Set-Content -Encoding UTF8 -LiteralPath $resourceFile
} catch {
    if ($null -ne $k6ExitCode -and $k6ExitCode -ne 0) {
        $runnerExitCode = $k6ExitCode
    } else {
        $runnerExitCode = 1
    }
    Write-Warning 'Acceptance runner failed before completing report collection.'
} finally {
    Remove-Item Env:LOADTEST_PASSWORD -ErrorAction SilentlyContinue
    try {
        # 11. Sanitize k6 summary if present
        if (Test-Path -LiteralPath $summaryFileHost) {
            $rawSummary = Get-Content -Raw -LiteralPath $summaryFileHost | ConvertFrom-Json
            $sanitizedK6 = @{
                metrics = $rawSummary.metrics
                root_group = $rawSummary.root_group
            }
            $sanitizedK6 | ConvertTo-Json -Depth 30 | Set-Content -Encoding UTF8 -LiteralPath $summaryFileHost
        } elseif ($null -ne $k6ExitCode -and $k6ExitCode -eq 0) {
            throw 'Successful k6 run did not produce a summary'
        }
    } catch {
        if ($runnerExitCode -eq 0) { $runnerExitCode = 1 }
        Write-Warning 'Failed to sanitize the k6 summary.'
    }
    if ($null -ne $monitorJob) {
        try {
            Stop-Job -Job $monitorJob -ErrorAction Stop
        } catch {
            if ($runnerExitCode -eq 0) { $runnerExitCode = 1 }
            Write-Warning 'Failed to stop the resource monitor.'
        }
        try {
            Remove-Job -Job $monitorJob -Force -ErrorAction Stop
        } catch {
            if ($runnerExitCode -eq 0) { $runnerExitCode = 1 }
            Write-Warning 'Failed to remove the resource monitor job.'
        }
    }
}
Write-Host "Acceptance runner $Run ($Label) finished with exit code $runnerExitCode"
exit $runnerExitCode
