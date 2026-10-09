' Arrete PocketBase (le site ne repond plus ensuite).
Option Explicit
Dim shell, retour
Set shell = CreateObject("WScript.Shell")
' Ferme le processus pocketbase.exe sans afficher de fenetre
retour = shell.Run("taskkill /IM pocketbase.exe /F", 0, True)
If retour = 0 Then
  MsgBox "Le serveur Suivi Films & Series est arrete.", 64, "Suivi Films & Series"
Else
  MsgBox "Le serveur n'etait pas en marche.", 64, "Suivi Films & Series"
End If
