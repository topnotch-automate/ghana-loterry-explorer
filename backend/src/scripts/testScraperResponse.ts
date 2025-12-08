#!/usr/bin/env tsx
/**
 * Test script to inspect the actual HTML response from theb2b.com
 * This helps diagnose anti-bot protection or HTML structure issues
 * 
 * Usage:
 *   tsx src/scripts/testScraperResponse.ts [page]
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { writeFileSync } from 'fs';
import { join } from 'path';

const baseUrl = 'https://www.theb2blotto.com/ajax/get_latest_results.php';
const page = process.argv[2] ? parseInt(process.argv[2], 10) : 1;

async function testResponse() {
  const url = `${baseUrl}?pn=${page}`;
  console.log(`\n🔍 Testing URL: ${url}\n`);

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Referer': 'https://www.theb2blotto.com/',
        'Origin': 'https://www.theb2blotto.com',
      },
      timeout: 30000,
      validateStatus: () => true, // Don't throw on any status
    });

    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`Content-Type: ${response.headers['content-type']}`);
    console.log(`Content-Length: ${response.headers['content-length'] || 'unknown'}`);
    console.log(`Response size: ${String(response.data).length} characters\n`);

    const html = String(response.data);
    
    // Check for anti-bot indicators
    const antiBotIndicators = [
      'captcha',
      'robot',
      'blocked',
      'access denied',
      'cloudflare',
      'challenge',
      'verify you are human',
    ];
    
    const foundIndicators = antiBotIndicators.filter(indicator => 
      html.toLowerCase().includes(indicator)
    );
    
    if (foundIndicators.length > 0) {
      console.log(`⚠️  ANTI-BOT PROTECTION DETECTED:`);
      foundIndicators.forEach(indicator => console.log(`   - Found: "${indicator}"`));
      console.log('');
    }

    // Check HTML structure
    console.log('📊 HTML Structure Analysis:');
    console.log(`   Contains '<table': ${html.includes('<table')}`);
    console.log(`   Contains '<tbody': ${html.includes('<tbody')}`);
    console.log(`   Contains 'latestResults': ${html.includes('latestResults')}`);
    console.log(`   Contains '<tr': ${html.includes('<tr')}`);
    console.log(`   Contains '<td': ${html.includes('<td')}`);
    console.log(`   Contains 'span.name': ${html.includes('span class="name"') || html.includes("span class='name'")}`);
    console.log(`   Contains 'lottery-number-list': ${html.includes('lottery-number-list')}`);
    console.log('');

    // Parse with cheerio
    const $ = cheerio.load(html);
    const latestResultsRows = $('#latestResults tr').toArray();
    const allRows = $('tr').toArray();
    const tableRows = $('table tr').toArray();

    console.log('🔍 Cheerio Parsing Results:');
    console.log(`   #latestResults tr: ${latestResultsRows.length} row(s)`);
    console.log(`   table tr: ${tableRows.length} row(s)`);
    console.log(`   All tr: ${allRows.length} row(s)`);
    console.log('');

    // Show first few rows structure
    if (latestResultsRows.length > 0) {
      console.log('✅ Found rows in #latestResults:');
      latestResultsRows.slice(0, 3).forEach((row, idx) => {
        const $row = $(row);
        const cols = $row.find('td');
        const nameSpan = $(cols[0]).find('span.name');
        const dateSpan = $(cols[1]).find('span');
        console.log(`   Row ${idx + 1}: ${cols.length} columns`);
        console.log(`     - Lotto Type: ${nameSpan.text().trim() || 'NOT FOUND'}`);
        console.log(`     - Date: ${dateSpan.text().trim() || 'NOT FOUND'}`);
      });
    } else if (allRows.length > 0) {
      console.log('⚠️  Found rows but not in #latestResults:');
      allRows.slice(0, 3).forEach((row, idx) => {
        const $row = $(row);
        const cols = $row.find('td');
        console.log(`   Row ${idx + 1}: ${cols.length} columns`);
        if (cols.length > 0) {
          console.log(`     - First column text: ${$(cols[0]).text().trim().substring(0, 50)}`);
        }
      });
    }

    // Save HTML to file for inspection
    const outputFile = join(process.cwd(), 'logs', `test-response-page-${page}.html`);
    writeFileSync(outputFile, html, 'utf-8');
    console.log(`\n💾 Full HTML saved to: ${outputFile}`);
    console.log(`\n📄 First 1000 characters of response:\n${html.substring(0, 1000)}\n`);

  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('❌ Request failed:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: error.config?.url,
      });
      if (error.response?.data) {
        console.error('Response data:', String(error.response.data).substring(0, 500));
      }
    } else {
      console.error('❌ Error:', error);
    }
    process.exit(1);
  }
}

testResponse()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

