const puppeteer = require("puppeteer");

class Show {
  constructor(name) {
    this.showName = name;
    this.seasons = [];
  }

  getName() {
    return this.showName;
  }

  getId() {
    return this.id;
  }

  setId(titleID) {
    this.id = titleID;
  }

  getAvgRating() {
    return this.avgRating;
  }

  setAvgRating(rating) {
    this.avgRating = rating;
  }

  addSeason(season) {
    this.seasons.push(season);
  }

  getSeasons() {
    return this.seasons;
  }

  setNumOfEpisodes(episodes) {
    this.nEpisodes = episodes;
  }

  getNumOfEpisodes() {
    return this.nEpisodes;
  }
}

const dataSetSize = 20;
let shows = new Array(dataSetSize);

const readline = require('readline');

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }))
}

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  const searchQuery = await askQuestion("Please enter a TV Series: ");

  await page.goto(`https://www.imdb.com/search/title/?title=${searchQuery}&title_type=tv_series,tv_miniseries&sort=num_votes,desc`); // search for TV show
  const numOfResults = await page.evaluate(() => {
    let results = String(document.querySelector('.desc > span:nth-child(1)').textContent);
    return results;
  })
  if (numOfResults === 'No results.') {
    console.log("No results found from search.");
    process.exit(); // No results found from search, so exit the script.
  }
  const searchTitleName = await page.evaluate(() => {
    let name = String(document.querySelector('div.lister-item:nth-child(1) > div:nth-child(3) > h3:nth-child(1) > a:nth-child(2)').textContent);
    return name;
  })
  const searchTitleYear = await page.evaluate(() => {
    let year = String(document.querySelector('div.lister-item:nth-child(1) > div:nth-child(3) > h3:nth-child(1) > span:nth-child(3)').textContent);
    return year;
  })
  console.log('TV Series Found: ' + searchTitleName + ' ' + searchTitleYear); // Display title name and year found

  const genres = await page.evaluate(() => {
    let genreString = String(document.querySelector('div.lister-item:nth-child(1) > div:nth-child(3) > p:nth-child(2) > span:nth-child(3)').textContent);
    console.log(genreString)
    if (!genreString.includes(",")) { // genres will include a comma between each one
      genreString = String(document.querySelector('div.lister-item:nth-child(1) > div:nth-child(3) > p:nth-child(2) > span:nth-child(5)').textContent);
    }
    genreString = genreString.replace(/\s+/g, ''); // removes spacing from the string 
    return genreString;
  })

  console.log(`\nFinding ${dataSetSize} recommended shows.`);
  const predictedTime = (18 * dataSetSize) / 60; // average time to process a shows is 18 seconds
  console.log("Please wait " + Math.round(predictedTime) + " minutes...\n");

  for (resultNum = 1; resultNum <= dataSetSize; resultNum++) { // loops through the top N results
    await page.goto(`https://www.imdb.com/search/title/?title_type=tv_series,tv_miniseries&release_date=2000-01-01,&user_rating=7.5,&genres=${genres}&sort=num_votes,desc&count=${dataSetSize}`);
    // the most popular shows from the 21st century with an IMDB rating of at least 7.5 in the same genres as the search
    const queryName = `div.lister-item:nth-child(${resultNum}) > div:nth-child(3) > h3:nth-child(1) > a:nth-child(2)`;
    const queryYear = `div.lister-item:nth-child(${resultNum}) > div:nth-child(3) > h3:nth-child(1) > span:nth-child(3)`;
    const queryID = `div.lister-item:nth-child(${resultNum}) > div:nth-child(3) > h3:nth-child(1) > a:nth-child(2)`;
    let titleName = await page.evaluate((queryName) => {
      let name = String(document.querySelector(queryName).textContent);
      return name;
    }, queryName)
    let titleYear = await page.evaluate((queryYear) => {
      let year = String(document.querySelector(queryYear).textContent);
      return year;
    }, queryYear)
    let showName = titleName + " " + titleYear;
    let newShow = new Show(showName); // TV show object created 
    console.log(showName);
    let titleID = await page.evaluate((queryID) => { // Title ID is used to visit the IMDB page of the show
      let address = String(document.querySelector(queryID).href);
      let attributes = address.split('/');
      return attributes[4];
    }, queryID)
    newShow.setId(titleID);
    await page.goto(`https://www.imdb.com/title/${titleID}/`);
    const numSeasons = await page.evaluate(() => {
      let seasons = Number(document.querySelector('#title-episode-widget > div > div:nth-child(4) > a:nth-child(1)').textContent);
      return seasons;
    })

    let totalEpisodes = 0;
    let totalScore = 0;
    for (i = 1; i <= numSeasons; i++) { // Loop through each season of the show
      await page.goto(
        `https://www.imdb.com/title/${titleID}/episodes?season=${i}`,
        { waitUntil: "networkidle2" }
      );
      // scraping logic
      let seasonData = await page.evaluate(() => {
        // get number of elements
        let x = Array.from(
          document.querySelectorAll(
            '#episodes_content > div.clear > div.list.detail.eplist > [class*="list_item"]'
          )
        );
        // episode number
        let episode = [];
        for (ep = 1; ep <= x.length; ep++) {
          episode.push(ep);
        }

        // rating
        tmp = Array.from(
          document.querySelectorAll(
            '#episodes_content > div.clear > div.list.detail.eplist > [class*="list_item"] > div.info > div.ipl-rating-widget > div.ipl-rating-star.small > span.ipl-rating-star__rating'
          )
        );
        let rating = [];
        for (each of tmp) {
          if (rating !== undefined) {
            rating.push(each.innerText);
          }
        }

        let epRatingTotal = 0;
        let info = {};
        let max = 0;
        let min = 10;
        let numOfEpisodes = 0;
        for (ep of episode) { // Loop through each episode of the season
          let strRating = rating[ep - 1];
          if (!isNaN(strRating)) { // make sure the rating captured is a number
            numOfEpisodes++;
            epRating = Number(strRating);
            if (epRating > max) { // store maximum episode rating 
              max = epRating;
            }
            if (epRating < min) { // store minimum episode rating 
              min = epRating;
            }
            epRatingTotal += epRating; // keeps tally of episode ratings
          }
        }
        if (epRatingTotal > 0) { // Ignore empty seasons from IMDB
          info.avg_rating = epRatingTotal / numOfEpisodes;
          info.min_rating = min;
          info.max_rating = max;
          info.nEpisodes = numOfEpisodes;
          info.totalRating = epRatingTotal;
        }
        return info; // All the season info is stored in the object seasonData;
      });
      if (!isNaN(seasonData.nEpisodes) && !isNaN(seasonData.totalRating)) {
        totalEpisodes += seasonData.nEpisodes; // keeps tally of number of episodes across the show
        totalScore += seasonData.totalRating; // keeps tally of episode rating across seasons
      }
      console.log("Season " + i + "...");
      newShow.addSeason(seasonData); // add season data to the show object
    }
    let avgOverallRating = totalScore / totalEpisodes; // mean episode rating for tv show
    if (isNaN(avgOverallRating)) { // make sure the average rating calculated is a number
      avgOverallRating = 0;
    }
    newShow.setAvgRating(avgOverallRating);
    shows[resultNum - 1] = newShow; // add show to the array of shows
    console.log(newShow.getName() + " Completed.\n");
  }

  console.log("Ranking the best shows...\n");

  // Bubble sort algorithm to rank the shows via the average episode rating
  var swapp;
  var n = shows.length - 1;
  do {
    swapp = false;
    for (var i = 0; i < n; i++) {
      let show1 = shows[i];
      let show2 = shows[i + 1];
      if (show1.getAvgRating() < show2.getAvgRating()) {
        var temp = shows[i];
        shows[i] = shows[i + 1];
        shows[i + 1] = temp;
        swapp = true;
      }
    }
    n--;
  } while (swapp);

  n = shows.length;
  for (var i = 0; i < n; i++) {
    console.log(i + 1 + ". " + shows[i].getName() + ": " + shows[i].getAvgRating().toFixed(2)); // Display ranked shows
  }

  await browser.close();
})();