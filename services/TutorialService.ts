import { SPREADSHEET_CONFIG } from '../assets';
import { TutorialItem } from '../types';

/**
 * Service to fetch and parse Tutorial data from CSV.
 */
export const fetchTutorials = async (): Promise<Record<string, TutorialItem[]>> => {
  try {
    const response = await fetch(SPREADSHEET_CONFIG.TUTORIAL_CSV);
    if (!response.ok) {
      throw new Error('Failed to fetch tutorials');
    }
    const csvText = await response.text();
    
    // Split by new line, remove empty rows
    const rows = csvText.split('\n').map(row => row.trim()).filter(row => row.length > 0);
    
    // Skip header (Row 1)
    const dataRows = rows.slice(1);
    
    const tutorials: Record<string, TutorialItem[]> = {};

    dataRows.forEach(row => {
      // Simple CSV parsing handling comma-separated values.
      // Note: This simple split handles basic CSV. If fields contain commas, it might need regex adjustment.
      // Based on typical Google Sheets CSV export:
      // "ID","Category","Name","Link"
      
      // Regex to split by comma but ignore commas inside quotes
      const cols = row.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
      
      // Fallback if regex fails (simple split), cleaning up quotes
      const finalCols = cols.length >= 4 
        ? cols.map(c => c.replace(/^"|"$/g, '').trim()) 
        : row.split(',').map(c => c.replace(/^"|"$/g, '').trim());

      // Mapping: 
      // Col 0: ID
      // Col 1: Category
      // Col 2: Nama (Title)
      // Col 3: Link
      
      const id = finalCols[0];
      const category = finalCols[1];
      const title = finalCols[2];
      const link = finalCols[3];

      // Validate required fields
      if (id && category && title && link) {
        if (!tutorials[category]) {
          tutorials[category] = [];
        }
        tutorials[category].push({ id, category, title, link });
      }
    });

    return tutorials;
  } catch (error) {
    console.error("Failed to fetch tutorials", error);
    return {};
  }
};