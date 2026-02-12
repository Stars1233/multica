#!/bin/bash
# Reset all user data for super-multica desktop app
# Use this to simulate a fresh install for testing

set -e

echo "🧹 Resetting Super Multica user data..."

# Main data directory
MULTICA_DATA_DIR="$HOME/.super-multica"
if [ -d "$MULTICA_DATA_DIR" ]; then
  echo "  Removing $MULTICA_DATA_DIR"
  rm -rf "$MULTICA_DATA_DIR"
else
  echo "  $MULTICA_DATA_DIR does not exist, skipping"
fi

# Electron app data (macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
  ELECTRON_APP_DATA="$HOME/Library/Application Support/super-multica"
  if [ -d "$ELECTRON_APP_DATA" ]; then
    echo "  Removing $ELECTRON_APP_DATA"
    rm -rf "$ELECTRON_APP_DATA"
  else
    echo "  $ELECTRON_APP_DATA does not exist, skipping"
  fi
fi

# Electron app data (Linux)
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
  ELECTRON_APP_DATA="$HOME/.config/super-multica"
  if [ -d "$ELECTRON_APP_DATA" ]; then
    echo "  Removing $ELECTRON_APP_DATA"
    rm -rf "$ELECTRON_APP_DATA"
  else
    echo "  $ELECTRON_APP_DATA does not exist, skipping"
  fi
fi

echo "✅ User data reset complete!"
echo ""
echo "Next steps:"
echo "  pnpm dev              # Start app (will show onboarding)"
echo "  pnpm dev:reset        # Reset and start in one command"
