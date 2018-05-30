const puppeteer = require('puppeteer');
const fs = require('fs');

async function scrapePages() {
  const browser = await puppeteer.launch({headless: false});
  const page = await browser.newPage();

  await page.goto('https://oneacrefund.org/insights-library/');
  let pageTotal = await page.evaluate(num => {
    num += Number(document.querySelector('.pagination__page-total').textContent);
    return num;
  }, 0);

  let countries = await page.evaluate(results => {
    let nodes = document.querySelectorAll('.filters__children__item__link');

    nodes.forEach(node => {
      let country = new Object();
      country.link = node.href;
      country.name = node.querySelector('.filters__children__item__heading').textContent;
      results.push(country);
    });

    results = results.filter(object => /country/.test(object.link) === true);
    return results;
  }, []);

  let insights = [];

  for (i = 0; i < pageTotal; i++) {
    let page2 = await browser.newPage();
    await page2.goto('https://oneacrefund.org/insights-library/?page=' + (i + 1));
    let cards = await page2.evaluate(results => {
      let fields = {
        'label': '.cards__item__heading',
        'element type': '.cards__item__image',
        'description': '.cards__item__description',
        'link': '.cards__item__link'
      };

      let types = {
        'SOCIAL_ENTERPRISE': 'Social Enterprise',
        'AG_INNOVATION': 'Agricultural Innovation',
        'IMPACT': 'Impact',
        'AG_POLICY': 'Agricultural Policy',
        'FAILURES': 'Failures',
        'FARM_FINANCE': "Farm Finance",
      }

      function getLabel(node) {
        return node.querySelector(fields.label).innerHTML;
      }

      function getType(node) {
        return types[
          node.querySelector(fields['element type'])
            .alt
            .replace(/INSIGHTS_/gi,'')
        ];
      }

      function getDescription(node) {
        return node
          .querySelector(fields.description)
          .innerHTML
          .replace(/\s{2,}/gi,'');
      }

      function getLink(node) {
        return node.querySelector(fields.link).href;
      }

      let cardNodes = document.querySelectorAll(".cards__item");

      cardNodes.forEach(node => {
        results.push({
          'label': getLabel(node),
          'element type': getType(node),
          'description': getDescription(node),
          'link': getLink(node),
          'id': getLink(node),
          'countries': []
        });
      });

      return results;
    },[]);

    console.log(cards.length);

    insights = insights.concat(cards);

    await page2.close();
  }

  console.log(insights.length);

  for(i = 0; i < countries.length; i++) {
    let page3 = await browser.newPage();
    await page3.goto(countries[i].link);
    insights = await page3.evaluate((insights, countryName) => {
      let nodes = document.querySelectorAll('.cards__item__link');
      let cardLinks = [];
      nodes.forEach(node => {
        cardLinks.push(node.href);
      });

      insights.forEach(insight => {
        if(cardLinks.findIndex(link => link === insight.link) > -1) {
          insight.countries.push(countryName);
        }
      });

      return insights;
    }, insights, countries[i].name);

    await page3.close();
  }

  function createElementBlueprint(elementsArray) {
      let elementBlueprint = JSON.parse(
          "{\"elements\":" + JSON.stringify(elementsArray) + "}"
          );
      return JSON.stringify(elementBlueprint, null, 2);
  }

  fs.writeFile('insights.json', createElementBlueprint(insights), (err) => {
    if (err) throw err;
    console.log('Map those insights!');
  });

  await browser.close();
}

scrapePages();
