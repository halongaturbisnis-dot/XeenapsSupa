
/**
 * XEENAPS PKM - CV REGISTRY MODULE (DEPRECATED)
 * Metadata moved to Supabase. This file serves as legacy stub.
 */

function setupCVDatabase() {
  return { status: 'success', message: 'CV Registry Metadata is now managed by Supabase.' };
}

function getCVFromRegistry() {
  return { status: 'error', message: 'Registry migrated to Supabase.' };
}

function saveCVToRegistry(item) {
  return { status: 'error', message: 'Registry migrated to Supabase.' };
}

function deleteCVFromRegistry(id) {
  return { status: 'success', message: 'Handled by Supabase.' };
}
