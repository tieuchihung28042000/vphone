#!/bin/bash

# Script to restore test database
echo "Starting restore process for test database..."

# Wait for MongoDB to be ready
sleep 30

# Restore database
mongorestore /docker-entrypoint-initdb.d/backup/test --db test --host localhost:27017

echo "Test database restore completed!" 