
/**
 * XEENAPS PKM - PUBLICATION REGISTRY (DEPRECATED)
 * Metadata moved to Supabase. This file serves as legacy stub.
 */

function setupPublicationDatabase() {
  return { status: 'success', message: 'Publication Metadata is now managed by Supabase.' };
}

function getPublicationFromRegistry() {
  return { status: 'error', message: 'Registry migrated to Supabase.' };
}

function savePublicationToRegistry(item) {
  return { status: 'error', message: 'Registry migrated to Supabase.' };
}

function deletePublicationFromRegistry(id) {
  return { status: 'success', message: 'Handled by Supabase.' };
}
