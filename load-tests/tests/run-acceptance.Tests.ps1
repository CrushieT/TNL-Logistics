param([string]$Case = '')

$ErrorActionPreference = 'Stop'
$runnerPath = Join-Path $PSScriptRoot '../run-acceptance.ps1'

if (-not $Case) {
    $tokens = $null
    $parseErrors = $null
    [System.Management.Automation.Language.Parser]::ParseFile(
        $runnerPath, [ref]$tokens, [ref]$parseErrors) | Out-Null
    if ($parseErrors.Count -ne 0) { throw 'Acceptance runner has PowerShell parse errors' }

    $cases = @('success', 'threshold-failure', 'setup-failure', 'report-failure',
        'threshold-and-report-failure', 'sanitize-failure', 'threshold-and-sanitize-failure',
        'missing-summary', 'monitor-start-failure',
        'monitor-remove-failure', 'launch-failure')
    foreach ($scenario in $cases) {
        & (Join-Path $PSHOME 'powershell.exe') -NoProfile -ExecutionPolicy Bypass -File $PSCommandPath -Case $scenario
        if ($LASTEXITCODE -ne 0) { throw "Acceptance runner regression failed: $scenario" }
    }
    Write-Host "Passed $($cases.Count) mocked acceptance runner cases and parsing. No Docker commands or workloads ran."
    exit 0
}

$global:acceptanceTestState = @{
    Scenario = $Case
    MonitorStarted = $false
    MonitorStopped = 0
    MonitorRemoved = 0
    SavedReports = @{}
    DockerCalls = [System.Collections.Generic.List[string]]::new()
}

function Assert-Condition([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw $Message }
}

function New-Item { param($ItemType, [switch]$Force, $Path) }
function Write-Host { param([Parameter(ValueFromRemainingArguments = $true)]$Object) }
function Get-Process { param($Name, $ErrorAction) return @() }
function Get-Content {
    param($LiteralPath, [switch]$Raw)
    if ($LiteralPath.EndsWith('.env.loadtest')) { return 'LOADTEST_SEED_PASSWORD=mock-credential' }
    return '{"metrics":{"checks":{"passes":1}},"root_group":{"name":"test"},"options":{"env":{"LOADTEST_PASSWORD":"mock-credential"}}}'
}
function Test-Path { param($LiteralPath) return $global:acceptanceTestState.scenario -ne 'missing-summary' }
function Set-Content {
    param($LiteralPath, $Encoding, [Parameter(ValueFromPipeline = $true)]$Value)
    process {
        if ($global:acceptanceTestState.scenario -in @('sanitize-failure', 'threshold-and-sanitize-failure') -and -not $LiteralPath.EndsWith('-resources.json')) {
            throw 'Mock report write failure'
        }
        $global:acceptanceTestState.savedReports[$LiteralPath] = $Value
    }
}
function Start-Job {
    param($ScriptBlock, $ArgumentList)
    if ($global:acceptanceTestState.scenario -eq 'monitor-start-failure') { throw 'Mock monitor startup failure' }
    $global:acceptanceTestState.monitorStarted = $true
    return [pscustomobject]@{ State = 'Running' }
}
function Stop-Job {
    param($Job, $ErrorAction)
    $global:acceptanceTestState.monitorStopped++
    $Job.State = 'Stopped'
}
function Receive-Job {
    param($Job)
    return @{ container = 'mock-backend'; cpu = '1%'; memory = '100MiB' }
}
function Remove-Job {
    param($Job, [switch]$Force, $ErrorAction)
    $global:acceptanceTestState.monitorRemoved++
    if ($global:acceptanceTestState.scenario -eq 'monitor-remove-failure') { throw 'Mock monitor removal failure' }
}
function docker {
    $global:acceptanceTestState.dockerCalls.Add([string]$args[0])
    $global:LASTEXITCODE = 0
    switch ($args[0]) {
        'exec' { return @('shipments parcels events waybills soas payments', '10 20 30 4 5 6') }
        'run' {
            Assert-Condition ($env:LOADTEST_PASSWORD -eq 'mock-credential') 'Credential was not passed through the environment'
            Assert-Condition (-not (($args -join ' ').Contains('mock-credential'))) 'Credential leaked into Docker arguments'
            if ($global:acceptanceTestState.scenario -eq 'launch-failure') { throw 'Mock Docker launch failure' }
            if ($global:acceptanceTestState.scenario -in @('threshold-failure', 'threshold-and-report-failure', 'threshold-and-sanitize-failure')) { $global:LASTEXITCODE = 99 }
            if ($global:acceptanceTestState.scenario -eq 'setup-failure') { $global:LASTEXITCODE = 107 }
        }
        'logs' {
            if ($global:acceptanceTestState.scenario -in @('report-failure', 'threshold-and-report-failure')) { $global:LASTEXITCODE = 7 }
            return 'mock backend logs'
        }
        'inspect' { return '0' }
        default { throw 'Unexpected mocked Docker operation' }
    }
}

& $runnerPath -Run normal -Label mocked-exit-status
$actualExitCode = $LASTEXITCODE
$expectedExitCode = switch ($Case) {
    'success' { 0 }
    'threshold-failure' { 99 }
    'threshold-and-report-failure' { 99 }
    'threshold-and-sanitize-failure' { 99 }
    'setup-failure' { 107 }
    default { 1 }
}
Assert-Condition ($actualExitCode -eq $expectedExitCode) "Wrong runner exit status for $Case"
Assert-Condition (-not (Microsoft.PowerShell.Management\Test-Path Env:LOADTEST_PASSWORD)) 'Temporary credential environment variable survived cleanup'
if ($global:acceptanceTestState.monitorStarted) {
    Assert-Condition ($global:acceptanceTestState.monitorStopped -ge 1) 'Resource monitor was not stopped'
    Assert-Condition ($global:acceptanceTestState.monitorRemoved -eq 1) 'Resource monitor removal was not attempted'
}
if ($Case -notin @('sanitize-failure', 'threshold-and-sanitize-failure', 'missing-summary')) {
    $summaryPath = @($global:acceptanceTestState.savedReports.Keys | Where-Object { -not $_.EndsWith('-resources.json') })
    Assert-Condition ($summaryPath.Count -eq 1) 'Summary sanitization was skipped'
    $summary = $global:acceptanceTestState.savedReports[$summaryPath[0]] | ConvertFrom-Json
    Assert-Condition ($null -eq $summary.options) 'Credential-bearing summary options were retained'
    Assert-Condition ($null -ne $summary.metrics -and $null -ne $summary.root_group) 'Sanitization dropped report metrics'
}
if ($Case -in @('success', 'threshold-failure', 'setup-failure')) {
    Assert-Condition ($global:acceptanceTestState.savedReports.Count -eq 2) 'Reports were not collected after k6 finished'
    Assert-Condition ($global:acceptanceTestState.dockerCalls.Contains('inspect')) 'Later Docker commands did not run'
}
Microsoft.PowerShell.Utility\Write-Host "PASS: $Case"
exit 0
