import { useCallback, useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { readContract } from 'wagmi/actions';
import type { Abi, Address } from 'viem';
import { wagmiConfig } from '@/config/wagmi';
import { contracts } from '@/lib/contracts/config';
import { DEPLOYER_ADDRESS } from '@/lib/contracts/addresses';
import { addressesEqual } from '@/lib/utils/address';

export interface AdminRoles {
  pauser: boolean;
  forceResolver: boolean;
  arbitratorManager: boolean;
}

export interface AdminAccess {
  loading: boolean;
  error?: string;
  isAdmin: boolean;
  isVaultAdmin: boolean;
  isPanelAdmin: boolean;
  isDeployer: boolean;
  canPause: boolean;
  canGrantVaultRoles: boolean;
  canGrantPanelRoles: boolean;
  canForceResolve: boolean;
  canManageArbitrators: boolean;
  vaultAdmin?: Address;
  panelAdmin?: Address;
  escrowPaused?: boolean;
  poolSize?: number;
  roles: AdminRoles;
  refresh: () => void;
}

const EMPTY_ROLES: AdminRoles = {
  pauser: false,
  forceResolver: false,
  arbitratorManager: false,
};

export function useAdminAccess(): AdminAccess {
  const { address } = useAccount();
  const [refreshKey, setRefreshKey] = useState(0);
  const [state, setState] = useState<AdminAccess>({
    loading: Boolean(address),
    isAdmin: false,
    isVaultAdmin: false,
    isPanelAdmin: false,
    isDeployer: false,
    canPause: false,
    canGrantVaultRoles: false,
    canGrantPanelRoles: false,
    canForceResolve: false,
    canManageArbitrators: false,
    roles: EMPTY_ROLES,
    refresh: () => setRefreshKey((k) => k + 1),
  });

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    if (!address) {
      setState({
        loading: false,
        isAdmin: false,
        isVaultAdmin: false,
        isPanelAdmin: false,
        isDeployer: false,
        canPause: false,
        canGrantVaultRoles: false,
        canGrantPanelRoles: false,
        canForceResolve: false,
        canManageArbitrators: false,
        roles: EMPTY_ROLES,
        refresh,
      });
      return;
    }

    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, error: undefined }));

    (async () => {
      try {
        const vaultAbi = contracts.escrowVault.abi as Abi;
        const panelAbi = contracts.arbitratorPanel.abi as Abi;

        const [
          vaultAdmin,
          panelAdmin,
          escrowPaused,
          poolSize,
          rolePauser,
          roleForceResolver,
          roleArbManager,
        ] = await Promise.all([
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
          readContract(wagmiConfig, {
            address: contracts.escrowVault.address,
            abi: vaultAbi,
            functionName: 'paused',
          }),
          readContract(wagmiConfig, {
            address: contracts.arbitratorPanel.address,
            abi: panelAbi,
            functionName: 'poolSize',
          }),
          readContract(wagmiConfig, {
            address: contracts.escrowVault.address,
            abi: vaultAbi,
            functionName: 'ROLE_PAUSER',
          }),
          readContract(wagmiConfig, {
            address: contracts.escrowVault.address,
            abi: vaultAbi,
            functionName: 'ROLE_FORCE_RESOLVER',
          }),
          readContract(wagmiConfig, {
            address: contracts.arbitratorPanel.address,
            abi: panelAbi,
            functionName: 'ROLE_ARBITRATOR_MANAGER',
          }),
        ]);

        const pauserRole = rolePauser as bigint;
        const forceRole = roleForceResolver as bigint;
        const arbManagerRole = roleArbManager as bigint;

        const [hasPauserExact, hasForceExact, hasArbManagerExact] = await Promise.all([
          readContract(wagmiConfig, {
            address: contracts.escrowVault.address,
            abi: vaultAbi,
            functionName: 'hasRole',
            args: [address, pauserRole],
          }),
          readContract(wagmiConfig, {
            address: contracts.escrowVault.address,
            abi: vaultAbi,
            functionName: 'hasRole',
            args: [address, forceRole],
          }),
          readContract(wagmiConfig, {
            address: contracts.arbitratorPanel.address,
            abi: panelAbi,
            functionName: 'hasRole',
            args: [address, arbManagerRole],
          }),
        ]);

        const vaultAdminAddr = vaultAdmin as Address;
        const panelAdminAddr = panelAdmin as Address;
        const isVaultAdmin = addressesEqual(address, vaultAdminAddr);
        const isPanelAdmin = addressesEqual(address, panelAdminAddr);
        const isDeployer = addressesEqual(address, DEPLOYER_ADDRESS);

        const roles: AdminRoles = {
          pauser: Boolean(hasPauserExact),
          forceResolver: Boolean(hasForceExact),
          arbitratorManager: Boolean(hasArbManagerExact),
        };

        const canPause = isVaultAdmin || isDeployer || roles.pauser;
        const canForceResolve = isVaultAdmin || isDeployer || roles.forceResolver;
        const canManageArbitrators = isPanelAdmin || isDeployer || roles.arbitratorManager;
        const isAdmin =
          isVaultAdmin ||
          isPanelAdmin ||
          isDeployer ||
          roles.pauser ||
          roles.forceResolver ||
          roles.arbitratorManager;

        if (!cancelled) {
          setState({
            loading: false,
            isAdmin,
            isVaultAdmin,
            isPanelAdmin,
            isDeployer,
            canPause,
            canGrantVaultRoles: isVaultAdmin || isDeployer,
            canGrantPanelRoles: isPanelAdmin || isDeployer,
            canForceResolve,
            canManageArbitrators,
            vaultAdmin: vaultAdminAddr,
            panelAdmin: panelAdminAddr,
            escrowPaused: Boolean(escrowPaused),
            poolSize: Number(poolSize),
            roles,
            refresh,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            loading: false,
            isAdmin: false,
            isVaultAdmin: false,
            isPanelAdmin: false,
            isDeployer: false,
            canPause: false,
            canGrantVaultRoles: false,
            canGrantPanelRoles: false,
            canForceResolve: false,
            canManageArbitrators: false,
            roles: EMPTY_ROLES,
            error: err instanceof Error ? err.message : 'Failed to read admin access on-chain',
            refresh,
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [address, refreshKey, refresh]);

  return state;
}
