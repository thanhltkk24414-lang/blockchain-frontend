import { useCallback, useEffect, useState } from 'react';
import { readContract } from 'wagmi/actions';
import type { Abi, Address } from 'viem';
import { getAddress, isAddress } from 'viem';
import { wagmiConfig } from '@/config/wagmi';
import { contracts } from '@/lib/contracts/config';
import { DEPLOYER_ADDRESS } from '@/lib/contracts/addresses';
import { addressesEqual, truncateAddress } from '@/lib/utils/address';

export type RoleHolderRow = {
  address: Address;
  label: string;
  hasRole: boolean;
};

export type RoleHoldersState = {
  loading: boolean;
  rows: RoleHolderRow[];
  refresh: () => void;
};

function uniqueAddresses(candidates: (string | undefined)[]): Address[] {
  const seen = new Set<string>();
  const out: Address[] = [];
  for (const raw of candidates) {
    if (!raw || !isAddress(raw)) continue;
    const addr = getAddress(raw);
    const key = addr.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(addr);
  }
  return out;
}

export function useRoleHolders(
  roleKind: string,
  extraAddress?: string,
): RoleHoldersState {
  const [refreshKey, setRefreshKey] = useState(0);
  const [state, setState] = useState<RoleHoldersState>({
    loading: false,
    rows: [],
    refresh: () => setRefreshKey((k) => k + 1),
  });

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, refresh }));

    (async () => {
      try {
        const vaultAbi = contracts.escrowVault.abi as Abi;
        const panelAbi = contracts.arbitratorPanel.abi as Abi;

        const [vaultAdmin, panelAdmin] = await Promise.all([
          readContract(wagmiConfig, {
            address: contracts.escrowVault.address,
            abi: vaultAbi,
            functionName: 'admin',
          }),
          readContract(wagmiConfig, {
            address: contracts.arbitratorPanel.address,
            abi: panelAbi,
            functionName: 'admin',
          }),
        ]);

        let contract: 'escrow' | 'panel' = 'escrow';
        let roleId: bigint;

        if (roleKind === 'escrow_pauser') {
          roleId = (await readContract(wagmiConfig, {
            address: contracts.escrowVault.address,
            abi: vaultAbi,
            functionName: 'ROLE_PAUSER',
          })) as bigint;
        } else if (roleKind === 'escrow_force_resolver') {
          roleId = (await readContract(wagmiConfig, {
            address: contracts.escrowVault.address,
            abi: vaultAbi,
            functionName: 'ROLE_FORCE_RESOLVER',
          })) as bigint;
        } else {
          contract = 'panel';
          roleId = (await readContract(wagmiConfig, {
            address: contracts.arbitratorPanel.address,
            abi: panelAbi,
            functionName: 'ROLE_ARBITRATOR_MANAGER',
          })) as bigint;
        }

        const candidates = uniqueAddresses([
          DEPLOYER_ADDRESS,
          vaultAdmin as string,
          panelAdmin as string,
          extraAddress,
        ]);

        const labels = new Map<string, string>();
        labels.set(DEPLOYER_ADDRESS.toLowerCase(), 'Deployer');
        labels.set((vaultAdmin as string).toLowerCase(), 'EscrowVault admin');
        labels.set((panelAdmin as string).toLowerCase(), 'ArbitratorPanel admin');
        if (extraAddress && isAddress(extraAddress)) {
          labels.set(getAddress(extraAddress).toLowerCase(), 'Entered address');
        }

        const rows: RoleHolderRow[] = await Promise.all(
          candidates.map(async (addr) => {
            const isAdmin =
              contract === 'escrow'
                ? addressesEqual(addr, vaultAdmin as string)
                : addressesEqual(addr, panelAdmin as string);

            const delegated = (await readContract(wagmiConfig, {
              address:
                contract === 'escrow'
                  ? contracts.escrowVault.address
                  : contracts.arbitratorPanel.address,
              abi: contract === 'escrow' ? vaultAbi : panelAbi,
              functionName: 'hasRole',
              args: [addr, roleId],
            })) as boolean;

            return {
              address: addr,
              label: labels.get(addr.toLowerCase()) ?? truncateAddress(addr),
              hasRole: isAdmin || Boolean(delegated),
            };
          }),
        );

        if (!cancelled) {
          setState({
            loading: false,
            rows: rows.filter((r) => r.hasRole),
            refresh,
          });
        }
      } catch {
        if (!cancelled) {
          setState({ loading: false, rows: [], refresh });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [roleKind, extraAddress, refreshKey, refresh]);

  return state;
}
