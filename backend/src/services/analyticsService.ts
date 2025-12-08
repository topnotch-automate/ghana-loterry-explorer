import pool from '../database/db.js';
import type { FrequencyStats, AnalyticsTimeframe, CoOccurrenceTriplet, CoOccurrencePair, CoOccurrenceData } from '../types/index.js';

export class AnalyticsService {
  // Get frequency statistics for numbers
  async getFrequencyStats(
    timeframe?: AnalyticsTimeframe,
    lottoType?: string
  ): Promise<FrequencyStats[]> {
    let query = `
      SELECT 
        num AS number,
        COUNT(*) AS total_count,
        COUNT(*) FILTER (WHERE panel = 'winning') AS winning_count,
        COUNT(*) FILTER (WHERE panel = 'machine') AS machine_count,
        MAX(draw_date) AS last_seen
      FROM (
        SELECT unnest(winning_numbers) AS num, 'winning' AS panel, draw_date 
        FROM draws
        WHERE 1=1
    `;

    const params: unknown[] = [];
    let paramIndex = 1;

    if (lottoType) {
      query += ` AND lotto_type = $${paramIndex}`;
      params.push(lottoType);
      paramIndex++;
    }

    if (timeframe?.days) {
      query += ` AND draw_date >= CURRENT_DATE - INTERVAL '${timeframe.days} days'`;
    } else if (timeframe?.yearly) {
      query += ` AND draw_date >= DATE_TRUNC('year', CURRENT_DATE)`;
    } else if (timeframe?.monthly) {
      query += ` AND draw_date >= DATE_TRUNC('month', CURRENT_DATE)`;
    } else if (timeframe?.weekly) {
      query += ` AND draw_date >= DATE_TRUNC('week', CURRENT_DATE)`;
    } else if (timeframe?.daily) {
      query += ` AND draw_date = CURRENT_DATE`;
    }

    query += `
        UNION ALL
        SELECT unnest(machine_numbers) AS num, 'machine' AS panel, draw_date 
        FROM draws
        WHERE 1=1
    `;

    if (lottoType) {
      query += ` AND lotto_type = $${paramIndex}`;
      params.push(lottoType);
      paramIndex++;
    }

    if (timeframe?.days) {
      query += ` AND draw_date >= CURRENT_DATE - INTERVAL '${timeframe.days} days'`;
    } else if (timeframe?.yearly) {
      query += ` AND draw_date >= DATE_TRUNC('year', CURRENT_DATE)`;
    } else if (timeframe?.monthly) {
      query += ` AND draw_date >= DATE_TRUNC('month', CURRENT_DATE)`;
    } else if (timeframe?.weekly) {
      query += ` AND draw_date >= DATE_TRUNC('week', CURRENT_DATE)`;
    } else if (timeframe?.daily) {
      query += ` AND draw_date = CURRENT_DATE`;
    }

    query += `
      ) AS all_numbers
      GROUP BY num
      ORDER BY total_count DESC, number ASC
    `;

    const result = await pool.query(query, params);
    return result.rows.map((row) => ({
      number: parseInt(row.number, 10),
      totalCount: parseInt(row.total_count, 10),
      winningCount: parseInt(row.winning_count, 10),
      machineCount: parseInt(row.machine_count, 10),
      lastSeen: row.last_seen,
    }));
  }

  // Get hot numbers (appearing more than average) - ONLY from winning numbers
  async getHotNumbers(days: number = 30, lottoType?: string): Promise<FrequencyStats[]> {
    // Get frequency stats but only for winning numbers
    const stats = await this.getFrequencyStats({ days }, lottoType);
    if (stats.length === 0) return [];

    // Filter to only consider winning count, not total count
    const winningStats = stats
      .filter((s) => s.winningCount > 0)
      .map((s) => ({ ...s, totalCount: s.winningCount })); // Use winningCount as the metric
    
    if (winningStats.length === 0) return [];

    const avgCount = winningStats.reduce((sum, s) => sum + s.totalCount, 0) / winningStats.length;
    return winningStats.filter((s) => s.totalCount > avgCount).slice(0, 10);
  }

  // Get cold numbers (appearing less than average or not at all) - ONLY from winning numbers
  async getColdNumbers(days: number = 30, lottoType?: string): Promise<FrequencyStats[]> {
    // Get frequency stats but only for winning numbers
    const stats = await this.getFrequencyStats({ days }, lottoType);
    if (stats.length === 0) return [];

    // Filter to only consider winning count, not total count
    const winningStats = stats
      .filter((s) => s.winningCount > 0)
      .map((s) => ({ ...s, totalCount: s.winningCount })); // Use winningCount as the metric
    
    if (winningStats.length === 0) return [];

    const avgCount = winningStats.reduce((sum, s) => sum + s.totalCount, 0) / winningStats.length;
    return winningStats.filter((s) => s.totalCount < avgCount || s.totalCount === 0).slice(0, 10);
  }

  // Get sleeping numbers (not appeared in X days)
  // Logic: All numbers 1-90 are "asleep" except those that appeared in winning OR machine within the timeframe
  async getSleepingNumbers(days: number = 30): Promise<number[]> {
    try {
      // First, check if there are any draws in the period
      const drawsCheckQuery = `
        SELECT COUNT(*) as count
        FROM draws
        WHERE draw_date >= CURRENT_DATE - INTERVAL '${days} days'
      `;
      
      const drawsCheck = await pool.query(drawsCheckQuery);
      const drawCount = parseInt(drawsCheck.rows[0]?.count || '0', 10);
      
      // If no draws exist in the period, return empty array (not all numbers)
      if (drawCount === 0) {
        return [];
      }
      
      // Get all numbers that HAVE appeared in winning OR machine in the last X days
      // Use a simpler approach: get distinct numbers from both arrays
      const appearedQuery = `
        WITH all_numbers AS (
          SELECT DISTINCT num
          FROM (
            SELECT unnest(winning_numbers) AS num
            FROM draws
            WHERE draw_date >= CURRENT_DATE - INTERVAL '${days} days'
            UNION
            SELECT unnest(machine_numbers) AS num
            FROM draws
            WHERE draw_date >= CURRENT_DATE - INTERVAL '${days} days'
          ) AS combined
          WHERE num BETWEEN 1 AND 90
        )
        SELECT num FROM all_numbers
        ORDER BY num
      `;
      
      const appearedResult = await pool.query(appearedQuery);
      
      const appearedNumbers = new Set(
        appearedResult.rows.map((row) => parseInt(row.num, 10))
      );
      
      // Return all numbers 1-90 that have NOT appeared (these are "sleeping")
      const allNumbers = Array.from({ length: 90 }, (_, i) => i + 1);
      const sleeping = allNumbers.filter((num) => !appearedNumbers.has(num));
      
      return sleeping;
    } catch (error) {
      console.error('Error getting sleeping numbers:', error);
      return [];
    }
  }

  // Get total draw count
  async getTotalDrawCount(lottoType?: string): Promise<number> {
    let query = 'SELECT COUNT(*) FROM draws';
    const params: unknown[] = [];

    if (lottoType) {
      query += ' WHERE lotto_type = $1';
      params.push(lottoType);
    }

    const result = await pool.query(query, params);
    return parseInt(result.rows[0].count, 10);
  }

  // Get date range of draws
  async getDateRange(): Promise<{ minDate: string; maxDate: string } | null> {
    const result = await pool.query(
      'SELECT MIN(draw_date) AS min_date, MAX(draw_date) AS max_date FROM draws'
    );
    if (!result.rows[0].min_date) return null;

    return {
      minDate: result.rows[0].min_date,
      maxDate: result.rows[0].max_date,
    };
  }

  // Calculate and update co-occurrence triplets
  async updateCoOccurrenceTriplets(days?: number, lottoType?: string): Promise<void> {
    // Build WHERE clause
    let whereClause = '';
    const params: unknown[] = [];
    let paramIndex = 1;

    if (days || lottoType) {
      const conditions: string[] = [];
      if (days) {
        conditions.push(`draw_date >= CURRENT_DATE - INTERVAL '${days} days'`);
      }
      if (lottoType) {
        conditions.push(`lotto_type = $${paramIndex}`);
        params.push(lottoType);
        paramIndex++;
      }
      whereClause = 'WHERE ' + conditions.join(' AND ');
    }

    // Calculate co-occurrence triplets from all draws
    // For each draw, generate all triplets from winning and machine numbers
    const query = `
      WITH draw_data AS (
        SELECT 
          id,
          draw_date,
          winning_numbers,
          machine_numbers
        FROM draws
        ${whereClause}
      ),
      expanded_numbers AS (
        SELECT 
          d.id,
          d.draw_date,
          num,
          num = ANY(d.winning_numbers) AS is_winning,
          num = ANY(d.machine_numbers) AS is_machine
        FROM draw_data d
        CROSS JOIN LATERAL unnest(d.winning_numbers || d.machine_numbers) AS num
      ),
      number_triplets AS (
        SELECT DISTINCT
          e1.id,
          e1.draw_date,
          LEAST(e1.num, e2.num, e3.num) AS num1,
          e1.num + e2.num + e3.num - LEAST(e1.num, e2.num, e3.num) - GREATEST(e1.num, e2.num, e3.num) AS num2,
          GREATEST(e1.num, e2.num, e3.num) AS num3,
          CASE WHEN e1.is_winning OR e2.is_winning OR e3.is_winning THEN 1 ELSE 0 END AS in_winning,
          CASE WHEN e1.is_machine OR e2.is_machine OR e3.is_machine THEN 1 ELSE 0 END AS in_machine
        FROM expanded_numbers e1
        JOIN expanded_numbers e2 ON e1.id = e2.id AND e1.num < e2.num
        JOIN expanded_numbers e3 ON e1.id = e3.id AND e2.id = e3.id AND e2.num < e3.num
        WHERE e1.num BETWEEN 1 AND 90 AND e2.num BETWEEN 1 AND 90 AND e3.num BETWEEN 1 AND 90
      )
      INSERT INTO number_cooccurrence (number1, number2, number3, count, winning_count, machine_count, last_seen)
      SELECT 
        num1,
        num2,
        num3,
        COUNT(DISTINCT id) AS count,
        COUNT(DISTINCT CASE WHEN in_winning > 0 THEN id END) AS winning_count,
        COUNT(DISTINCT CASE WHEN in_machine > 0 THEN id END) AS machine_count,
        MAX(draw_date) AS last_seen
      FROM number_triplets
      GROUP BY num1, num2, num3
      ON CONFLICT (number1, number2, number3) 
      DO UPDATE SET
        count = EXCLUDED.count,
        winning_count = EXCLUDED.winning_count,
        machine_count = EXCLUDED.machine_count,
        last_seen = EXCLUDED.last_seen
    `;

    await pool.query(query, params);
  }

  // Calculate pairs on the fly (for fallback when triplets are insufficient)
  async getCoOccurrencePairs(
    limit: number = 50,
    minCount: number = 1,
    days?: number,
    lottoType?: string
  ): Promise<CoOccurrencePair[]> {
    // Build WHERE clause
    let whereClause = '';
    const params: unknown[] = [];
    let paramIndex = 1;

    if (days || lottoType) {
      const conditions: string[] = [];
      if (days) {
        conditions.push(`draw_date >= CURRENT_DATE - INTERVAL '${days} days'`);
      }
      if (lottoType) {
        conditions.push(`lotto_type = $${paramIndex}`);
        params.push(lottoType);
        paramIndex++;
      }
      whereClause = 'WHERE ' + conditions.join(' AND ');
    }

    // Calculate pairs dynamically from draws
    const query = `
      WITH draw_data AS (
        SELECT 
          id,
          draw_date,
          winning_numbers,
          machine_numbers
        FROM draws
        ${whereClause}
      ),
      expanded_numbers AS (
        SELECT 
          d.id,
          d.draw_date,
          num,
          num = ANY(d.winning_numbers) AS is_winning,
          num = ANY(d.machine_numbers) AS is_machine
        FROM draw_data d
        CROSS JOIN LATERAL unnest(d.winning_numbers || d.machine_numbers) AS num
      ),
      number_pairs AS (
        SELECT DISTINCT
          e1.id,
          e1.draw_date,
          LEAST(e1.num, e2.num) AS num1,
          GREATEST(e1.num, e2.num) AS num2,
          CASE WHEN e1.is_winning OR e2.is_winning THEN 1 ELSE 0 END AS in_winning,
          CASE WHEN e1.is_machine OR e2.is_machine THEN 1 ELSE 0 END AS in_machine
        FROM expanded_numbers e1
        JOIN expanded_numbers e2 ON e1.id = e2.id AND e1.num < e2.num
        WHERE e1.num BETWEEN 1 AND 90 AND e2.num BETWEEN 1 AND 90
      )
      SELECT 
        num1 AS number1,
        num2 AS number2,
        COUNT(DISTINCT id) AS count,
        COUNT(DISTINCT CASE WHEN in_winning > 0 THEN id END) AS winning_count,
        COUNT(DISTINCT CASE WHEN in_machine > 0 THEN id END) AS machine_count,
        MAX(draw_date) AS last_seen
      FROM number_pairs
      GROUP BY num1, num2
      HAVING COUNT(DISTINCT id) >= $${paramIndex}
      ORDER BY 
        CASE WHEN winning_count > 0 AND machine_count = 0 THEN 0 ELSE 1 END, -- Prioritize winning-only
        count DESC, 
        num1 ASC, 
        num2 ASC
      LIMIT $${paramIndex + 1}
    `;

    params.push(minCount);
    params.push(limit);

    const result = await pool.query(query, params);
    return result.rows.map((row) => ({
      number1: parseInt(row.number1, 10),
      number2: parseInt(row.number2, 10),
      count: parseInt(row.count, 10),
      winningCount: parseInt(row.winning_count, 10),
      machineCount: parseInt(row.machine_count, 10),
      lastSeen: row.last_seen,
    }));
  }

  // Get all draw dates where a specific co-occurrence pair/triplet appeared
  async getCoOccurrenceDrawDates(
    number1: number,
    number2: number,
    number3?: number,
    days?: number,
    lottoType?: string
  ): Promise<string[]> {
    let whereClause = '';
    const params: unknown[] = [number1, number2];
    let paramIndex = 3;

    if (days || lottoType) {
      const conditions: string[] = [];
      if (days) {
        conditions.push(`draw_date >= CURRENT_DATE - INTERVAL '${days} days'`);
      }
      if (lottoType) {
        conditions.push(`lotto_type = $${paramIndex}`);
        params.push(lottoType);
        paramIndex++;
      }
      whereClause = 'AND ' + conditions.join(' AND ');
    }

    if (number3 !== undefined) {
      // Triplet query
      const query = `
        SELECT DISTINCT draw_date
        FROM draws
        WHERE $1 = ANY(winning_numbers || machine_numbers)
          AND $2 = ANY(winning_numbers || machine_numbers)
          AND $${paramIndex} = ANY(winning_numbers || machine_numbers)
          ${whereClause}
        ORDER BY draw_date DESC
      `;
      params.push(number3);
      paramIndex++;
      const result = await pool.query(query, params);
      return result.rows.map((row) => row.draw_date);
    } else {
      // Pair query
      const query = `
        SELECT DISTINCT draw_date
        FROM draws
        WHERE $1 = ANY(winning_numbers || machine_numbers)
          AND $2 = ANY(winning_numbers || machine_numbers)
          ${whereClause}
        ORDER BY draw_date DESC
      `;
      const result = await pool.query(query, params);
      return result.rows.map((row) => row.draw_date);
    }
  }

  // Get co-occurrence triplets with fallback to pairs if insufficient
  async getCoOccurrenceTriplets(
    limit: number = 50,
    minCount: number = 1,
    days?: number,
    lottoType?: string
  ): Promise<CoOccurrenceTriplet[]> {
    // Check if we have data, if not or if filtering, calculate it
    const checkQuery = 'SELECT COUNT(*) as count FROM number_cooccurrence';
    const checkResult = await pool.query(checkQuery);
    const existingCount = parseInt(checkResult.rows[0]?.count || '0', 10);

    // If no data exists or we're filtering, calculate/update
    if (existingCount === 0 || days || lottoType) {
      await this.updateCoOccurrenceTriplets(days, lottoType);
    }

    let query = `
      SELECT 
        number1,
        number2,
        number3,
        count,
        winning_count,
        machine_count,
        last_seen
      FROM number_cooccurrence
      WHERE count >= $1
    `;

    const params: unknown[] = [minCount];

    if (days) {
      query += ` AND last_seen >= CURRENT_DATE - INTERVAL '${days} days'`;
    }

    query += ` ORDER BY 
      CASE WHEN winning_count > 0 AND machine_count = 0 THEN 0 ELSE 1 END,
      count DESC, 
      number1 ASC, 
      number2 ASC, 
      number3 ASC 
      LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await pool.query(query, params);
    return result.rows.map((row) => ({
      number1: parseInt(row.number1, 10),
      number2: parseInt(row.number2, 10),
      number3: parseInt(row.number3, 10),
      count: parseInt(row.count, 10),
      winningCount: parseInt(row.winning_count, 10),
      machineCount: parseInt(row.machine_count, 10),
      lastSeen: row.last_seen,
    }));
  }

  // Get co-occurrence data (triplets with fallback to pairs)
  async getCoOccurrenceData(
    limit: number = 50,
    minCount: number = 1,
    days?: number,
    lottoType?: string,
    minTriplets: number = 10 // Minimum number of triplets before falling back to pairs
  ): Promise<CoOccurrenceData[]> {
    // First, try to get triplets
    const triplets = await this.getCoOccurrenceTriplets(limit, minCount, days, lottoType);

    // If we have enough triplets, return them
    if (triplets.length >= minTriplets) {
      return triplets.map(t => ({ ...t, type: 'triplet' as const }));
    }

    // If we don't have enough triplets, get pairs as fallback
    const pairs = await this.getCoOccurrencePairs(limit, minCount, days, lottoType);
    
    // Combine triplets (if any) with pairs
    const result: CoOccurrenceData[] = [
      ...triplets.map(t => ({ ...t, type: 'triplet' as const })),
      ...pairs.map(p => ({ ...p, type: 'pair' as const }))
    ];

    // Sort by count descending and limit
    return result
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  // Get co-occurrence triplets for a specific number
  async getCoOccurrenceForNumber(
    number: number,
    limit: number = 20,
    days?: number
  ): Promise<CoOccurrenceTriplet[]> {
    let query = `
      SELECT 
        number1,
        number2,
        number3,
        count,
        winning_count,
        machine_count,
        last_seen
      FROM number_cooccurrence
      WHERE (number1 = $1 OR number2 = $1 OR number3 = $1)
    `;

    const params: unknown[] = [number];

    if (days) {
      query += ` AND last_seen >= CURRENT_DATE - INTERVAL '${days} days'`;
    }

    query += ` ORDER BY count DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await pool.query(query, params);
    return result.rows.map((row) => ({
      number1: parseInt(row.number1, 10),
      number2: parseInt(row.number2, 10),
      number3: parseInt(row.number3, 10),
      count: parseInt(row.count, 10),
      winningCount: parseInt(row.winning_count, 10),
      machineCount: parseInt(row.machine_count, 10),
      lastSeen: row.last_seen,
    }));
  }
}

export const analyticsService = new AnalyticsService();

