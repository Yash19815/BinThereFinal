/**
 * @fileoverview Project Setup Script (setup.js)
 * 
 * Automates the initial project configuration:
 * 1. Installs dependencies in all workspaces (root, server, client)
 * 2. Creates .env files from templates
 * 3. Generates a secure JWT_SECRET for the backend
 * 4. Verifies database state
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

const rootPath = path.resolve(__dirname, '..');

function log(msg) {
  console.log(`\x1b[36m[setup]\x1b[0m ${msg}`);
}

function error(msg) {
  console.error(`\x1b[31m[error]\x1b[0m ${msg}`);
}

function run(cmd, cwd = rootPath) {
  log(`Running: ${cmd} in ${path.relative(rootPath, cwd) || '.'}`);
  try {
    execSync(cmd, { cwd, stdio: 'inherit' });
  } catch (err) {
    error(`Command failed: ${cmd}`);
    process.exit(1);
  }
}

async function setup() {
  console.log(`
  \x1b[32m╔═══════════════════════════════════════╗
  ║    BinThere Project Configuration     ║
  ╚═══════════════════════════════════════╝\x1b[0m
  `);

  // 1. Install dependencies
  log('Installing root dependencies...');
  run('npm install');

  log('Installing server dependencies...');
  run('npm install', path.join(rootPath, 'server'));

  log('Installing client dependencies...');
  run('npm install', path.join(rootPath, 'client'));

  // 2. Setup Environment Variables
  const envConfigs = [
    {
      dir: 'server',
      example: '.env.example',
      target: '.env',
      onInit: (content) => {
        const secret = crypto.randomBytes(48).toString('hex');
        log('Generating secure JWT_SECRET...');
        // If JWT_SECRET exists but is empty or default, replace it
        if (content.includes('JWT_SECRET=')) {
          return content.replace(/JWT_SECRET=.*/, `JWT_SECRET=${secret}`);
        } else {
          return content + `\nJWT_SECRET=${secret}\n`;
        }
      }
    },
    {
      dir: 'client',
      example: '.env.example',
      target: '.env'
    }
  ];

  for (const conf of envConfigs) {
    const dirPath = path.join(rootPath, conf.dir);
    const targetPath = path.join(dirPath, conf.target);
    const examplePath = path.join(dirPath, conf.example);

    if (!fs.existsSync(targetPath)) {
      if (fs.existsSync(examplePath)) {
        log(`Creating ${conf.dir}/${conf.target} from template...`);
        let content = fs.readFileSync(examplePath, 'utf8');
        if (conf.onInit) {
          content = conf.onInit(content);
        }
        fs.writeFileSync(targetPath, content);
      } else {
        error(`Template missing: ${conf.dir}/${conf.example}`);
      }
    } else {
      log(`${conf.dir}/${conf.target} already exists. Skipping.`);
    }
  }

  // 3. Database Check
  const dbPath = path.join(rootPath, 'server', 'bins.db');
  if (!fs.existsSync(dbPath)) {
    log('Database "bins.db" missing. It will be automatically initialized on first server start.');
  } else {
    log('Database "bins.db" detected.');
  }

  console.log(`
  \x1b[32m✨ Setup Complete!\x1b[0m
  
  You can now start the project by running:
  \x1b[33m  npm run dev\x1b[0m
  
  Default Credentials:
  - Username: \x1b[1madmin\x1b[0m
  - Password: \x1b[1madmin123\x1b[0m
  
  \x1b[36mNote:\x1b[0m Dustbins are now managed dynamically from the dashboard.
  Once logged in, use the "➕ Add Dustbin" button to register your units.
  `);
}

setup().catch(err => {
  error(err.message);
  process.exit(1);
});
