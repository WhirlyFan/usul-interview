const { chromium } = require("playwright");
const fs = require("fs").promises;

async function scrapeSOFWeekSpeakers() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    let retryCount = 0;
    const maxRetries = 3;
    let iframe = null;

    // Retry loop in case "No sessions found" appears
    while (retryCount < maxRetries) {
      console.log(`\n${"=".repeat(60)}`);
      console.log(`Attempt ${retryCount + 1}/${maxRetries}`);
      console.log("=".repeat(60));

      console.log("Navigating to SOF Week agenda page...");
      await page.goto("https://sofweek.org/agenda/", {
        waitUntil: "networkidle",
      });

      // Scroll halfway down the main page to load the iframe
      console.log("Scrolling halfway down page to load iframe...");
      await page.evaluate(() =>
        window.scrollTo(0, document.body.scrollHeight / 2)
      );
      await page.waitForTimeout(2000);

      // Wait for the iframe to load
      console.log("Waiting for iframe to load...");
      await page.waitForSelector("iframe.cvt-embed", { timeout: 30000 });
      await page.waitForTimeout(2000);

      // Get the iframe
      const iframeElement = await page
        .locator("iframe.cvt-embed")
        .elementHandle();
      iframe = await iframeElement.contentFrame();

      if (!iframe) {
        throw new Error("Could not access iframe content");
      }

      console.log("Iframe loaded successfully");

      // Check if "No sessions found" message appears
      const noSessionsText = await iframe.evaluate(() => {
        return document.body.textContent.includes("No sessions found");
      });

      if (noSessionsText) {
        console.log("⚠️  'No sessions found' detected. Reloading page...");
        retryCount++;
        await page.waitForTimeout(2000);
        continue;
      }

      // Wait for session tiles to load
      console.log("Waiting for session tiles to load...");
      try {
        await iframe.waitForSelector(
          '[data-cvent-id="agenda-v2-widget-session-tile-card"]',
          { timeout: 30000 }
        );
        // Success! Break out of retry loop
        console.log("✓ Session tiles loaded successfully");
        break;
      } catch (error) {
        console.log("⚠️  Session tiles failed to load. Reloading page...");
        retryCount++;
        await page.waitForTimeout(2000);
        if (retryCount >= maxRetries) {
          throw new Error(
            `Failed to load session tiles after ${maxRetries} attempts`
          );
        }
        continue;
      }
    }

    if (!iframe) {
      throw new Error("Failed to access iframe after retries");
    }

    const speakers = [];
    const processedSpeakers = new Set(); // Track unique speakers by name

    // Scroll incrementally and process tiles as we go
    console.log("Scrolling iframe and processing tiles incrementally...");
    let scrollPosition = 0;
    let previousTileCount = 0;
    let noNewTilesCount = 0;
    const maxNoNewTiles = 3; // Stop after 3 scrolls with no new tiles

    while (noNewTilesCount < maxNoNewTiles) {
      // Scroll down incrementally
      scrollPosition += 800;
      await iframe.evaluate((pos) => window.scrollTo(0, pos), scrollPosition);
      await page.waitForTimeout(2000);

      // Get current tiles count
      const currentTileCount = await iframe
        .locator('[data-cvent-id="agenda-v2-widget-session-tile-card"]')
        .count();
      console.log(
        `\nScroll position: ${scrollPosition}, Tiles loaded: ${currentTileCount}`
      );

      if (currentTileCount === previousTileCount) {
        noNewTilesCount++;
        console.log(`No new tiles (${noNewTilesCount}/${maxNoNewTiles})`);
      } else {
        noNewTilesCount = 0;
      }

      // Get all tiles currently loaded
      const sessionTiles = await iframe
        .locator('[data-cvent-id="agenda-v2-widget-session-tile-card"]')
        .all();

      // Process only the newly loaded tiles
      for (let i = previousTileCount; i < currentTileCount; i++) {
        console.log(
          `\nProcessing session tile ${i + 1}/${currentTileCount}...`
        );

        const tile = sessionTiles[i];
        await page.waitForTimeout(300);

        // Check if this tile has a speaker carousel
        const speakerCarousel = tile.locator(
          '[data-cvent-id="speaker-carousel"]'
        );
        const carouselExists = (await speakerCarousel.count()) > 0;

        if (!carouselExists) {
          console.log("  No speaker carousel found in this tile");
          continue;
        }

        // Check if carousel has speaker cards
        const speakerCards = await speakerCarousel
          .locator('[data-cvent-id="speaker-card-speaker-profile-image"]')
          .all();

        if (speakerCards.length === 0) {
          console.log("  Speaker carousel is empty");
          continue;
        }

        console.log(
          `  Found ${speakerCards.length} speaker card(s) initially visible`
        );

        // Process speakers in the carousel
        let carouselPageIndex = 0;
        let processedInCarousel = 0;
        const maxCarouselPages = 50; // Safety limit to prevent infinite loops

        while (carouselPageIndex < maxCarouselPages) {
          // Get all speaker cards visible on the current carousel page
          const currentSpeakerCards = await speakerCarousel
            .locator('[data-cvent-id="speaker-card-speaker-profile-image"]')
            .all();

          if (currentSpeakerCards.length === 0) {
            console.log("  No more speaker cards visible");
            break;
          }

          console.log(
            `  Processing ${
              currentSpeakerCards.length
            } speaker(s) on carousel page ${carouselPageIndex + 1}`
          );

          // Process ALL speakers on the current page before clicking right arrow
          for (
            let cardIndex = 0;
            cardIndex < currentSpeakerCards.length;
            cardIndex++
          ) {
            try {
              // Re-query the cards in case DOM changed
              const speakerCardsRefresh = await speakerCarousel
                .locator('[data-cvent-id="speaker-card-speaker-profile-image"]')
                .all();

              if (cardIndex >= speakerCardsRefresh.length) {
                console.log(`  Card ${cardIndex + 1} no longer available`);
                break;
              }

              const speakerCard = speakerCardsRefresh[cardIndex];

              // Click the speaker card
              await speakerCard.click({ timeout: 5000 });
              await page.waitForTimeout(1000);

              // Wait for modal to appear
              const modal = iframe.locator(
                '[data-cvent-id="speaker-detail-modal"]'
              );
              await modal.waitFor({ state: "visible", timeout: 5000 });

              // Extract speaker information
              const speakerData = await iframe.evaluate(() => {
                const modal = document.querySelector(
                  '[data-cvent-id="speaker-detail-modal"]'
                );
                if (!modal) return null;

                const nameEl = modal.querySelector(
                  '[data-cvent-id="speaker-name"]'
                );
                const titleEl = modal.querySelector(
                  '[data-cvent-id="speaker-card-speaker-info-speaker-title"]'
                );
                const companyEl = modal.querySelector(
                  '[data-cvent-id="speaker-card-speaker-info-speaker-company"]'
                );

                // Get bio - it has both classes
                let bio = "";
                const bioDiv = modal.querySelector(
                  ".AgendaV2Styles__speakerModalBio___142a.css-87ndg2"
                );
                if (bioDiv) {
                  bio = bioDiv.textContent.trim();
                }

                return {
                  name: nameEl ? nameEl.textContent.trim() : "",
                  title: titleEl ? titleEl.textContent.trim() : "",
                  company: companyEl ? companyEl.textContent.trim() : "",
                  bio: bio,
                };
              });

              if (speakerData && speakerData.name) {
                // Check if we've already processed this speaker
                if (!processedSpeakers.has(speakerData.name)) {
                  console.log(
                    `  ✓ Scraped [${cardIndex + 1}/${
                      currentSpeakerCards.length
                    }]: ${speakerData.name}`
                  );
                  speakers.push(speakerData);
                  processedSpeakers.add(speakerData.name);
                  processedInCarousel++;
                } else {
                  console.log(
                    `  - Already scraped [${cardIndex + 1}/${
                      currentSpeakerCards.length
                    }]: ${speakerData.name}`
                  );
                }
              }

              // Close the modal
              const closeButton = iframe.locator('[data-cvent-id="close"]');
              await closeButton.click();
              await page.waitForTimeout(500);
            } catch (error) {
              console.log(
                `  Error processing speaker ${cardIndex + 1}: ${error.message}`
              );

              // Try to close modal if it's open
              try {
                const closeButton = iframe.locator('[data-cvent-id="close"]');
                if ((await closeButton.count()) > 0) {
                  await closeButton.click();
                  await page.waitForTimeout(500);
                }
              } catch (e) {
                // Ignore
              }
            }
          }

          // After processing all speakers on this page, check for right arrow
          const rightButton = await speakerCarousel
            .locator(
              ".AgendaV2Styles__carouselButton___142a.AgendaV2Styles__carouselRight___142a"
            )
            .count();

          if (rightButton > 0) {
            console.log("  → Clicking right arrow to next carousel page");
            await speakerCarousel
              .locator(
                ".AgendaV2Styles__carouselButton___142a.AgendaV2Styles__carouselRight___142a"
              )
              .click();
            await page.waitForTimeout(1000);
            carouselPageIndex++;
          } else {
            console.log("  No more carousel pages (no right arrow)");
            break;
          }
        }

        console.log(
          `  Processed ${processedInCarousel} speaker(s) from this carousel`
        );
      }

      previousTileCount = currentTileCount;

      // Check if we've reached the bottom
      const isAtBottom = await iframe.evaluate(() => {
        return (
          window.innerHeight + window.scrollY >=
          document.body.scrollHeight - 100
        );
      });

      if (isAtBottom) {
        console.log("\nReached bottom of iframe");
        break;
      }
    }

    // Save to JSON file
    console.log(`\n\nTotal unique speakers scraped: ${speakers.length}`);
    console.log("Saving to speakers.json...");

    await fs.writeFile(
      "speakers.json",
      JSON.stringify(speakers, null, 2),
      "utf-8"
    );

    console.log("✓ Successfully saved speakers.json");
    console.log(`\nSample speakers:`);
    speakers.slice(0, 3).forEach((s) => {
      console.log(`  - ${s.name} (${s.company})`);
    });
  } catch (error) {
    console.error("Error during scraping:", error);
  } finally {
    await browser.close();
  }
}

// Run the scraper
scrapeSOFWeekSpeakers();
