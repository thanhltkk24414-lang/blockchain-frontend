/**
 * Integration check: createJob calldata + public RPC simulateContract.
 * Run: node scripts/verify-create-job-tx.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPublicClient, encodeFunctionData, getAddress, http, isAddress, isHex } from 'viem';
import { sepolia } from 'viem/chains';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const deployments = JSON.parse(
  readFileSync(join(root, 'src/lib/contracts/deployments-sepolia.json'), 'utf8'),
);
const abi = JSON.parse(
  readFileSync(join(root, 'src/lib/contracts/abis/JobRegistry.json'), 'utf8'),
);

const from = getAddress('0x7f03D60375DE680C55FC08dd48EA0D4B449eabDD');
const to = getAddress(deployments.addresses.JobRegistry);
const metadataCID = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';
const contractValue = 1_000_000n;
const duration = 86400n;

const data = encodeFunctionData({
  abi,
  functionName: 'createJob',
  args: [metadataCID, contractValue, duration],
});

const txParams = { to, data };

console.log('JobRegistry:', to);
console.log('chainId:', deployments.chainId);
console.log('simulate account:', from);
console.log('calldata length:', data.length);
console.log('calldata is hex:', isHex(data));
console.log('selector:', data.slice(0, 10));
console.log('wagmi sendTransaction shape:', JSON.stringify(txParams));

let failed = false;
if (!isHex(data)) {
  console.error('FAIL: calldata is not valid hex');
  failed = true;
}
if (data.length < 10) {
  console.error('FAIL: calldata too short');
  failed = true;
}
if (!isAddress(from)) {
  console.error('FAIL: from is not a valid address');
  failed = true;
}
if (!isAddress(to)) {
  console.error('FAIL: to is not a valid address');
  failed = true;
}
if (data.slice(0, 10) !== '0x79c62711') {
  console.error('FAIL: unexpected createJob selector', data.slice(0, 10));
  failed = true;
}

if (failed) process.exit(1);

const client = createPublicClient({
  chain: sepolia,
  transport: http('https://ethereum-sepolia-rpc.publicnode.com'),
});

try {
  const { result } = await client.simulateContract({
    address: to,
    abi,
    functionName: 'createJob',
    args: [metadataCID, contractValue, duration],
    account: from,
  });
  console.log('OK: simulateContract succeeded — predicted jobId', result?.toString?.() ?? result);
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  if (/AccountRestricted|restricted/i.test(msg)) {
    console.warn('WARN: simulate reverted (reputation) — calldata/ABI OK:', msg);
    console.log('OK: encode path valid; wallet may need non-Restricted tier');
    process.exit(0);
  }
  console.error('FAIL: simulateContract', msg);
  process.exit(1);
}
