# Cree deux raccourcis sur le Bureau :
#  - "Suivi Films et Series"          : lance le serveur (si besoin) et ouvre le site
#  - "Arreter Suivi Films et Series"  : arrete le serveur
# Peut etre relance sans risque (les raccourcis sont simplement recrees).
$bureau = [Environment]::GetFolderPath("Desktop")
$shell  = New-Object -ComObject WScript.Shell

function Creer-Raccourci($nom, $script, $icone) {
  $lien = $shell.CreateShortcut((Join-Path $bureau "$nom.lnk"))
  $lien.TargetPath = "wscript.exe"
  $lien.Arguments = "`"$(Join-Path $PSScriptRoot $script)`""
  $lien.WorkingDirectory = Split-Path -Parent $PSScriptRoot
  $lien.IconLocation = $icone
  $lien.Save()
  Write-Host "Raccourci cree : $nom"
}

Creer-Raccourci "Suivi Films et Series" "lancer.vbs" "shell32.dll,115"
Creer-Raccourci "Arreter Suivi Films et Series" "arreter.vbs" "shell32.dll,131"
