Set WshShell = CreateObject("WScript.Shell")
strPath = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptPosition)

' Optional: Show a quick notification
WshShell.Popup "MuniWeb is starting in the background...", 3, "System Startup", 64

' Start Frontend (Hidden)
WshShell.CurrentDirectory = strPath
WshShell.Run "cmd /c npm run dev", 0, False

' Start Backend (Hidden)
WshShell.CurrentDirectory = strPath & "\server"
WshShell.Run "cmd /c npm start", 0, False

Set WshShell = Nothing
