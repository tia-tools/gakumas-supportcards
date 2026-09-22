#!/bin/sh
# Unpacks GkmasObjectManager (GPL-3.0, not a package) at the commit pinned in
# GkmasObjectManager.sha into vendor/, which is gitignored. Used by a person once and by the
# weekly workflow on every run; rerunning replaces the checkout. To move to a newer commit,
# change the sha file and rerun.
set -eu
cd "$(dirname "$0")"
SHA=$(tr -d '[:space:]' < GkmasObjectManager.sha)
rm -rf vendor/GkmasObjectManager
mkdir -p vendor/GkmasObjectManager
curl -fsSL "https://codeload.github.com/AllenHeartcore/GkmasObjectManager/tar.gz/$SHA" \
  | tar -xz -C vendor/GkmasObjectManager --strip-components=1
echo "$SHA" > vendor/GkmasObjectManager.sha
echo "GkmasObjectManager $SHA unpacked into vendor/"
