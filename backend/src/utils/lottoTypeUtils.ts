/**
 * Utilities for working with lotto types and their corresponding table names
 */

/**
 * Normalize lotto type name to a valid PostgreSQL table name
 * Converts "Monday Special" -> "monday_special"
 */
export function normalizeLottoTypeToTableName(lottoType: string): string {
  return lottoType
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_') // Replace non-alphanumeric with underscore
    .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
    .replace(/_+/g, '_'); // Replace multiple underscores with single
}

/**
 * Get the table name for a specific lotto type
 * Returns: draws_<normalized_type>
 */
export function getLottoTypeTableName(lottoType: string): string {
  const normalized = normalizeLottoTypeToTableName(lottoType);
  return `draws_${normalized}`;
}

/**
 * Check if a table name is a lotto type-specific table
 */
export function isLottoTypeTable(tableName: string): boolean {
  return tableName.startsWith('draws_') && tableName !== 'draws';
}

/**
 * Extract lotto type from table name
 * Returns null if not a lotto type table
 */
export function extractLottoTypeFromTableName(tableName: string): string | null {
  if (!isLottoTypeTable(tableName)) {
    return null;
  }
  return tableName.replace(/^draws_/, '');
}

/**
 * Get all available lotto types from the database
 * Returns all distinct lotto types, trimmed and sorted
 */
export async function getAvailableLottoTypes(pool: any): Promise<string[]> {
  const result = await pool.query(
    `SELECT DISTINCT TRIM(lotto_type) as lotto_type
     FROM draws 
     WHERE lotto_type IS NOT NULL 
       AND TRIM(lotto_type) != ''
     ORDER BY lotto_type`
  );
  
  // Map and filter out any empty strings, then sort
  const types = result.rows
    .map((row: any) => row.lotto_type?.trim())
    .filter((type: string) => type && type.length > 0);
  
  // Remove duplicates (case-insensitive) and sort
  const uniqueTypes = Array.from(
    new Map(types.map((type: string) => [type.toLowerCase(), type])).values()
  ).sort() as string[];
  
  return uniqueTypes;
}

