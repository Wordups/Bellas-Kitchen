// Copy this file to js/config.js (which is gitignored) and fill in your Supabase
// project's URL and anon key to switch the app from local-only to cloud-synced.
//
// Find them in Supabase: Project Settings → API.
// Anon key is safe to expose client-side; Row-Level Security policies enforce access.

export const config = {
  supabase: {
    url:     '', // e.g. 'https://abcdefgh.supabase.co'
    anonKey: '', // public anon key
  },
  // Optional: pin this build to a specific family if you don't want the join flow
  // (handy for single-family deployments on bellaskitchen.app)
  defaultFamily: null, // { id: 'uuid', name: 'The Sharps', joinCode: '4321' }
};
