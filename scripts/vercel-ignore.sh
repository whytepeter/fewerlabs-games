#!/usr/bin/env bash
# Vercel "Ignored Build Step" for the project folder this runs in.
# Vercel runs it from the project's Root Directory (store/, deep-dive/, ripple/ or skip/).
# Exit 0 skips the build; exit 1 builds.

# Compare against the last deployed commit, so a push of several commits is judged as a whole.
base="$VERCEL_GIT_PREVIOUS_SHA"

if [ -n "$base" ]; then
  # Vercel clones only the last 10 commits; if the last deploy is older than that, just build.
  if ! git cat-file -e "$base^{commit}" 2>/dev/null; then
    echo "Last deployed commit $base is not in the clone. Building."
    exit 1
  fi
elif git rev-parse --quiet --verify "HEAD^" >/dev/null; then
  base="HEAD^"
else
  echo "No earlier commit to compare against. Building."
  exit 1
fi

if git diff --quiet "$base" HEAD -- .; then
  echo "No changes in $(basename "$PWD")/ since $base. Skipping the build."
  exit 0
fi

echo "Changes in $(basename "$PWD")/ since $base. Building."
exit 1
