$ErrorActionPreference = 'Stop'
try {
  Add-Type -AssemblyName System.Printing
  Add-Type -AssemblyName ReachFramework
  $server = New-Object System.Printing.LocalPrintServer
  try {
    $queue = @($server.GetPrintQueues()) | Where-Object { $_.FullName -eq $env:CREMAPDF_PRINTER -or $_.Name -eq $env:CREMAPDF_PRINTER } | Select-Object -First 1
    if (-not $queue) { throw 'Imprimante introuvable.' }
    try {
      $capabilities = $queue.GetPrintCapabilities()
      $modes = @($capabilities.DuplexingCapability | ForEach-Object { $_.ToString() })
      [pscustomobject]@{ known = $true; longEdge = ($modes -contains 'TwoSidedLongEdge'); shortEdge = ($modes -contains 'TwoSidedShortEdge') } | ConvertTo-Json -Compress
    } finally { $queue.Dispose() }
  } finally { $server.Dispose() }
} catch { [pscustomobject]@{ known = $false; longEdge = $false; shortEdge = $false } | ConvertTo-Json -Compress }
