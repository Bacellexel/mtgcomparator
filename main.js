const express = require('express');
const app = express();
const expressEjsLayout = require('express-ejs-layouts');
const puppeteer = require('puppeteer');
const port = process.env.PORT || 8000;

let f2fCards = [{}];
let imgCards = [{}];
app.set('view engine', 'ejs');
app.use(expressEjsLayout);

app.use(express.urlencoded({extended: false}));

app.use(express.static(__dirname + "/public/"));

app.get('/', (req, res) => {
    res.render('index', 
    {
        f2fCardArray: f2fCards,
        imgCardArray: imgCards
    });
});

app.post('/', async (req, res) => {

    f2fCards = [{}];
    imgCards = [{}];

    const { cardName } = req.body;
    const browser = await puppeteer.launch({
        'args': [
            '--no-sandbox',
            'disable-setuid-sandbox'
        ]
    });
    const page = await browser.newPage();
    const page2 = await browser.newPage();

    const f2fPrice = '.price-container';
    const f2fName = '.hawk-results__hawk-contentTitle';
    const f2fEdition = '.hawk-results__hawk-contentSubtitle';
    const f2fImage = '.hawk-results__item-image > img'
    const imgPrice = 'div.card-info > div.input-group > div.price-listing > table > tbody > tr:nth-child(2) > td:nth-child(2)'
    const imgName = 'div.card-info > h3 > a'
    const imgEdition = 'div.card-info > span:nth-child(2)';
    const imgImage = 'li.card-listing > div.magic-card > a > img'; 

    await page.goto('https://www.facetofacegames.com/search/?keyword=' + cardName);
    await page2.goto('https://imaginaire.com/fr/magic/recherche-avancee/resultats.html?isinstock=1&titre=' + cardName);

    await page.setRequestInterception(true)
    page.on('request', (request) => {
        if(request.resourceType() === 'image'){
             request.abort();
        }
        else{
            request.continue();
        }
    })

    await page.waitForSelector(f2fName);
    await page2.waitForSelector('.card-info')

    let f2fPriceArray = await getData(page, f2fPrice);
    let f2fNameArray = await getData(page, f2fName);
    let f2fEditionArray = await getData(page, f2fEdition)
    let f2fImageArray = await getAttributeData(page, f2fImage);

    let imgPriceArray = await getData(page2, imgPrice);
    let imgNameArray = await getData(page2, imgName);
    let imgEditionArray = await getData(page2, imgEdition);
    let imgImageArray = await getAttributeData(page2, imgImage);

    res.redirect('/')

    /* Filtering out unique cards */
    for(let i = 0; i < f2fNameArray.length; i++){
        if(!f2fNameArray[i].includes("Scan")
            && !f2fEditionArray[i].includes("World")
            && !f2fEditionArray[i].includes("Gift")
            && !f2fEditionArray[i].includes("Foreign")){
                f2fCards.push({
                    cardName: f2fNameArray[i],
                    cardPrice:f2fPriceArray[i].replace('CAD', ''),
                    cardEdition:f2fEditionArray[i],
                    cardImage:f2fImageArray[i]
                });  
        }        
    }

    for(let i = 0; i < imgNameArray.length; i++){
        if(typeof(imgPriceArray[i]) !== 'undefined'){
            imgCards.push({
                cardName: imgNameArray[i],
                cardPrice: imgPriceArray[i],
                cardEdition: imgEditionArray[i],
                cardImage: 'https://www.imaginaire.com/' + imgImageArray[i]
            });
        }
    }

    page.close();
    page2.close();    
    browser.close();

})

async function getData(page, selector){
    let valueArray = await page.evaluate((selector) =>{
        let values = Array.from(document.querySelectorAll(selector));
        let results = values.map(value => {
            return value.innerText;
        })
        return results;
    }, selector);
    return valueArray;
}

async function getAttributeData(page, selector){
    let valueArray = await page.evaluate((selector) =>{
        let values = Array.from(document.querySelectorAll(selector));
        let results = values.map(value => {
            return value.getAttribute("src");
        })
        return results;
    }, selector);
    return valueArray;
}

app.listen(port, function() {
    console.log("Server started on port " + port);
})