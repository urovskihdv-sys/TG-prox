Option Explicit

Dim shell
Dim fso
Dim scriptDir
Dim nodeExe
Dim cliJs
Dim mode
Dim command
Dim env
Dim remoteConfigUrl

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
Set env = shell.Environment("PROCESS")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
nodeExe = scriptDir & "\runtime\node\node.exe"
cliJs = scriptDir & "\app\cli.js"
mode = "serve"
remoteConfigUrl = "https://relay.unitops.pro:8443/config.json"

If WScript.Arguments.Count > 0 Then
  mode = WScript.Arguments(0)
End If

If env.Item("TGPROX_REMOTE_CONFIG_URL") = "" Then
  env.Item("TGPROX_REMOTE_CONFIG_URL") = remoteConfigUrl
End If

command = Quote(nodeExe) & " " & Quote(cliJs) & " " & mode
shell.Run command, 0, False

Function Quote(value)
  Quote = Chr(34) & value & Chr(34)
End Function
