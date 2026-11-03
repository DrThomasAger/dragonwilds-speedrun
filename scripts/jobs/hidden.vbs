' Runs a node job script with no visible window and waits for it; returns its exit code.
'   wscript.exe hidden.vbs <script.mjs> [args...]
Set sh = CreateObject("WScript.Shell")
cmd = "node"
For i = 0 To WScript.Arguments.Count - 1
  cmd = cmd & " """ & WScript.Arguments(i) & """"
Next
sh.CurrentDirectory = "D:\labyrinth\Github\JaGeX\dragonwilds-speedrun"
WScript.Quit sh.Run(cmd, 0, True)
