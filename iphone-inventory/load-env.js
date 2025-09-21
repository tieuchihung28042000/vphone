import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from root .env file
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Set VITE_API_URL if not already set
if (!process.env.VITE_API_URL) {
  const backendPort = process.env.BACKEND_PORT || '4000';
  process.env.VITE_API_URL = `http://localhost:${backendPort}`;
}
