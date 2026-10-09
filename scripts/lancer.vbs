' Lance PocketBase en arriere-plan (sans fenetre, uniquement sur 127.0.0.1)
' puis ouvre le site dans le navigateur.
' Si PocketBase tourne deja, ouvre simplement le site.
Option Explicit
Dim shell, fso, dossier, adresse
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
adresse = "http://127.0.0.1:8090"
' Dossier du projet = dossier parent de "scripts"
dossier = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))

' Le serveur repond-il deja ?
Function ServeurRepond()
  On Error Resume Next
  Dim http
  Set http = CreateObject("MSXML2.ServerXMLHTTP")
  http.setTimeouts 500, 500, 500, 500
  http.open "GET", adresse & "/api/health", False
  http.send
  ServeurRepond = (Err.Number = 0 And http.status = 200)
  Err.Clear
End Function

If Not ServeurRepond() Then
  shell.CurrentDirectory = dossier
  ' 0 = fenetre cachee, False = ne pas attendre la fin du programme
  shell.Run """" & dossier & "\pocketbase.exe"" serve --http=127.0.0.1:8090", 0, False
  ' Attend jusqu'a 20 secondes que le serveur soit pret
  Dim i
  For i = 1 To 40
    If ServeurRepond() Then Exit For
    WScript.Sleep 500
  Next
End If

shell.Run adresse
