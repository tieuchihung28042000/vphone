#!/bin/bash

# Script to restore vphone database
echo "Starting restore process for vphone database..."

# Wait for MongoDB to be ready
sleep 30

# Restore database
mongorestore /docker-entrypoint-initdb.d/backup/vphone --db vphone --host localhost:27017

echo "VPhone database restore completed!" 