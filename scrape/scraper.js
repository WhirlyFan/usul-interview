import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

/**
 * Scraper for https://sofweek.org/agenda/ using Playwright
 * Extracts speaker names, titles, companies, and bios
 */
async function scrapeSofWeekAgenda() {
  let browser;

  try {
    console.log('Launching browser...');

    // Launch browser in headless mode (suitable for WSL/headless environment)
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });

    console.log('✓ Browser launched');

    // Create a new page
    const page = await browser.newPage();

    // Set viewport for consistent rendering
    await page.setViewportSize({ width: 1920, height: 1080 });

    console.log('\nNavigating to https://sofweek.org/agenda/ ...');

    // Navigate to the URL and wait for the page to be fully loaded
    const response = await page.goto('https://sofweek.org/agenda/', {
      waitUntil: 'load',
      timeout: 60000
    });

    // Check connection status
    if (!response) {
      throw new Error('Failed to get response from the page');
    }

    const status = response.status();
    console.log(`✓ Connection successful! Status: ${status}`);

    // Wait for the complete page load including all resources
    await page.waitForLoadState('load');
    console.log('✓ Page fully loaded');

    // Wait for network to be completely idle
    await page.waitForLoadState('networkidle');
    console.log('✓ Network idle');

    // Wait for the Cvent embed iframe to appear
    console.log('\nWaiting for Cvent embed iframe...');
    await page.waitForSelector('iframe.cvt-embed', { timeout: 30000 });
    console.log('✓ Cvent embed iframe found');

    // Get the Cvent iframe
    console.log('Finding Cvent iframe...');
    let cventFrame = null;
    const frames = page.frames();
    for (const frame of frames) {
      if (frame.url().includes('cvent')) {
        cventFrame = frame;
        console.log(`✓ Using Cvent iframe: ${frame.url()}`);
        break;
      }
    }

    if (!cventFrame) {
      throw new Error('Cvent iframe not found');
    }

        // Wait for the agenda list container to load in the iframe (indicates data is loaded)
    console.log('Waiting for agenda data to load in iframe...');
    await cventFrame.waitForSelector('[data-cvent-id="agenda-v2-widget-list-container"]', { timeout: 30000 });
    console.log('✓ Agenda data loaded');

    // Give extra time for dynamic content to render
    console.log('Waiting for dynamic content to render...');
    await page.waitForTimeout(5000);

    // Scroll within the iframe to load lazy content
    console.log('Scrolling iframe to load all content...');
    await cventFrame.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(3000);
    await cventFrame.evaluate(() => {
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(3000);

    console.log('\nExtracting speaker information...');

    // Find all clickable speaker profile buttons (parent of the images)
    const speakerButtons = await cventFrame.locator('[data-cvent-id="speaker-card-speaker-profile-image"]').all();
    console.log(`✓ Ready to process ${speakerButtons.length} speaker profiles`);    const speakers = [];

    // Click each speaker button to open modal and extract data
    for (let i = 0; i < speakerButtons.length; i++) {
      try {
        console.log(`\nProcessing speaker ${i + 1}/${speakerButtons.length}...`);

        // Click the speaker button to open modal
        await speakerButtons[i].click();

        // Wait for the modal to appear in the iframe
        await cventFrame.waitForSelector('[data-cvent-id="speaker-detail-modal"]', { timeout: 5000 });
        console.log('  ✓ Modal opened');

        // Extract speaker data from the modal in the iframe
        const speakerData = await cventFrame.evaluate(() => {
          const modal = document.querySelector('[data-cvent-id="speaker-detail-modal"]');
          if (!modal) return null;

          // Extract name
          const nameElement = modal.querySelector('[data-cvent-id="speaker-name"]');
          const name = nameElement ? nameElement.textContent.trim() : null;

          // Extract title
          const titleElement = modal.querySelector('[data-cvent-id="speaker-card-speaker-info-speaker-title"]');
          const title = titleElement ? titleElement.textContent.trim().replace(/\s+/g, ' ').replace(/&nbsp;/g, '').trim() : null;

          // Extract company
          const companyElement = modal.querySelector('[data-cvent-id="speaker-card-speaker-info-speaker-company"]');
          const company = companyElement ? companyElement.textContent.trim().replace(/\s+/g, ' ').replace(/&nbsp;/g, '').trim() : null;

          // Extract bio
          const bioElement = modal.querySelector('.AgendaV2Styles__speakerModalBio___a189');
          const bio = bioElement ? bioElement.textContent.trim() : null;

          return { name, title, company, bio };
        });

        if (speakerData && speakerData.name) {
          speakers.push(speakerData);
          console.log(`  ✓ Extracted: ${speakerData.name}`);
        }

        // Close the modal
        const closeButton = cventFrame.locator('[data-cvent-id="close"]').first();
        await closeButton.click();

        // Wait for modal to close
        await page.waitForTimeout(500);

      } catch (error) {
        console.error(`  ✗ Error processing speaker ${i + 1}:`, error.message);

        // Try to close any open modal
        try {
          const closeButton = cventFrame.locator('[data-cvent-id="close"]').first();
          await closeButton.click({ timeout: 1000 });
          await page.waitForTimeout(500);
        } catch (e) {
          // Modal might already be closed
        }
      }
    }

    console.log(`✓ Found ${speakers.length} speakers`);

    // Display first few speakers as preview
    if (speakers.length > 0) {
      console.log('\n=== Sample Speakers ===');
      speakers.slice(0, 3).forEach((speaker, index) => {
        console.log(`\n${index + 1}. ${speaker.name}`);
        if (speaker.title) console.log(`   Title: ${speaker.title}`);
        if (speaker.company) console.log(`   Company: ${speaker.company}`);
        if (speaker.bio) console.log(`   Bio: ${speaker.bio.substring(0, 100)}...`);
      });
    }

    // Prepare output
    const output = {
      scrapedAt: new Date().toISOString(),
      url: 'https://sofweek.org/agenda/',
      totalSpeakers: speakers.length,
      speakers: speakers
    };

    // Save to JSON file
    const outputFile = 'speakers.json';
    writeFileSync(outputFile, JSON.stringify(output, null, 2), 'utf-8');
    console.log(`\n✓ Speaker data saved to ${outputFile}`);

    // Also save a simplified version with just the speakers array
    writeFileSync('speakers_simple.json', JSON.stringify(speakers, null, 2), 'utf-8');
    console.log(`✓ Simplified data saved to speakers_simple.json`);

    // Optional: Save screenshot for debugging
    await page.screenshot({ path: 'screenshot.png', fullPage: true });
    console.log('✓ Screenshot saved to screenshot.png');

    return {
      success: true,
      speakersCount: speakers.length,
      speakers: speakers
    };

  } catch (error) {
    console.error('\n✗ Error occurred:');
    console.error(`  ${error.message}`);

    if (error.message.includes('net::ERR')) {
      console.error('\n  Network error - Check your internet connection');
    } else if (error.message.includes('Timeout')) {
      console.error('\n  Timeout - Page took too long to load');
    }

    return {
      success: false,
      error: error.message
    };

  } finally {
    // Always close the browser
    if (browser) {
      await browser.close();
      console.log('\n✓ Browser closed');
    }
  }
}

// Run the scraper
scrapeSofWeekAgenda()
  .then((result) => {
    if (result.success) {
      console.log('\n✓ Scraper completed successfully');
      process.exit(0);
    } else {
      console.log('\n✗ Scraper failed');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('\n✗ Unexpected error:', error);
    process.exit(1);
  });
