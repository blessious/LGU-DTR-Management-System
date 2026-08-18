' Silent launcher for backup_db.bat
' Point Task Scheduler to this .vbs file instead of the .bat
' Place this in the same folder as backup_db.bat
Dim shell
Set shell = CreateObject("WScript.Shell")
Dim scriptDir
scriptDir = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
shell.Run "cmd /c """ & scriptDir & "backup_db.bat""", 0, False
Set shell = Nothing
