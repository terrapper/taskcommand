#!/bin/bash
# Task Dashboard — Start Script
# Launches the Express server on port 3847

cd "$(dirname "$0")"

# Kill any existing instance
lsof -ti:3847 | xargs kill -9 2>/dev/null

echo ""
echo "  TaskCommand — Starting dashboard..."
echo ""

node server.js
