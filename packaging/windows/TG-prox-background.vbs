Option Explicit

Dim shell
Dim fso
Dim scriptDir
Dim nodeExe
Dim cliJs
Dim mode
Dim command

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
nodeExe = scriptDir & "\runtime\node\node.exe"
cliJs = scriptDir & "\app\cli.js"
mode = "serve"

If WScript.Arguments.Count > 0 Then
  mode = WScript.Arguments(0)
End If

command = Quote(nodeExe) & " " & Quote(cliJs) & " " & mode
shell.Run command, 0, False

Function Quote(value)
  Quote = Chr(34) & value & Chr(34)
End Function
