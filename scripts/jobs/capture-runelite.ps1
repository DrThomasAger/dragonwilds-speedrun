# Captures the "RuneLite - <name>" window (if one exists) with PrintWindow to
# D:\claude-temp\demo\runelite-latest.png. Never touches the clipboard, never moves or focuses windows.
Add-Type -ReferencedAssemblies System.Drawing @'
using System; using System.Drawing; using System.Runtime.InteropServices;
public class RlCap {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr hdc, uint flags);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  public static Bitmap Grab(IntPtr h) {
    RECT r; GetWindowRect(h, out r);
    var b = new Bitmap(Math.Max(1, r.R - r.L), Math.Max(1, r.B - r.T));
    using (var g = Graphics.FromImage(b)) { var dc = g.GetHdc(); PrintWindow(h, dc, 2); g.ReleaseHdc(dc); }
    return b;
  }
}
'@
$rl = Get-Process | Where-Object { $_.MainWindowTitle -like 'RuneLite - *' } | Select-Object -First 1
if (-not $rl) { 'no RuneLite window'; exit 0 }
if ([RlCap]::IsIconic($rl.MainWindowHandle)) { 'RuneLite window is minimised, skipped: ' + $rl.MainWindowTitle; exit 0 }
New-Item -ItemType Directory -Force 'D:\claude-temp\demo' | Out-Null
$p = 'D:\claude-temp\demo\runelite-latest.png'
$b = [RlCap]::Grab($rl.MainWindowHandle)
$b.Save($p, [System.Drawing.Imaging.ImageFormat]::Png)
"captured '" + $rl.MainWindowTitle + "' " + $b.Width + "x" + $b.Height + " -> " + $p
$b.Dispose()
exit 0
