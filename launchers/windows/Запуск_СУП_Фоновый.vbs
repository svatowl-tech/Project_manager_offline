' Фоновый запуск СУП без отображения консольного окна
Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")
ScriptDir = FSO.GetParentFolderName(WScript.ScriptFullName)

BatPath = ScriptDir & "\Запуск_СУП.bat"
If FSO.FileExists(BatPath) Then
    WshShell.Run """" & BatPath & """", 0, False
Else
    WshShell.Run "cmd /c start """" """ & ScriptDir & "\index.html""", 0, False
End If
