import PocketBase from 'pocketbase'

export const pb = new PocketBase((import.meta as any).env.VITE_POCKETBASE_URL || 'http://localhost:8090')

// Auto-auth with email/password if env vars exist for demo/testing purposes
if ((import.meta as any).env.VITE_PB_ADMIN_EMAIL && (import.meta as any).env.VITE_PB_ADMIN_PASSWORD) {
  pb.autoCancellation(false)
  // In a real scenario, you'd authenticate directly
  // pb.admins.authWithPassword(import.meta.env.VITE_PB_ADMIN_EMAIL, import.meta.env.VITE_PB_ADMIN_PASSWORD);
}
