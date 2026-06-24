/**
 * Copy contract ABIs from backend submodule into src/lib/contracts/abis/
 * Run from frontend/: npm run sync-abis
 */
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const abiSrc = path.resolve(root, '../backend/src/abi');
const abiDest = path.resolve(root, 'src/lib/contracts/abis');
const deploySrc = path.resolve(root, '../deployments/sepolia.json');
const deployDest = path.resolve(root, 'src/lib/contracts/deployments-sepolia.json');

if (!existsSync(abiSrc)) {
  console.error('ABI source not found:', abiSrc);
  process.exit(1);
}

mkdirSync(abiDest, { recursive: true });
for (const file of ['JobRegistry.json', 'EscrowVault.json', 'MockUSDC.json', 'ArbitratorPanel.json', 'ReputationStore.json', 'PlatformTreasury.json']) {
  cpSync(path.join(abiSrc, file), path.join(abiDest, file), { force: true });
}

if (existsSync(deploySrc)) {
  cpSync(deploySrc, deployDest, { force: true });
}

console.log('Synced ABIs and deployments/sepolia.json');
