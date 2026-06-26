/**
 * Offline check: createJob calldata + eth_sendTransaction params shape for MetaMask.
 * Run: node scripts/verify-create-job-tx.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeFunctionData, isHex } from 'viem';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const deployments = JSON.parse(
  readFileSync(join(root, 'src/lib/contracts/deployments-sepolia.json'), 'utf8'),
);
const abi = JSON.parse(
  readFileSync(join(root, 'src/lib/contracts/abis/JobRegistry.json'), 'utf8'),
);

const from = '0xBD2975d8b1a923f1ad80046791bf4cc5570d616b';
const to = deployments.addresses.JobRegistry;
const metadataCID = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';
const contractValue = 1_000_000n;
const duration = 86400n;

const data = encodeFunctionData({
  abi,
  functionName: 'createJob',
  args: [metadataCID, contractValue, duration],
});

const txParams = { from, to, data };

console.log('JobRegistry:', to);
console.log('chainId:', deployments.chainId);
console.log('calldata length:', data.length);
console.log('calldata is hex:', isHex(data));
console.log('eth_sendTransaction params:', JSON.stringify(txParams, (_, v) =>
  typeof v === 'bigint' ? v.toString() : v,
));

if (!isHex(data)) {
  console.error('FAIL: calldata is not valid hex');
  process.exit(1);
}
if (data.length < 10) {
  console.error('FAIL: calldata too short');
  process.exit(1);
}

console.log('OK: createJob params valid for MetaMask eth_sendTransaction');
