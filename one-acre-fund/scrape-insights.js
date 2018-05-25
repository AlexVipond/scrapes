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

  console.log(pageTotal);

  let insights = [];

  for (i = 0; i < pageTotal; i++) {
    let page2 = await browser.newPage();
    await page2.goto('https://oneacrefund.org/insights-library/?page=' + (i + 1));
    let cards = await page.evaluate(results => {
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
          'link': getLink(node)
        });
      });

      return results;
    },[]);

    console.log(cards.length);

    insights = insights.concat(cards);

    await page2.close();
  }

  console.log(insights.length);

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
}

scrapePages();
