$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
py -3 backend/app.py
