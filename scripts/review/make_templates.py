"""Rebuild the review templates from TexasPete's 6:50 (6WEIHo7AUf0) at 640x360.

    python make_templates.py <6WEIHo7AUf0.mp4> <out_dir> [--ffmpeg PATH]

banner.png  = "EXTRACTION POINT UNLOCKED" banner text only (the plate and ornament fade in ~0.8 s before the text) at 89.2 s,
              crop x 272-366, y 4-14 of the 640x360 frame (inside the top 640x24 band).
getout.png  = "GET OUT NOW!" plate text at video 412.0 s, crop x 262-374, y 103-121.
"""
import os
import subprocess
import sys

import cv2
import numpy as np

W, H = 640, 360


def frame(ffmpeg, video, t):
    cmd = [ffmpeg, "-v", "error", "-nostdin", "-ss", f"{t:.3f}", "-i", video, "-frames:v", "1",
           "-vf", f"scale={W}:{H},format=gray", "-f", "rawvideo", "-pix_fmt", "gray", "-"]
    buf = subprocess.run(cmd, capture_output=True, check=True).stdout
    return np.frombuffer(buf[: W * H], np.uint8).reshape(H, W)


def main():
    video, out = sys.argv[1], sys.argv[2]
    ffmpeg = sys.argv[sys.argv.index("--ffmpeg") + 1] if "--ffmpeg" in sys.argv else os.environ.get("FFMPEG", "ffmpeg")
    os.makedirs(out, exist_ok=True)
    cv2.imwrite(os.path.join(out, "banner.png"), frame(ffmpeg, video, 89.2)[4:14, 272:366])
    cv2.imwrite(os.path.join(out, "getout.png"), frame(ffmpeg, video, 412.0)[103:121, 262:374])
    print("ok")


if __name__ == "__main__":
    main()
