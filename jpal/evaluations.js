const puppeteer = require('puppeteer');
const fs = require('fs');

async function scrapePages() {
  const browser = await puppeteer.launch({headless: true});
  const page = await browser.newPage();

  await page.goto('https://www.povertyactionlab.org/evaluations?page=0')
  let metadata = await page.evaluate(metadata => {
    let pageTotal = Number(document.querySelector('#views-record-count-text').textContent.split(' ')[0]);
    metadata.pageTotal = Math.ceil(pageTotal / 6);

    let nodes;
    let dropdowns = {
      'sectors': 5,
      'countries': 7,
      'regions': 11
    };

    for(i = 0; i < Object.keys(dropdowns).length; i++) {
      nodes = document.querySelectorAll('#simpleselect_jpal_facetapi_select_facet_form_' + dropdowns[Object.keys(dropdowns)[i]] + ' .option');
      dropdowns[Object.keys(dropdowns)[i]] = [];
      nodes.forEach(node => {
        dropdowns[Object.keys(dropdowns)[i]].push(node.textContent.split(' ')[0]);
      });
      metadata[Object.keys(dropdowns)[i]] = dropdowns[Object.keys(dropdowns)[i]].filter(value => value.toLowerCase() !== 'all');
    }

    return metadata;
  }, {})

  console.log(metadata.pageTotal + ' pages to scrape');

  let data = {
    'evaluations': [],
    'authors': []
  };
  metadata.pageTotal = 4;
  for(i = 0; i < metadata.pageTotal; i++) {
    console.log(metadata.pageTotal - i);
    let page2 = await browser.newPage();
    await page2.goto('https://www.povertyactionlab.org/evaluations?page=' + i);

    let thisData = await page2.evaluate(data => {
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
          'element type': 'Article',
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
            'element type': 'Author',
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

    data.evaluations = data.evaluations.concat(thisData.evaluations);
    thisData.authors = thisData.authors.filter(author => data.authors.findIndex(a => a.link === author.link) === -1);
    data.authors = data.authors.concat(thisData.authors);

    await page2.close();
  }

  console.log(data.evaluations.length + ' articles to scrape');

  for(i = 0; i < data.evaluations.length; i++) {
    console.log(data.evaluations.length - i);
    let page2 = await browser.newPage();
    await page2.goto(data.evaluations[i].link);

    let thisData = await page2.evaluate(data => {
      let nodes = document.querySelectorAll('.evaluation-details strong');
      let specialNames = ['data', 'partners', 'outcome of interest', 'target group', 'intervention type', 'research papers'];
      nodes.forEach(node => {
        let name = node.textContent.replace(/(\:\s$|\:$)/, '');
        let value;

        if(specialNames.findIndex(n => n === name.toLowerCase()) === -1) {
          let replace = new RegExp(name + ':');
          value = node.parentNode.textContent.replace(replace,'').replace(/^\s+/g, '').replace(/\s+$/g, '');
        } else if(name.toLowerCase() === 'data') {
          let thisNode = node.parentNode.querySelector('.field-name-field-external-data a');
          value = thisNode.href;
        } else if (name.toLowerCase() === 'partners'){
          value = [];
          let theseNodes = node.parentNode.querySelectorAll('#partnerContainer a');
          theseNodes.forEach(n => {
            value.push(n.href);
          });
        } else if(name.toLowerCase() === 'research papers'){
          value = [];
          let theseNodes = node.parentNode.querySelectorAll('.field-name-field-external-link .field-item a');
          if (theseNodes.length === 0) {
            let thisNode = node.nextSibling.nextSibling;
            value.push(thisNode.textContent);
          } else {
            theseNodes.forEach(node => {
              value.push(node.textContent);
            });
          }
        } else {
          value = [];
          let slug = name.toLowerCase().replace(/\s/g, '-');
          let theseNodes = node.parentNode.querySelectorAll('.field-name-field-' + slug + ' .field-item');
          theseNodes.forEach(node => {
            value.push(node.textContent);
          });
        }
        data[name.toLowerCase()] = value;
      });

      return data;
    }, {});

    let existingNames = Object.keys(data.evaluations[i]);
    let theseNames = Object.keys(thisData);
    theseNames.forEach(name => {
      if(existingNames.findIndex(n => n === name) !== -1) {
        return;
      } else {
        data.evaluations[i][name] = thisData[name];
      }
    });
    await page2.close();
  }

  console.log(data.authors.length + ' authors to scrape');

  for(i = 0; i < data.authors.length; i++) {
    console.log(data.authors.length - i);
    let page2 = await browser.newPage();
    await page2.goto(data.authors[i].link);

    let thisData = await page2.evaluate(data => {
      data.image = document.querySelector('.group-side .field-name-field-photo img').src;
      data.website = document.querySelector('.group-side .field-name-field-homepage a').href;
      data['curriculum vitae'] = document.querySelector('.group-side .field-name-field-cv-link a').href;
      data.email = document.querySelector('.group-side .field-email a').textContent;

      let jpalRoles = [];
      let nodes = document.querySelectorAll('.jpal-role');
      nodes.forEach(node => {
        let value = node.textContent.replace(/^\s+/g, '').replace(/\s+$/g, '').replace(/\s+/g,'\s');
        jpalRoles.push(value);
      });
      data['j-pal roles'] = jpalRoles;

      data.title = document.querySelector('.jpal-roles span:first-of-type').textContent;
      data.organization = document.querySelector('.jpal-roles span:last-of-type').textContent;

      let description = '';
      nodes = document.querySelectorAll('.group-main p');
      nodes.forEach(node => {
        description += node.textContent + '\n\n';
      });
      data.description = description.replace(/^\s+/g, '').replace(/\s+$/g, '').replace(/\n{3,}/g,'\n\n');

      return data;
    }, {});

    let theseNames = Object.keys(thisData);
    theseNames.forEach(name => {
      data.authors[i][name] = thisData[name];
    });
    await page2.close();
  }

  let log = data.authors;

  fs.writeFile('jpal.json', JSON.stringify(log, null, 2), (err) => {
    if (err) throw err;
    console.log('yay');
  });

  await browser.close();
}

scrapePages();
