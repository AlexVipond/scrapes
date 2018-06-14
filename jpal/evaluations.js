const puppeteer = require('puppeteer');
const fs = require('fs');

async function scrapePages() {
  const browser = await puppeteer.launch({headless: false});
  const page = await browser.newPage();

  await page.goto('https://www.povertyactionlab.org/evaluations?page=0')
  let pageTotal = await page.evaluate(num => {
    num += Number(document.querySelector('#views-record-count-text').textContent.split(' ')[0]);
    return Math.ceil(num / 6);
  }, 0)

  // TODO: get sector profiles
  // let sectors = page.evaluate(sectors => {
  //
  // }, []);

  let data = await page.evaluate(data => {
    let evaluations = [];
        authors = [];

    let nodes = document.querySelectorAll('.clearfix.thumb');
    nodes.forEach(node => {
      let label = node.querySelector('h3 a'),
          image = node.querySelector('img'),
          tags = node.querySelectorAll('h4 a'),
          profiledAuthors = node.querySelectorAll('.views-field-field-researchers a'),
          unprofiledAuthors = node.querySelectorAll('.views-field-field-researchers .views-field-php span'),
          description = node.querySelector('p:first-of-type');

      let element = {
        'label': label.textContent,
        'type': 'Article',
        'description': description.textContent,
        'sectors': [],
        'authors': [],
        'link': label.href,
        'image': image.src
      };

      tags.forEach(tag => {
        element.sectors.push(tag.textContent);
      });
      element.sectors = element.sectors.sort();
      profiledAuthors.forEach(node => {
        element.authors.push(node.textContent);
        let obj = {
          'label': node.textContent,
          'link': node.href
        };
        if(authors.findIndex(author => author.link === obj.link) === -1) {
          authors.push(obj);
        }
      });
      unprofiledAuthors.forEach(node => {
        element.authors.push(node.textContent);
      });

      evaluations.push(element);
    });

    data.evaluations = evaluations;
    data.authors = authors;
    return data;
  }, {});

  let log = data.evaluations;

  fs.writeFile('jpal.json', JSON.stringify(log, null, 2), (err) => {
    if (err) throw err;
    console.log('yay');
  });

  await browser.close();
}

scrapePages();
