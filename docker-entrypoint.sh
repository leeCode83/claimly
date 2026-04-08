#!/bin/sh

# Start the ZKP Workers in the background
echo "Starting ZKP Workers..."
npm run workers &

# Start the Next.js application
echo "Starting Next.js App..."
npm run start
