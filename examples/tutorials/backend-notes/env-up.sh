#!/bin/sh

# if .secrets file doesn't exist, cp .secrets.example .secrets
if [ ! -f .secrets ]; then
  cp .secrets.example .secrets
fi

nhost up
