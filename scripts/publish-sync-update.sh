#!/usr/bin/env bash
set -euo pipefail

data_path=$1
message=$2

git add -- "$data_path"
if git diff --cached --quiet -- "$data_path"; then
  printf 'No changes to %s.\n' "$data_path"
  exit 0
fi

git -c user.name='github-actions[bot]' \
    -c user.email='41898282+github-actions[bot]@users.noreply.github.com' \
    commit -m "$message" -- "$data_path"
published_sha=$(git rev-parse HEAD)
git push origin HEAD:refs/heads/main

remote_head=$(git ls-remote --exit-code origin refs/heads/main)
if [[ "$remote_head" != "$published_sha"$'\trefs/heads/main' ]]; then
  printf 'main advanced after %s was pushed. Skipping its Test dispatch.\n' "$published_sha"
  exit 0
fi

gh workflow run test.yml --repo "$GITHUB_REPOSITORY" --ref main -f "expected_sha=$published_sha"
