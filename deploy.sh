#!/bin/bash
cd "$(dirname "$0")"
git add .
git commit -m "${1:-update}"
git push
echo "✓ Deployed: ${1:-update}"
