const puppeteer = require('puppeteer');
const fs = require('fs');

async function getDocsGraph(homePage, headerIdentifier, sidebarAnchorIdentifier, pageTitleIdentifier, pageAnchorIdentifier) {
  const browser = await puppeteer.launch({headless: false});
  const page = await browser.newPage();

  await page.goto(homePage);

  let sidebarHeaders = await page.evaluate((headers, headerIdentifier) => {
    let nodes = document.querySelectorAll(headerIdentifier);
    nodes.forEach(node => {
        headers.push(node.textContent);
    });
    return headers;
  }, [], headerIdentifier);

  let closedDropdowns = await page.evaluate(result => {
    let nodes = document.querySelectorAll('polyline[points="9 18 15 12 9 6"]');
    result += nodes.length;
    return result;
  }, 0);

  while(closedDropdowns > 0) {
    let thisNode = await page.evaluate(result => {
      let thisNode = document.querySelector('polyline[points="9 18 15 12 9 6"]');
      result.x = thisNode.getBoundingClientRect().x;
      result.y = thisNode.getBoundingClientRect().y;
      return result;
    }, {})

    console.log(thisNode);

    await page.mouse.click(thisNode.x, thisNode.y);
    await page.mouse.click(0, 0, {'delay': 3000});

    closedDropdowns = await page.evaluate(result => {
      let nodes = document.querySelectorAll('polyline[points="9 18 15 12 9 6"]');
      result += nodes.length;
      return result;
    }, 0);
  }

  let pages = await page.evaluate((links, sidebarAnchorIdentifier, homePage) => {
    let anchors = document.querySelectorAll(sidebarAnchorIdentifier);
    anchors.forEach(anchor => {
        if(/\#/.test(anchor.href) === false && /gitbook\.com/.test(anchor.href) === false) {
            let obj = new Object();
            obj.id = anchor.href;

            if(obj.id.split(homePage)[1] && obj.id.split(homePage)[1].split('/')[1]) {
                obj['element type'] = obj.id.split(homePage)[1].split('/')[1];
            } else {
                obj['element type'] = 'home';
            }

            links.push(obj);
        }
    });

    return links;
  }, [], sidebarAnchorIdentifier, homePage);

  for(i = 0; i < pages.length; i++) {
    let thisPage = await browser.newPage();
    await thisPage.goto(pages[i].id);

    pages[i].Label = await thisPage.evaluate((title, pageTitleIdentifier) => {
        title += document.querySelector(pageTitleIdentifier).textContent;
        return title;
    }, '', pageTitleIdentifier);

    pages[i]['Outgoing Links'] = await thisPage.evaluate((links, pageAnchorIdentifier, homePage) => {
        let anchors = document.querySelectorAll(pageAnchorIdentifier);
        let homePageRegExp = new RegExp(homePage.split('https://')[1])
        anchors = Array.from(anchors)
            .map(a => a.href.split('#')[0].replace(/\.md$/, '.html'))
            .filter(a => homePageRegExp.test(a) === true);

        links = links.concat(Array.from( new Set(anchors) ));
        return links;
    }, [], pageAnchorIdentifier, homePage);

    console.log(pages[i].Label);

    await thisPage.close();
  }

  let links = [];
  let brokenLinks = [];

  for(i = 0; i < pages.length; i++) {
    pages[i]['Incoming Links'] = pages.reduce((acc, page) => {
      if(page['Outgoing Links'].findIndex(link => link === pages[i].id) !== -1) {
        acc.push(page.Label);
      }

      return acc;
    }, []);

    pages[i]['Outgoing Links'].forEach(link => {
      links.push({
        'From': pages[i].id,
        'To': link,
        'Type': 'hyperlink'
      });
    });

    pages[i]['Outgoing Links'] = pages[i]['Outgoing Links']
      .map(link => {
          if(pages.findIndex(l => l.id === link) !== -1) {
              return pages.find(l => {
                  return l.id === link;
              }).Label;
          } else {
              brokenLinks.push(link);
              return link;
          }
      });
  }

  function createBlueprint(elementsArray, connectionsArray) {
      let elementsAndConnections = JSON.parse(
          "{\"elements\":" + JSON.stringify(elementsArray) + ",\"connections\":" + JSON.stringify(connectionsArray) + "}"
          );
      return JSON.stringify(elementsAndConnections, null, 2);
  }

  fs.writeFile('docs.json', createBlueprint(pages, links), (err) => {
    if (err) throw err;
    console.log('Map those docs!');
  });
}

getDocsGraph('https://unicef.gitbook.io/prp', '._wpw88l', 'a._1xtwstf', '._1kapl502', '._1u3clsji a');
