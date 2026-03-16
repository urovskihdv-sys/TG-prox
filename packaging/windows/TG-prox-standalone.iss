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
Name: "{group}\TG-prox"; Filename: "{cmd}"; Parameters: "/c ""{app}\TG-prox.cmd"""
Name: "{group}\TG-prox Connect URL"; Filename: "{cmd}"; Parameters: "/c ""{app}\TG-prox-connect-url.cmd"""
Name: "{group}\Uninstall TG-prox"; Filename: "{uninstallexe}"

[Run]
Filename: "{cmd}"; Parameters: "/c ""{app}\TG-prox.cmd"""; Description: "Launch TG-prox"; Flags: postinstall skipifsilent unchecked
