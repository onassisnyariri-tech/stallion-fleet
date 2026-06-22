export const ROLE_PERMISSIONS = {
  inspector: {
    canAccessYard: true,
    canLogFuel: false,
    canHookTrailer: false,
    canAccessTyres: false,
    canAccessMaintenance: false,
    canAccessFinancials: false, 
    canAccessAdminSettings: false,
  },
  operations: {
    canAccessYard: true,
    canLogFuel: true,       // UNMUTED
    canHookTrailer: true,   // UNMUTED
    canAccessTyres: true,   // TAB UNLOCKED
    canAccessMaintenance: true, // TAB UNLOCKED
    canAccessFinancials: false, // KEEPS EXEC/LEDGER HIDDEN
    canAccessAdminSettings: false,
  },
  admin: {
    canAccessYard: true,
    canLogFuel: true,
    canHookTrailer: true,
    canAccessTyres: true,
    canAccessMaintenance: true,
    canAccessFinancials: true,  // FULL ACCESS
    canAccessAdminSettings: true, 
  }
};