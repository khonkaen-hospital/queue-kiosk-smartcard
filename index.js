// naphattharawat@gmail.com

const fs = require('fs')
const fse = require('fs-extra');
const { Reader } = require('@tanjaae/thaismartcardreader')
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
const myReader = new Reader()
let kioskId;
let urlAPI;
let token;



fse.readJson('./config.json')
  .then(json => {

    var knex = require('knex')({
      client: 'mysql',
      connection: {
        host: json.DB_HOST,
        user: json.DB_USER,
        port: json.DB_PORT,
        password: json.DB_PASSWORD,
        database: json.DB_NAME
      }
    });

    kioskId = json.kioskId;
    urlAPI = json.urlAPI;
    token = json.token;
    saveToTable = json.saveToTable;
    console.log(urlAPI);

    process.on('unhandledRejection', (reason) => {
      console.log('From Global Rejection -> Reason: ' + reason);
    });

    console.log('Waiting For Device !')
    myReader.on('device-activated', async (event) => {
      console.log('Device-Activated')
      console.log(event.name)
      console.log('=============================================')
    })

    myReader.on('error', async (err) => {
      console.log(err)
    })

    myReader.on('image-reading', (percent) => {
      console.log(percent)
    })

    myReader.on('card-removed', (err) => {
      var data = null;
      var xhr = new XMLHttpRequest();
      var data = `token=${token}&kioskId=${kioskId}`;
      xhr.withCredentials = true;
      xhr.open("DELETE", `${urlAPI}/kiosk/profile`);
      xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
      xhr.send(data);
      console.log('== card remove ==')
    })

    myReader.on('card-inserted', async (person) => {
      const cid = await person.getCid()
      const thName = await person.getNameTH()
      const enName = await person.getNameEN()
      const dob = await person.getDoB()
      const issueDate = await person.getIssueDate()
      const expireDate = await person.getExpireDate()
      const address = await person.getAddress()
      const issuer = await person.getIssuer()



      // const fileStream = fs.createWriteStream(`${cid}.jpg`)
      // fileStream.write(photoBuff)
      // fileStream.close()

      console.log(`CitizenID: ${cid}`)
      console.log(`THName: ${thName.prefix} ${thName.firstname} ${thName.lastname}`)
      console.log(`DOB: ${dob.day}/${dob.month}/${dob.year}`)
      console.log('=============================================')

      var xhr = new XMLHttpRequest();
      const objData = {
        cid: cid,
        thname: `${thName.prefix} ${thName.firstname} ${thName.lastname}`,
        enname: `${enName.prefix} ${enName.firstname} ${enName.lastname}`,
        title: thName.prefix,
        fname: thName.firstname,
        lname: thName.lastname,
        issuedate: `${issueDate.year}-${issueDate.month}-${issueDate.day}`,
        expiredate: `${expireDate.year}-${expireDate.month}-${expireDate.day}`,
        address: address,
        issuer: issuer,
        entitle: enName.prefix,
        enlname: enName.firstname,
        enlname: enName.lastname,
        birthDate: `${dob.year}-${dob.month}-${dob.day}`
      };
      var data = `token=${token}&kioskId=${kioskId}`;
      data += `&cid=${cid}`;
      data += `&thname=${thName.prefix} ${thName.firstname} ${thName.lastname}`;
      data += `&enname=${enName.prefix} ${enName.firstname} ${enName.lastname}`;
      data += `&title=${thName.prefix}`;
      data += `&fname=${thName.firstname}`;
      data += `&lname=${thName.lastname}`;
      data += `&issuedate=${issueDate.year}-${issueDate.month}-${issueDate.day}`;
      data += `&expiredate=${expireDate.year}-${expireDate.month}-${expireDate.day}`;
      data += `&address=${address}`;
      data += `&issuer=${issuer}`;
      data += `&entitle=${enName.prefix}`;
      data += `&enfname=${enName.firstname}`;
      data += `&enlname=${enName.lastname}`;
      // data += `&photo=${imageBase64}`;
      data += `&birthDate=${dob.year}-${dob.month}-${dob.day}`;
      xhr.withCredentials = true;

      // xhr.addEventListener("readystatechange", function () {
      //   if (this.readyState === 4) {
      //     console.log(this.responseText);
      //   }
      // });

      xhr.open("POST", `${urlAPI}/kiosk/profile`);
      xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
      xhr.setRequestHeader("cache-control", "no-cache");
      xhr.send(data);

      if (saveToTable === 'true') {
        const photo = await person.getPhoto()
        const photoBuff = Buffer.from(photo)
        const imageBase64 = photoBuff.toString('base64')
        try {
          let dbPerson = knex('nhso_smartcard').where({ 'PERSON_ID': cid });
          const personData = await dbPerson.first();
          const cardData = {
            'NHSOWEBSERVICE_PERSON_ID': cid,
            'PERSON_ID': cid,
            'PICTURE_PERSON_ID': cid,
            'TITLE': thName.prefix,
            'FNAME': thName.firstname,
            'LASTNAME': thName.lastname,
            'DATE_OF_BIRTH': `${dob.year - 543}-${dob.month}-${dob.day}`,
            'CARD_ISSUE_DATE': `${issueDate.year - 543}-${issueDate.month}-${issueDate.day}`,
            'CARD_EXPDATE': `${expireDate.year - 543}-${expireDate.month}-${expireDate.day}`,
            'ADDRESS_IN_CARD': address.replace('#', '').split('#').join(' '),
            'raw_data': JSON.stringify(objData)
          };

          if (personData) {
            await dbPerson.update(cardData);
          } else {
            const date = new Date();
            const dd = String(date.getDate()).padStart(2, '0');
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const yyyy = date.getFullYear();
            cardData.CREATED_DATE = `${yyyy}-${mm}-${dd} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
            await knex('nhso_smartcard').insert(cardData);
          }

          let picture = knex('nhso_smartcard_picture').where({ 'PERSON_ID': cid });
          const pictureData = await picture.first();
          if (pictureData) {
            await picture.update({
              'JPG_PICTURE': photoBuff
            });
          } else {
            let res = await knex('nhso_smartcard_picture').insert({
              'PERSON_ID': cid,
              'JPG_PICTURE': photoBuff
            });
          }
        } catch (error) {
          console.log(error);
        }
      }



    })

    myReader.on('device-deactivated', () => { console.log('device-deactivated') })


  }).catch(err => {
    console.log(err);
  })
