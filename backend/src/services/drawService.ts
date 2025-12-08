import pool from '../database/db.js';
import { logger } from '../utils/logger.js';
import type { Draw, CreateDrawInput, SearchQuery, SearchResult } from '../types/index.js';

export class DrawService {
  // Get all draws with optional filters
  async getDraws(filters?: {
    startDate?: string;
    endDate?: string;
    lottoType?: string;
    limit?: number;
    offset?: number;
  }): Promise<Draw[]> {
    let query = 'SELECT * FROM draws WHERE 1=1';
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters?.startDate) {
      query += ` AND draw_date >= $${paramIndex}`;
      params.push(filters.startDate);
      paramIndex++;
    }

    if (filters?.endDate) {
      query += ` AND draw_date <= $${paramIndex}`;
      params.push(filters.endDate);
      paramIndex++;
    }

    if (filters?.lottoType) {
      query += ` AND lotto_type = $${paramIndex}`;
      params.push(filters.lottoType);
      paramIndex++;
    }

    query += ' ORDER BY draw_date DESC';

    if (filters?.limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(filters.limit);
      paramIndex++;
    }

    if (filters?.offset) {
      query += ` OFFSET $${paramIndex}`;
      params.push(filters.offset);
      paramIndex++;
    }

    const result = await pool.query(query, params);
    return this.mapRowsToDraws(result.rows);
  }

  // Get single draw by ID
  async getDrawById(id: string): Promise<Draw | null> {
    const result = await pool.query('SELECT * FROM draws WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return this.mapRowToDraw(result.rows[0]);
  }

  // Get draw by date and type
  async getDrawByDateAndType(drawDate: string, lottoType: string): Promise<Draw | null> {
    const result = await pool.query(
      'SELECT * FROM draws WHERE draw_date = $1 AND lotto_type = $2',
      [drawDate, lottoType]
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToDraw(result.rows[0]);
  }

  // Create new draw
  async createDraw(input: CreateDrawInput): Promise<Draw> {
    const result = await pool.query(
      `INSERT INTO draws (draw_date, lotto_type, winning_numbers, machine_numbers, source, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        input.drawDate,
        input.lottoType,
        input.winningNumbers,
        input.machineNumbers,
        input.source || null,
        input.metadata ? JSON.stringify(input.metadata) : null,
      ]
    );
    return this.mapRowToDraw(result.rows[0]);
  }

  // Batch insert draws (with conflict handling)
  async batchInsertDraws(inputs: CreateDrawInput[]): Promise<{ inserted: number; skipped: number; errors: number }> {
    if (inputs.length === 0) {
      logger.warn('batchInsertDraws called with empty array');
      return { inserted: 0, skipped: 0, errors: 0 };
    }

    logger.info(`Starting batch insert of ${inputs.length} draw(s)...`);

    let inserted = 0;
    let skipped = 0;
    let errors = 0;

    // Use a transaction for batch insert
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      logger.debug('Transaction started');

      for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i];
        try {
          // Use ON CONFLICT to skip duplicates
          const result = await client.query(
            `INSERT INTO draws (draw_date, lotto_type, winning_numbers, machine_numbers, source, metadata)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (draw_date, lotto_type) DO NOTHING
             RETURNING id`,
            [
              input.drawDate,
              input.lottoType,
              input.winningNumbers,
              input.machineNumbers,
              input.source || null,
              input.metadata ? JSON.stringify(input.metadata) : null,
            ]
          );

          if (result.rows.length > 0) {
            inserted++;
            if (i < 3 || inserted <= 3) {
              logger.debug(`Inserted draw: ${input.drawDate} ${input.lottoType}`);
            }
          } else {
            skipped++;
          }
        } catch (error) {
          errors++;
          // Log error but continue with other inserts
          logger.error(`Error inserting draw ${input.drawDate} ${input.lottoType}`, error);
        }
      }

      await client.query('COMMIT');
      logger.info(`Batch insert completed: ${inserted} inserted, ${skipped} skipped, ${errors} errors`);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Transaction rolled back due to error', error);
      throw error;
    } finally {
      client.release();
    }

    return { inserted, skipped, errors };
  }

  // Search draws by numbers
  async searchDraws(query: SearchQuery): Promise<SearchResult[]> {
    const { numbers, mode = 'partial', minMatches = 1 } = query;

    if (!numbers || numbers.length === 0) {
      return this.getDraws({
        startDate: query.startDate,
        endDate: query.endDate,
        lottoType: query.lottoType,
      });
    }

    let sqlQuery = `
      SELECT 
        d.*,
        (
          SELECT COUNT(*) 
          FROM unnest(d.winning_numbers || d.machine_numbers) AS num 
          WHERE num = ANY($1)
        ) AS match_count_all,
        (
          SELECT COUNT(*) 
          FROM unnest(d.winning_numbers) AS num 
          WHERE num = ANY($1)
        ) AS match_count_winning,
        (
          SELECT COUNT(*) 
          FROM unnest(d.machine_numbers) AS num 
          WHERE num = ANY($1)
        ) AS match_count_machine
      FROM draws d
      WHERE 1=1
    `;

    const params: unknown[] = [numbers];
    let paramIndex = 2;

    if (query.startDate) {
      sqlQuery += ` AND d.draw_date >= $${paramIndex}`;
      params.push(query.startDate);
      paramIndex++;
    }

    if (query.endDate) {
      sqlQuery += ` AND d.draw_date <= $${paramIndex}`;
      params.push(query.endDate);
      paramIndex++;
    }

    if (query.lottoType) {
      sqlQuery += ` AND d.lotto_type = $${paramIndex}`;
      params.push(query.lottoType);
      paramIndex++;
    }

    // Apply mode filter
    if (mode === 'exact') {
      sqlQuery += ` AND (
        SELECT COUNT(*) FROM unnest(d.winning_numbers || d.machine_numbers) AS num WHERE num = ANY($1)
      ) = $${paramIndex} AND array_length($1, 1) = 10`;
      params.push(numbers.length);
      paramIndex++;
    } else if (mode === 'group') {
      // Group search: at least 2 numbers from the group must appear together
      // Numbers must be in winning panel OR machine panel, but NOT across both
      const groupMinMatches = Math.max(2, minMatches); // At least 2, or use minMatches if higher
      sqlQuery += ` AND (
        (SELECT COUNT(*) FROM unnest(d.winning_numbers) AS num WHERE num = ANY($1)) >= $${paramIndex}
        OR
        (SELECT COUNT(*) FROM unnest(d.machine_numbers) AS num WHERE num = ANY($1)) >= $${paramIndex}
      )`;
      params.push(groupMinMatches);
      paramIndex++;
    } else if (mode === 'winning-only') {
      sqlQuery += ` AND (
        SELECT COUNT(*) FROM unnest(d.winning_numbers) AS num WHERE num = ANY($1)
      ) >= $${paramIndex}`;
      params.push(minMatches);
      paramIndex++;
    } else if (mode === 'machine-only') {
      sqlQuery += ` AND (
        SELECT COUNT(*) FROM unnest(d.machine_numbers) AS num WHERE num = ANY($1)
      ) >= $${paramIndex}`;
      params.push(minMatches);
      paramIndex++;
    } else {
      // partial mode
      sqlQuery += ` AND (
        SELECT COUNT(*) FROM unnest(d.winning_numbers || d.machine_numbers) AS num WHERE num = ANY($1)
      ) >= $${paramIndex}`;
      params.push(minMatches);
      paramIndex++;
    }

    // Order by appropriate match count based on mode
    if (mode === 'winning-only') {
      sqlQuery += ' ORDER BY match_count_winning DESC, d.draw_date DESC';
    } else if (mode === 'machine-only') {
      sqlQuery += ' ORDER BY match_count_machine DESC, d.draw_date DESC';
    } else {
      sqlQuery += ' ORDER BY match_count_all DESC, d.draw_date DESC';
    }

    const result = await pool.query(sqlQuery, params);
    return result.rows.map((row) => {
      const draw = this.mapRowToDraw(row);
      // Set matchCount based on mode
      let matchCount = parseInt(row.match_count_all, 10);
      if (mode === 'winning-only') {
        matchCount = parseInt(row.match_count_winning, 10);
      } else if (mode === 'machine-only') {
        matchCount = parseInt(row.match_count_machine, 10);
      }
      
      return {
        ...draw,
        matchCount,
        matchCountWinning: parseInt(row.match_count_winning, 10),
        matchCountMachine: parseInt(row.match_count_machine, 10),
      };
    });
  }

  // Get latest draw
  async getLatestDraw(lottoType?: string): Promise<Draw | null> {
    let query = 'SELECT * FROM draws';
    const params: unknown[] = [];

    if (lottoType) {
      query += ' WHERE lotto_type = $1';
      params.push(lottoType);
    }

    query += ' ORDER BY draw_date DESC, published_at DESC LIMIT 1';

    const result = await pool.query(query, params);
    if (result.rows.length === 0) return null;
    return this.mapRowToDraw(result.rows[0]);
  }

  // Find similar draws (previous occurrences)
  async findSimilarDraws(
    drawId: string,
    minMatches: number = 3,
    limit: number = 10
  ): Promise<SearchResult[]> {
    // Get the target draw
    const targetDraw = await this.getDrawById(drawId);
    if (!targetDraw) {
      return [];
    }

    const allTargetNumbers = [...targetDraw.winningNumbers, ...targetDraw.machineNumbers];

    // Find draws with overlapping numbers, excluding the target draw
    // Show separate matches for winning and machine, don't combine
    const sqlQuery = `
      SELECT 
        d.*,
        (
          SELECT COUNT(*) 
          FROM unnest(d.winning_numbers) AS num 
          WHERE num = ANY($1)
        ) AS match_count_winning,
        (
          SELECT COUNT(*) 
          FROM unnest(d.machine_numbers) AS num 
          WHERE num = ANY($1)
        ) AS match_count_machine
      FROM draws d
      WHERE d.id != $2
        AND (
          (SELECT COUNT(*) FROM unnest(d.winning_numbers) AS num WHERE num = ANY($1)) >= $3
          OR
          (SELECT COUNT(*) FROM unnest(d.machine_numbers) AS num WHERE num = ANY($1)) >= $3
        )
      ORDER BY 
        GREATEST(
          (SELECT COUNT(*) FROM unnest(d.winning_numbers) AS num WHERE num = ANY($1)),
          (SELECT COUNT(*) FROM unnest(d.machine_numbers) AS num WHERE num = ANY($1))
        ) DESC,
        d.draw_date DESC
      LIMIT $4
    `;

    const result = await pool.query(sqlQuery, [
      allTargetNumbers,
      drawId,
      minMatches,
      limit,
    ]);

    return result.rows.map((row) => {
      const winningMatches = parseInt(row.match_count_winning, 10);
      const machineMatches = parseInt(row.match_count_machine, 10);
      // Use the higher of the two match counts for display
      const maxMatches = Math.max(winningMatches, machineMatches);
      
      return {
        ...this.mapRowToDraw(row),
        matchCount: maxMatches, // For backward compatibility
        matchCountWinning: winningMatches,
        matchCountMachine: machineMatches,
      };
    });
  }

  // Helper: Map database row to Draw type
  private mapRowToDraw(row: any): Draw {
    return {
      id: row.id,
      drawDate: row.draw_date,
      lottoType: row.lotto_type,
      winningNumbers: row.winning_numbers,
      machineNumbers: row.machine_numbers,
      source: row.source,
      publishedAt: row.published_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      metadata: row.metadata,
    };
  }

  // Helper: Map multiple rows
  private mapRowsToDraws(rows: any[]): Draw[] {
    return rows.map((row) => this.mapRowToDraw(row));
  }
}

export const drawService = new DrawService();

