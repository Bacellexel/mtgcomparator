const express = require('express');
const app = express();
const cookieParser = require("cookie-parser");
const sessions = require('express-session');
const expressEjsLayout = require('express-ejs-layouts');
const puppeteer = require('puppeteer');
const port = process.env.PORT || 8000;

const oneDay = 1000 * 60 * 60 * 24;

let f2fCards = [{}];
let imgCards = [{}];

app.set('view engine', 'ejs');

app.use(expressEjsLayout);
app.use(express.urlencoded({extended: false}));
app.use(express.static(__dirname + "/public/"));
app.use(cookieParser());
app.use(sessions({
    secret:Math.random().toString(),
    saveUninitialized:true,
    cookie: {maxAge: oneDay },
    resave: false
}));

let sessionsSearch;

function isAuthenticated (req, res, next) {
    if (req.session.user) next()
    else next('route')
  }

app.get('/', isAuthenticated, (req, res) => {

   res.render('index', 
     {
        f2fCardArray: sessionsSearch["f2f"+ req.session.id],
        imgCardArray: sessionsSearch["img"+ req.session.id]
     });
});

app.get('/', (req, res) => {

     // regenerate the session, which is good practice to help
  // guard against forms of session fixation
  req.session.regenerate(function (err) {
    if (err) next(err)

    // store user information in session, typically a user id
    req.session.user = Math.random().toString();

    // save the session before redirection to ensure page
    // load does not happen before session is saved
    req.session.save(function (err) {
      if (err) return next(err)
      res.redirect('/')
    })
  })

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
    await page2.waitForSelector('.magic-main')

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

    sessionsSearch["f2f"+ req.session.id] = f2fCards;
    sessionsSearch["img" + req.session.id] = imgCards;

    await page.close();
    await page2.close();    
    await browser.close();

})

async function getData(page, selector){
    let valueArray = await page.evaluate((selector) =>{
        let values = Array.from(document.querySelectorAll(selector));
        let results = values.map(value => {
            return value.innerText;
        })
        return results;
    }, selector);
    return valueArray.filter(x => x);
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