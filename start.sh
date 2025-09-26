#!/bin/bash

# DHA Digital Services Platform - Railway Production Start Script
echo "🚀 Starting DHA Digital Services Platform on Railway..."
echo "🇿🇦 Department of Home Affairs Digital Platform"
echo "======================================="

# Set environment variables for production
export PORT=${PORT:-3000}
export HOST=0.0.0.0

# Ensure we're in the right directory
cd "$(dirname "$0")"

echo "📋 Environment Check:"
echo "   PORT: $PORT"
echo "   HOST: $HOST"
echo "   Node version: $(node --version)"

# Check if built files exist
if [ -f "dist/server/index.js" ]; then
    echo "✅ Built files found at dist/server/index.js"
    echo "🏃 Starting production server..."
    
    # Set NODE_ENV=production only when starting the server
    export NODE_ENV=production
    echo "   NODE_ENV: $NODE_ENV"
    
    # Start the production server
    exec node dist/server/index.js
else
    echo "❌ Critical Error: Built files not found at dist/server/index.js"
    echo "📂 Expected file structure:"
    echo "   - dist/server/index.js (main server file)"
    echo ""
    echo "🔍 Current dist structure:"
    if [ -d "dist" ]; then
        find dist -type f -name "*.js" | head -10
    else
        echo "   No dist directory found"
    fi
    echo ""
    echo "💡 This indicates a build failure during Railway deployment."
    echo "   The build phase should have created dist/server/index.js"
    echo "   Check Railway build logs for TypeScript compilation errors."
    echo ""
    echo "🚫 Failing fast - no fallback to development mode in production"
    exit 1
fi