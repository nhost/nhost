#!/bin/bash

# loop through all folders in the current directory
for folder in */; do
  # remove the pattern yyyy-mm-dd- from the folder name
  new_name=$(echo "$folder" | sed 's/[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]-//')
  # rename the folder
  mv "$folder" "$new_name"
done
