# Exporta para PDF as abas impressas da cópia preenchida (caso c01) para servir de referência de layout.
# Uso: powershell -ExecutionPolicy Bypass -File exportar_impressos.ps1
$ErrorActionPreference = 'Stop'
$aqui = Split-Path -Parent $MyInvocation.MyCommand.Path
$origem = Join-Path $aqui 'saida\c01_simples.xlsm'
$destino = Join-Path $aqui 'saida\impressos'
New-Item -ItemType Directory -Force $destino | Out-Null

$xl = New-Object -ComObject Excel.Application
$xl.Visible = $false
$xl.DisplayAlerts = $false
$xl.AutomationSecurity = 3
try {
    $wb = $xl.Workbooks.Open($origem, 0, $true)
    # nomes sem acento no script (PowerShell 5.1 lê como ANSI): casamos pelo padrão
    $alvos = @('Solicita*o 20', 'Solicita*o 20 Verso', '20-Recebido', '20-Devido', 'CPEX', 'Solicita*o Recapitula*o', 'Resumo', 'Informa*es')
    foreach ($padrao in $alvos) {
        $ws = $wb.Worksheets | Where-Object { $_.Name -like $padrao } | Select-Object -First 1
        if (-not $ws) { "nao achei: $padrao"; continue }
        $arq = Join-Path $destino (($ws.Name -replace '[^\w\- ]', '_') + '.pdf')
        $ws.ExportAsFixedFormat(0, $arq)   # 0 = xlTypePDF, usa a área de impressão da aba
        "ok: $($ws.Name)"
    }
    $wb.Close($false)
}
finally {
    $xl.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($xl) | Out-Null
}
