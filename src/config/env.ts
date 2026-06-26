export const API_URL =
  import.meta.env.VITE_API_URL || 'https://fapex-backend-production.up.railway.app';

/** Demo fallback: backend INDEXER wallet relays createJob (escrow still needs INDEXER client). */
export const USE_RELAYED_CREATE_JOB =
  import.meta.env.VITE_USE_RELAYED_CREATE_JOB === 'true';
