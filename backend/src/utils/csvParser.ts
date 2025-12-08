import { parseAndNormalizeDate } from './dateParser.js';
import type { CreateDrawInput } from '../types/index.js';

export interface CSVParseResult {
  draws: CreateDrawInput[];
  errors: string[];
}

/**
 * Parse CSV content into CreateDrawInput array
 * Expected CSV format:
 * Draw Date,Lotto Type,Winning Numbers,Machine Numbers,Source
 * 2024-01-01,5/90,"1,2,3,4,5","6,7,8,9,10",theb2b.com
 */
export function parseCSV(csvContent: string): CSVParseResult {
  const lines = csvContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  if (lines.length === 0) {
    return { draws: [], errors: ['CSV file is empty'] };
  }

  // Skip header row
  const dataLines = lines.slice(1);
  const draws: CreateDrawInput[] = [];
  const errors: string[] = [];

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i];
    const lineNumber = i + 2; // +2 because we skipped header and 0-indexed

    try {
      // Parse CSV line (handle quoted values)
      const row = parseCSVLine(line);
      
      if (row.length < 4) {
        errors.push(`Line ${lineNumber}: Insufficient columns (expected at least 4)`);
        continue;
      }

      const [drawDate, lottoType, winningNumbersStr, machineNumbersStr, source] = row;

      // Validate draw date
      if (!drawDate || !isValidDate(drawDate)) {
        errors.push(`Line ${lineNumber}: Invalid draw date "${drawDate}"`);
        continue;
      }

      // Validate lotto type
      if (!lottoType || lottoType.trim().length === 0) {
        errors.push(`Line ${lineNumber}: Missing lotto type`);
        continue;
      }

      // Parse winning numbers
      const winningNumbers = parseNumbers(winningNumbersStr);
      if (winningNumbers.length !== 5) {
        errors.push(`Line ${lineNumber}: Winning numbers must contain exactly 5 numbers, got ${winningNumbers.length}`);
        continue;
      }

      // Parse machine numbers
      const machineNumbers = parseNumbers(machineNumbersStr);
      if (machineNumbers.length !== 5) {
        errors.push(`Line ${lineNumber}: Machine numbers must contain exactly 5 numbers, got ${machineNumbers.length}`);
        continue;
      }

      // Validate number ranges (1-90)
      const allNumbers = [...winningNumbers, ...machineNumbers];
      const invalidNumbers = allNumbers.filter(n => n < 1 || n > 90);
      if (invalidNumbers.length > 0) {
        errors.push(`Line ${lineNumber}: Invalid numbers (must be 1-90): ${invalidNumbers.join(', ')}`);
        continue;
      }

      draws.push({
        drawDate: formatDate(drawDate),
        lottoType: lottoType.trim(),
        winningNumbers,
        machineNumbers,
        source: source?.trim() || 'csv-import',
      });
    } catch (error) {
      errors.push(`Line ${lineNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return { draws, errors };
}

/**
 * Parse a CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  // Add last field
  result.push(current.trim());

  return result;
}

/**
 * Parse numbers from comma-separated string
 */
function parseNumbers(numbersStr: string): number[] {
  if (!numbersStr) return [];
  
  return numbersStr
    .split(',')
    .map(n => parseInt(n.trim(), 10))
    .filter(n => !isNaN(n));
}

/**
 * Validate and format date
 */
function isValidDate(dateStr: string): boolean {
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

/**
 * Format date to YYYY-MM-DD using unified parser
 * Handles ambiguous formats like 12/6/2025 vs 6/12/2025
 */
function formatDate(dateStr: string): string {
  return parseAndNormalizeDate(dateStr);
}

