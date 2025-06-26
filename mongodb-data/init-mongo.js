// MongoDB initialization script for VPhone system
// This script creates two separate databases: test and vphone

// Switch to admin database for authentication
db = db.getSiblingDB('admin');

// Create databases and users
print('Creating test database...');
db = db.getSiblingDB('test');
db.createCollection('users');

print('Creating vphone database...');
db = db.getSiblingDB('vphone');
db.createCollection('users');

print('MongoDB initialization completed successfully!'); 