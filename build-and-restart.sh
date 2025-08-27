#!/bin/bash

echo "🔪 Killing all node processes listening on ports..."
PIDS=$(lsof -i -P -n | grep node | grep LISTEN | awk '{print $2}' | sort -u)

if [ -z "$PIDS" ]; then
  echo "✅ No listening node processes found."
else
  echo "Killing PIDs: $PIDS"
  echo "$PIDS" | xargs kill -9
  echo "✅ Node processes killed."
fi

echo "🔧 Starting build..."
if npm run build; then
  echo "✅ Build succeeded. Starting dev server..."
  npm run dev
else
  echo "❌ Build failed. Dev server not started."
  exit 1
fi
