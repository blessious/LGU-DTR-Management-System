Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

' Get current script directory
strPath = FSO.GetParentFolderName(WScript.ScriptFullName)

' Optional: Show notification
WshShell.Popup "MuniWeb is starting in the background...", 3, "System Startup", 64

' Start Frontend (Hidden)
WshShell.CurrentDirectory = strPath
WshShell.Run "cmd /c npm run dev", 0, False

' Start Backend (Hidden)
WshShell.CurrentDirectory = strPath & "\server"
WshShell.Run "cmd /c npm start", 0, False

Set WshShell = Nothing
Set FSO = Nothing