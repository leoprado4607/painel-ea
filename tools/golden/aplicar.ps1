# Aplica cada caso de teste numa cópia da planilha original, recalcula no Excel e salva em saida/.
# Também roda as validações de Prec-CP e CPF e grava saida/validacoes.json.
# Uso: powershell -ExecutionPolicy Bypass -File aplicar.ps1
$ErrorActionPreference = 'Stop'
$aqui = Split-Path -Parent $MyInvocation.MyCommand.Path
$original = Join-Path $aqui 'planilha-original.xlsm'
$casos = Join-Path $aqui 'casos'
$saida = Join-Path $aqui 'saida'
New-Item -ItemType Directory -Force $saida | Out-Null

$xl = New-Object -ComObject Excel.Application
$xl.Visible = $false
$xl.DisplayAlerts = $false
$xl.AutomationSecurity = 3   # msoAutomationSecurityForceDisable: nenhuma macro roda

function Escrever($ws, $celula, $valores) {
    $n = $valores.Count
    $rng = $ws.Range($celula).Resize(1, $n)
    $arr = New-Object 'object[,]' 1, $n
    for ($i = 0; $i -lt $n; $i++) { $arr[0, $i] = $valores[$i] }
    try { $rng.Value2 = $arr }
    catch { $ws.Unprotect(); $rng.Value2 = $arr }
    for ($i = 0; $i -lt $n; $i++) {
        $v = $valores[$i]
        if ($v -is [string] -and $v.StartsWith('=')) { $rng.Cells.Item(1, $i + 1).Formula = $v }
    }
}

try {
    Get-ChildItem $casos -Filter '*.escritas.json' | Where-Object { -not $env:SO_VALIDACOES } | ForEach-Object {
        $caso = Get-Content $_.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
        $destino = Join-Path $saida ($caso.nome + '.xlsm')
        Copy-Item $original $destino -Force
        $wb = $xl.Workbooks.Open($destino)
        $xl.Calculation = -4135   # manual durante as escritas
        foreach ($e in $caso.escritas) {
            Escrever $wb.Worksheets.Item($e.aba) $e.celula @($e.valores)
        }
        $xl.CalculateFull()
        $wb.Save()
        $wb.Close($false)
        "ok: $($caso.nome)"
    }

    # Validações: escreve cada número em Informações e lê o OK/Erro calculado pelo Excel.
    $val = Get-Content (Join-Path $casos 'validacoes.entrada.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $wb = $xl.Workbooks.Open($original, 0, $true)
    $xl.Calculation = -4105
    # (nome com acento não vai literal: o PowerShell 5.1 lê o script como ANSI)
    $ws = $wb.Worksheets | Where-Object { $_.Name -like 'Informa*es' } | Select-Object -First 1
    $res = @{ precCp = @(); cpf = @() }
    foreach ($p in $val.precCp) {
        Escrever $ws 'B22' @([double]$p); $xl.Calculate()
        $res.precCp += @{ valor = $p; resultado = [string]$ws.Range('L21').Text; esperado = [string]$ws.Range('AI21').Value2 }
    }
    foreach ($c in $val.cpf) {
        Escrever $ws 'B24' @([string]$c); $xl.Calculate()
        $res.cpf += @{ valor = $c; resultado = [string]$ws.Range('L23').Text }
    }
    $wb.Close($false)
    $res | ConvertTo-Json -Depth 5 | Out-File (Join-Path $saida 'validacoes.json') -Encoding utf8
    "ok: validacoes"
}
finally {
    $xl.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($xl) | Out-Null
}
