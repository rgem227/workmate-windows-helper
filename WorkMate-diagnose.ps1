# ============================================================
#  WorkMate one-click diagnostic script (PowerShell)
#  Called by WorkMate-diagnose.bat; not meant to be run directly
# ============================================================

$ErrorActionPreference = 'Continue'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$out = Join-Path (Get-Location) ("WorkMate-diagnosis-$stamp.txt")

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add('WorkMate One-Click Diagnostic Report')
$lines.Add('Generated at: ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))
$lines.Add('Computer: ' + $env:COMPUTERNAME)
$lines.Add('Current user: ' + $env:USERNAME + ' (domain: ' + $env:USERDOMAIN + ')')
$lines.Add('')

# === 1. OS ===
$lines.Add('========================================')
$lines.Add(' 1. Operating System')
$lines.Add('========================================')
try {
    $os = Get-CimInstance Win32_OperatingSystem
    $lines.Add('  Name: ' + $os.Caption)
    $lines.Add('  Version: ' + $os.Version)
    $lines.Add('  Build: ' + $os.BuildNumber)
    $lines.Add('  System arch (PROCESSOR_ARCHITECTURE): ' + $env:PROCESSOR_ARCHITECTURE)
    $arch = (Get-CimInstance Win32_Processor).Architecture
    $archMap = @{0='x86'; 1='x64'; 5='ARM'; 6='ARM64'; 9='x64'}
    $lines.Add('  CPU arch: ' + $archMap[[int]$arch])
    $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    $lines.Add('  Is Administrator: ' + $isAdmin)
} catch {
    $lines.Add('  [Read failed] ' + $_.Exception.Message)
}
$lines.Add('')

# === 2. WebView2 Runtime ===
$lines.Add('========================================')
$lines.Add(' 2. WebView2 Runtime (decides if WorkMate can run)')
$lines.Add('========================================')
$wv2Paths = @(
    'HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\ClientState\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}',
    'HKLM:\SOFTWARE\Microsoft\EdgeUpdate\ClientState\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}',
    'HKCU:\Software\Microsoft\EdgeUpdate\ClientState\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'
)
$found = $false
foreach ($p in $wv2Paths) {
    if (Test-Path $p) {
        try {
            $v = (Get-ItemProperty -Path $p -ErrorAction Stop).pv
            $lines.Add('  WebView2 version: ' + $v)
            $found = $true
            break
        } catch { }
    }
}
if (-not $found) {
    $lines.Add('  [WebView2 Runtime NOT detected]  *** This is the #1 cause of WorkMate failing to open')
    $lines.Add('  Fix: download and install "Evergreen Standalone Installer" from https://developer.microsoft.com/en-us/microsoft-edge/webview2/')
}
try {
    $edgeVer = (Get-ItemProperty -Path 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\Microsoft Edge' -ErrorAction Stop).DisplayVersion
    $lines.Add('  Edge browser version (correlated): ' + $edgeVer)
} catch {
    $lines.Add('  Edge browser version: not installed or unreadable')
}
$lines.Add('')

# === 3. VC++ Runtime ===
$lines.Add('========================================')
$lines.Add(' 3. Visual C++ Runtime (vcruntime140.dll / msvcp140.dll)')
$lines.Add('========================================')
$dlls = @('vcruntime140.dll','vcruntime140_1.dll','msvcp140.dll','msvcp140_codecvt_ids.dll','concrt140.dll')
foreach ($d in $dlls) {
    $p = "$env:SystemRoot\System32\$d"
    if (Test-Path $p) {
        $lines.Add('  [OK] ' + $d + ' present')
    } else {
        $lines.Add('  [MISSING] ' + $d + '  *** May prevent WorkMate from starting')
    }
}
$lines.Add('  If anything is missing, install: https://aka.ms/vs/17/release/vc_redist.x64.exe')
$lines.Add('')

# === 4. Antivirus ===
$lines.Add('========================================')
$lines.Add(' 4. Antivirus (may block unsigned WorkMate.exe)')
$lines.Add('========================================')
try {
    $av = Get-CimInstance -Namespace root\SecurityCenter2 -ClassName AntiVirusProduct -ErrorAction Stop
    if ($av) {
        foreach ($p in $av) {
            $lines.Add('  - ' + $p.displayName + '  (state=' + $p.productState + ')')
        }
    } else {
        $lines.Add('  (No AV detected via WMI. May be a domestic AV like 360/Huorong that does not expose WMI.)')
    }
} catch {
    $lines.Add('  (Failed to read AV via WMI; common for domestic Chinese security software.)')
}
$lines.Add('')

# === 5. WorkMate install state ===
$lines.Add('========================================')
$lines.Add(' 5. WorkMate Installation')
$lines.Add('========================================')
$progDir = Join-Path $env:LOCALAPPDATA 'Programs\WorkMate'
if (Test-Path $progDir) {
    $lines.Add('  [OK] Installed at: ' + $progDir)
    $exe = Join-Path $progDir 'workmate.exe'
    if (Test-Path $exe) {
        $lines.Add('  [OK] Main exe present: ' + $exe)
    } else {
        $lines.Add('  [MISSING] Main exe not found: ' + $exe)
    }
} else {
    $lines.Add('  [NOT INSTALLED] Not installed via NSIS/MSI to the standard directory')
    $lines.Add('  (If using the green WorkMate.exe directly, WebView2 will NOT be auto-installed when missing; recommend using the installer once)')
}
$dataDir = Join-Path $env:APPDATA 'com.workmate.app\WorkMate'
$lines.Add('  Data directory: ' + $dataDir)
if (Test-Path $dataDir) {
    try {
        $tmpFile = Join-Path $dataDir '_write_test.tmp'
        New-Item -Path $tmpFile -ItemType File -Force | Out-Null
        Remove-Item $tmpFile -Force
        $lines.Add('  [OK] Data directory is writable')
    } catch {
        $lines.Add('  [FAIL] Data directory not writable: ' + $_.Exception.Message + '  *** App may fail to start')
    }
} else {
    $lines.Add('  (Will be created on first run; does not exist yet.)')
}
$logDir = Join-Path $progDir 'logs'
if (Test-Path $logDir) {
    $logs = Get-ChildItem -Path $logDir -File -ErrorAction SilentlyContinue
    if ($logs) {
        $lines.Add('  [OK] Log directory has ' + $logs.Count + ' file(s):')
        foreach ($l in $logs | Select-Object -First 10) {
            $lines.Add('    - ' + $l.Name + ' (' + $l.Length + ' bytes, modified ' + $l.LastWriteTime + ')')
        }
    } else {
        $lines.Add('  (Log directory is empty - no crash records.)')
    }
} else {
    $lines.Add('  (Log directory does not exist - app likely failed during startup phase.)')
}
$lines.Add('')

# === 6. Event Viewer ===
$lines.Add('========================================')
$lines.Add(' 6. Application Error Events (last 24 hours)')
$lines.Add('========================================')
try {
    $start = (Get-Date).AddHours(-24)
    $errs = Get-WinEvent -FilterHashtable @{LogName='Application'; Level=2; StartTime=$start} -ErrorAction Stop |
        Where-Object { $_.ProviderName -ne 'MsSense' } |
        Select-Object -First 15
    if ($errs) {
        foreach ($e in $errs) {
            $msg = ($e.Message -replace "`r?`n", ' ')
            if ($msg.Length -gt 200) { $msg = $msg.Substring(0, 200) + '...' }
            $lines.Add('  [' + $e.TimeCreated.ToString('MM-dd HH:mm:ss') + '] ' + $e.ProviderName)
            $lines.Add('    Event ID: ' + $e.Id)
            $lines.Add('    Message: ' + $msg)
        }
    } else {
        $lines.Add('  [OK] No "Application Error" events in last 24 hours')
    }
} catch {
    $lines.Add('  (Failed to read event log: ' + $_.Exception.Message + ')')
}
$lines.Add('')

# === 7. Disk space ===
$lines.Add('========================================')
$lines.Add(' 7. Disk Space')
$lines.Add('========================================')
try {
    $sysDrive = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='$($env:SystemDrive)'"
    $freeGB = [math]::Round($sysDrive.FreeSpace / 1GB, 2)
    $lines.Add('  System drive free space: ' + $freeGB + ' GB')
    if ($freeGB -lt 1) {
        $lines.Add('  *** Less than 1GB free - may cause database write failures')
    }
} catch { }
$lines.Add('')

# === Tips ===
$lines.Add('========================================')
$lines.Add(' Troubleshooting Tips')
$lines.Add('========================================')
$lines.Add(' If WebView2 not detected (Section 2): install WebView2 Standalone Installer')
$lines.Add(' If VC++ missing items (Section 3): install vc_redist.x64.exe')
$lines.Add(' If WorkMate-related errors in Section 6: send me the Faulting module name')
$lines.Add(' If using green version (Section 5 shows NOT INSTALLED): run setup.exe once to auto-bootstrap WebView2')
$lines.Add(' If AV blocks it: add WorkMate folder to AV whitelist, or ask for code-signed build')
$lines.Add(' Report done - please send this file to the developer')

# === Write output ===
try {
    [System.IO.File]::WriteAllText($out, ($lines -join "`r`n"), [System.Text.UTF8Encoding]::new($true))
    Write-Host ''
    Write-Host ('  [OK] Report generated: ' + $out) -ForegroundColor Green
    Write-Host ''
    Write-Host '  Please send this txt file to the developer; it contains the full diagnostic info.'
    Write-Host ''
    [void](Start-Process notepad.exe -ArgumentList $out)
} catch {
    Write-Host ('  [FAIL] Report generation failed: ' + $_.Exception.Message) -ForegroundColor Red
}