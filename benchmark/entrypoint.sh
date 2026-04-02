#!/bin/bash
set -e

echo "=== SWE-bench Evaluation Environment ==="
echo "Run Mode: ${RUN_MODE:-vanilla}"
echo "Gemini Code version: $(gemini --version 2>/dev/null || echo 'not installed')"

# Configure Gemini Code if auth token is provided
if [ -n "$ANTHROPIC_AUTH_TOKEN" ]; then
    echo "Anthropic auth token configured"
    export ANTHROPIC_AUTH_TOKEN="$ANTHROPIC_AUTH_TOKEN"
else
    echo "WARNING: ANTHROPIC_AUTH_TOKEN not set"
fi

# Configure custom base URL if provided
if [ -n "$ANTHROPIC_BASE_URL" ]; then
    echo "Using custom Anthropic base URL: $ANTHROPIC_BASE_URL"
    export ANTHROPIC_BASE_URL="$ANTHROPIC_BASE_URL"
fi

# Install OMG if in omg mode
if [ "$RUN_MODE" = "omg" ]; then
    echo "Installing oh-my-gemini for enhanced mode..."

    # Check if OMG source is mounted
    if [ -d "/workspace/omg-source" ]; then
        echo "Installing OMG from mounted source..."
        cd /workspace/omg-source && npm install && npm link
    else
        echo "Installing OMG from npm..."
        npm install -g oh-my-gemini
    fi

    # Initialize OMG configuration
    mkdir -p ~/.gemini

    echo "OMG installation complete"
fi

# Execute the command passed to the container
exec "$@"
