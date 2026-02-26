Set WshShell = CreateObject("WScript.Shell")
' Run the run.bat file in the same directory, but hidden (0)
WshShell.Run chr(34) & "run.bat" & chr(34), 0
Set WshShell = Nothing
