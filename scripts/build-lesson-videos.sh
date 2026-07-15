#!/usr/bin/env bash
#
# build-lesson-videos.sh
#
# Stitches Canva-exported slide images + a voiceover recording into a
# branded 1920x1080 H.264 MP4 for each Medicare course lesson.
#
# ------------------------------------------------------------------
# PREREQUISITES (not installed automatically by this script)
# ------------------------------------------------------------------
#   brew install ffmpeg
#
# ------------------------------------------------------------------
# EXPECTED INPUT LAYOUT
# ------------------------------------------------------------------
#   src/content/voiceovers/lesson1.m4a ... lesson6.m4a
#   src/content/lesson-slides/lesson1/slide-01.png, slide-02.png, ...
#   src/content/lesson-slides/lesson2/slide-01.png, ...
#   ... through lesson6
#
#   Slides must be exported from the Canva deck for each lesson as PNG
#   (or JPG) files, named so they sort in presentation order
#   (slide-01.png, slide-02.png, ... slide-NN.png). This script does NOT
#   talk to Canva — export manually from the Canva UI ("Download > PNG,
#   all pages") or via the Canva MCP tools (export-design /
#   get-design-pages) in a session that has deck access, then drop the
#   files into the folder above.
#
# ------------------------------------------------------------------
# WHAT IT DOES
# ------------------------------------------------------------------
#   For each lesson N (1-6):
#     1. Reads the voiceover duration with ffprobe.
#     2. Splits that duration evenly across the slide count for lesson N
#        (simple even split - no per-slide timing detection).
#     3. Builds a slideshow video track from the PNGs at 1920x1080,
#        scaled/padded to fit without distortion.
#     4. Overlays a PSG logo watermark (public/brand/psg-logo.png) in the
#        bottom-right corner throughout.
#     5. Appends a 5-second branded "Where You Matter" end card
#        (Dark #1a0a2e background, Purple/Teal accents) after the last
#        slide.
#     6. Muxes the voiceover audio under the slideshow portion (the end
#        card plays silent).
#     7. Outputs public/videos/lessonN.mp4 (H.264 / AAC, yuv420p, for
#        broad browser <video> compatibility).
#
# ------------------------------------------------------------------
# USAGE
# ------------------------------------------------------------------
#   ./scripts/build-lesson-videos.sh          # build all lessons found
#   ./scripts/build-lesson-videos.sh 3        # build only lesson 3
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VOICEOVER_DIR="$ROOT_DIR/src/content/voiceovers"
SLIDES_DIR="$ROOT_DIR/src/content/lesson-slides"
OUT_DIR="$ROOT_DIR/public/videos"
LOGO="$ROOT_DIR/public/brand/psg-logo.png"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

# Brand colors
DARK="#1a0a2e"
PURPLE="#9059B5"
TEAL="#51decc"

END_CARD_SECONDS=5
WIDTH=1920
HEIGHT=1080

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ERROR: ffmpeg is not installed. Run: brew install ffmpeg" >&2
  exit 1
fi
if ! command -v ffprobe >/dev/null 2>&1; then
  echo "ERROR: ffprobe is not installed (ships with ffmpeg). Run: brew install ffmpeg" >&2
  exit 1
fi
if [ ! -f "$LOGO" ]; then
  echo "ERROR: logo not found at $LOGO" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

LESSONS="${1:-1 2 3 4 5 6}"

for N in $LESSONS; do
  VO="$VOICEOVER_DIR/lesson${N}.m4a"
  SLIDE_DIR="$SLIDES_DIR/lesson${N}"
  OUT="$OUT_DIR/lesson${N}.mp4"

  if [ ! -f "$VO" ]; then
    echo "Skipping lesson $N: voiceover not found at $VO"
    continue
  fi
  if [ ! -d "$SLIDE_DIR" ] || [ -z "$(ls -A "$SLIDE_DIR" 2>/dev/null)" ]; then
    echo "Skipping lesson $N: no slides found in $SLIDE_DIR"
    continue
  fi

  echo "== Building lesson $N =="

  # Ordered slide list (avoid `mapfile`/`readarray` - not available in bash 3.2,
  # which is still the default /bin/bash on macOS)
  SLIDES=()
  while IFS= read -r -d '' f; do
    SLIDES+=("$f")
  done < <(find "$SLIDE_DIR" -maxdepth 1 -type f \( -iname "*.png" -o -iname "*.jpg" -o -iname "*.jpeg" \) -print0 | sort -z)
  SLIDE_COUNT="${#SLIDES[@]}"
  if [ "$SLIDE_COUNT" -eq 0 ]; then
    echo "Skipping lesson $N: no image files in $SLIDE_DIR"
    continue
  fi

  DURATION=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$VO")
  PER_SLIDE=$(awk -v d="$DURATION" -v c="$SLIDE_COUNT" 'BEGIN { printf "%.3f", d / c }')

  # Build a concat file for the slideshow portion
  CONCAT_FILE="$WORK_DIR/concat_${N}.txt"
  : > "$CONCAT_FILE"
  for SLIDE in "${SLIDES[@]}"; do
    printf "file '%s'\nduration %s\n" "$SLIDE" "$PER_SLIDE" >> "$CONCAT_FILE"
  done
  # ffmpeg concat demuxer requires the last file repeated without a duration
  # (avoid negative array indices - not supported in bash 3.2)
  LAST_SLIDE="${SLIDES[$((SLIDE_COUNT - 1))]}"
  printf "file '%s'\n" "$LAST_SLIDE" >> "$CONCAT_FILE"

  SLIDESHOW="$WORK_DIR/slideshow_${N}.mp4"
  ffmpeg -y -f concat -safe 0 -i "$CONCAT_FILE" \
    -i "$LOGO" \
    -filter_complex "[0:v]scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=decrease,pad=${WIDTH}:${HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=${DARK},format=yuv420p[bg];[1:v]scale=180:-1[wm];[bg][wm]overlay=W-w-40:H-h-40:format=auto" \
    -r 30 -c:v libx264 -pix_fmt yuv420p "$SLIDESHOW"

  # End card: solid dark background + "Where You Matter" tagline text + logo
  END_CARD="$WORK_DIR/endcard_${N}.mp4"
  ffmpeg -y -f lavfi -i "color=c=${DARK}:s=${WIDTH}x${HEIGHT}:d=${END_CARD_SECONDS}:r=30" \
    -i "$LOGO" \
    -filter_complex "[1:v]scale=260:-1[wm];[0:v][wm]overlay=(W-w)/2:H*0.34:format=auto[bglogo];[bglogo]drawtext=text='Where You Matter':fontcolor=${TEAL}:fontsize=64:font='Helvetica-Bold':x=(w-text_w)/2:y=H*0.58,drawtext=text='Price Services Group':fontcolor=white:fontsize=32:x=(w-text_w)/2:y=H*0.7[out]" \
    -map "[out]" -c:v libx264 -pix_fmt yuv420p -t "$END_CARD_SECONDS" "$END_CARD"

  # Concat slideshow (with voiceover) + silent end card
  SLIDESHOW_AUDIO="$WORK_DIR/slideshow_audio_${N}.mp4"
  ffmpeg -y -i "$SLIDESHOW" -i "$VO" -map 0:v -map 1:a -c:v copy -c:a aac -shortest "$SLIDESHOW_AUDIO"

  END_CARD_AUDIO="$WORK_DIR/endcard_audio_${N}.mp4"
  ffmpeg -y -i "$END_CARD" -f lavfi -i "anullsrc=channel_layout=stereo:sample_rate=44100" \
    -c:v copy -c:a aac -t "$END_CARD_SECONDS" -shortest "$END_CARD_AUDIO"

  FINAL_CONCAT="$WORK_DIR/final_concat_${N}.txt"
  printf "file '%s'\nfile '%s'\n" "$SLIDESHOW_AUDIO" "$END_CARD_AUDIO" > "$FINAL_CONCAT"

  ffmpeg -y -f concat -safe 0 -i "$FINAL_CONCAT" -c copy "$OUT"

  echo "Wrote $OUT"
done

echo "Done."
