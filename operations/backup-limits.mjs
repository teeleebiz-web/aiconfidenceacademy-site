// Terrence approved these coordinated bounds on November 21, 2026.
// These are per-copy safety limits, not a monetary spending authorization.
export const sourceSnapshotLimit = 4 * 1024 ** 3
export const encryptedSnapshotLimit = sourceSnapshotLimit
export const requiredBackupDiskBytes = BigInt(sourceSnapshotLimit) * 3n + 512n * 1024n ** 2n
