#!/usr/bin/env bash

set -euo pipefail

fetch_and_verify() {
  local url="$1"
  local output="$2"
  local expected_sha256="$3"

  mkdir -p "$(dirname "$output")"

  if [[ -f "$output" ]] && [[ "$(shasum -a 256 "$output" | awk '{print $1}')" == "$expected_sha256" ]]; then
    echo "Audio already present and verified: $output"
    return
  fi

  curl --fail --location --silent --show-error "$url" --output "$output"

  local actual_sha256
  actual_sha256="$(shasum -a 256 "$output" | awk '{print $1}')"
  if [[ "$actual_sha256" != "$expected_sha256" ]]; then
    rm -f "$output"
    echo "Downloaded audio checksum did not match the reviewed source: $output" >&2
    exit 1
  fi

  echo "Downloaded and verified: $output"
}

fetch_and_verify \
  "https://assets.mixkit.co/music/175/175.mp3" \
  "public/v2/audio/digital-clouds.mp3" \
  "71cd4ea39edcc7532672bd97311abadfd318d00e7a828310a88b4f57fad9cd48"

fetch_and_verify \
  "https://remotion.media/whoosh.wav" \
  "public/v2/audio/whoosh.wav" \
  "d98f010fa5f03fd3f4f77418f8ba6a962d36e63357265772771c4ac69c1a63a7"

fetch_and_verify \
  "https://remotion.media/mouse-click.wav" \
  "public/v2/audio/mouse-click.wav" \
  "887a9259203cafa24ad90274029d574ba29438bcdc87e6f384e4472f85736348"

fetch_and_verify \
  "https://remotion.media/switch.wav" \
  "public/v2/audio/switch.wav" \
  "0d07c6daac595425c820d92966bbc35cbd6590f4bde8a59199743b9bf45da77e"

fetch_and_verify \
  "https://remotion.media/ding.wav" \
  "public/v2/audio/ding.wav" \
  "97c823dc8ef1fb6dab5599f5b8b8aee5ec2dfa4c9d987151e64d6c5a5f87adbe"
