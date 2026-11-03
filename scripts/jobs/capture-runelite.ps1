# Captures the "RuneLite - <name>" window (if one exists) with PrintWindow to
# D:\claude-temp\demo\runelite-latest.png. Never touches the clipboard, never moves or focuses windows.
Add-Type -ReferencedAssemblies System.Drawing @'
using System; using System.Drawing; using System.Runtime.InteropServices;
public class RlCap {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr hdc, uint flags);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  public static Bitmap Grab(IntPtr h) {
    SetProcessDPIAware(); // real pixel size, else a scaled display crops the right/bottom
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
# Blank (all one colour) = Windows blocked the read: usually RuneLite was started as administrator
# and this task runs as a normal user. Keep the last good picture instead of overwriting it.
$seen = @{}; for ($x = 0; $x -lt $b.Width; $x += 37) { for ($y = 0; $y -lt $b.Height; $y += 37) { $seen[$b.GetPixel($x, $y).ToArgb()] = 1 } }
if ($seen.Count -le 2) { "blank capture of '" + $rl.MainWindowTitle + "' (RuneLite probably runs as administrator); kept previous " + $p; $b.Dispose(); exit 2 }
$b.Save($p, [System.Drawing.Imaging.ImageFormat]::Png)
"captured '" + $rl.MainWindowTitle + "' " + $b.Width + "x" + $b.Height + " -> " + $p
$b.Dispose()
exit 0
