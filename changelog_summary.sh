#/usr/bin/env bash
PREV_MONTH=$(date -d "1 month ago" +%Y-%m)

files=$(git log --since="$PREV_MONTH-01" --until="$PREV_MONTH-31" --name-only -- '**/CHANGELOG.md' | grep CHANGE | sort -u)

echo "Below you can find the latest release for each individual package released during this month:"
echo

for file in $files; do
  name=$(grep '^# ' $file | awk '{ print substr($0, 4) }')
  last_release=$(grep '^## ' $file | awk '{ print substr($0, 4) }' | head -n 1)
  echo "@$name: $last_release [CHANGELOG.md](https://github.com/nhost/nhost/blob/main/$file)"
done
