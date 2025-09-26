#!/usr/bin/env node

/**
 * Simple startup script for DHA Digital Services Platform
 * This script ensures the application starts correctly in the Replit environment
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 DHA Digital Services Platform - Starting...');
console.log('👑 Queen Raeesa Ultra AI Platform');
console.log('🇿🇦 Department of Home Affairs - Digital Services');
console.log('=' .repeat(50));

// Check if built files exist
const distPath = path.join(__dirname, 'dist', 'server', 'index.js');
const builtExists = fs.existsSync(distPath);

console.log('📋 System Check:');
console.log(`   Built files exist: ${builtExists ? '✅' : '❌'}`);

if (builtExists) {
  console.log('🏃 Starting production server...');
  
  // Start the production server
  const child = spawn('npm', ['start'], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, NODE_ENV: 'production' }
  });

  child.on('error', (error) => {
    console.error('❌ Failed to start production server:', error);
    console.log('🔄 Falling back to development mode...');
    startDevelopment();
  });

  child.on('exit', (code) => {
    if (code !== 0) {
      console.log('🔄 Production server exited, trying development mode...');
      startDevelopment();
    }
  });

} else {
  console.log('🔧 No built files found, starting in development mode...');
  startDevelopment();
}

function startDevelopment() {
  console.log('🛠️  Starting development server...');
  
  const child = spawn('npx', ['tsx', 'server/index.ts'], {
    stdio: 'inherit',
    shell: false,
    env: { ...process.env, NODE_ENV: 'development' }
  });

  child.on('error', (error) => {
    console.error('❌ Failed to start development server:', error);
    console.log('💡 Try running: npm install && npm run build && npm start');
    process.exit(1);
  });
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down DHA Digital Services Platform...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down DHA Digital Services Platform...');
  process.exit(0);
});