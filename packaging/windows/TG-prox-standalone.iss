#define MyAppName "TG-prox"
#define MyAppVersion "__APP_VERSION__"

[Setup]
AppId={{7A4E7F75-9D57-4C14-9854-C00E147E4EA0}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher=TG-prox
DefaultDirName={localappdata}\Programs\TG-prox
DefaultGroupName=TG-prox
PrivilegesRequired=lowest
Compression=lzma
SolidCompression=yes
OutputBaseFilename=TG-prox-windows-installer-__APP_VERSION__
OutputDir=.
WizardStyle=modern
DisableProgramGroupPage=yes
UninstallDisplayIcon={app}\TG-prox.cmd

[Files]
Source: "*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\TG-prox"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\TG-prox-background.vbs"" connect"
Name: "{group}\TG-prox Connect URL"; Filename: "{cmd}"; Parameters: "/c ""{app}\TG-prox-connect-url.cmd"""
Name: "{group}\Uninstall TG-prox"; Filename: "{uninstallexe}"

[Registry]
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "TG-prox"; ValueData: """{sys}\wscript.exe"" ""{app}\TG-prox-background.vbs"" serve"; Flags: uninsdeletevalue

[Run]
Filename: "{sys}\wscript.exe"; Parameters: """{app}\TG-prox-background.vbs"" connect"; Description: "Launch TG-prox"; Flags: postinstall skipifsilent unchecked
