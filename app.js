// import required modules
const express = require('express')
const { google } = require('googleapis')
const multer = require('multer')
const fs = require('fs')

// import google credentials file
const clientData = require('./google_client.json')

const app = express()

// necessary variables
const PORT = 5000
const CLIENT_ID = clientData.web.client_id
const CLIENT_SECRET = clientData.web.client_secret
const REDIRECT_URIS = clientData.web.redirect_uris[0]
var name, pic

// oAuth client object
const oAuth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URIS
)

// declare the scope
const SCOPE = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile"

var userAuthed = false

// set ejs templates
app.set("view engine", "ejs")

// set ejs public folder
app.use(express.static("public"));

// necessary routes
app.get('/', (req, res) => {
  if (!userAuthed) {
    var authUrl = oAuth2Client.generateAuthUrl({
      access_type:'offline',
      scope:SCOPE
    })
    console.log(authUrl)

    res.render("signin", { url: authUrl })
  }

  else {
    var oauth2 = google.oauth2({
      auth:oAuth2Client,
      version:'v2'
    })

    oauth2.userinfo.get(function(err, response) {
      if (err) throw err

      console.log(response.data)

      name = response.data.name
      pic = response.data.picture

      res.render("home", { name:name, pic:pic, success:false })
    })
  }
})

// get user token
app.get('/google/callback', (req, res) => {
  const code = req.query.code

  if (code) {
    oAuth2Client.getToken(code, function(err, tokens) {
      if (err) {
        console.log("Authanticating Error..!" + err)
      }

      else {
        console.log("Authenticated Succefully .." + " Tokens : " + tokens);

        oAuth2Client.setCredentials(tokens)
        userAuthed = true

        res.redirect('/')
      }
    })
  }
})

// file uploads using multer
var oAuthStorage = multer.diskStorage({
  destination: function (req, file, callback) {
    callback(null, "./images")
  },
  filename: function(req, file, callback) {
    callback(null, file.filename + "_" + Date.now() + "_" + file.originalname)
  }
})

var upload = multer({
  storage:oAuthStorage,
}).single("file")

// file upload route
app.post('/upload', (req, res) => {
  upload(req, res, function(err) {
    if (err) throw err

    console.log(req.file.path)

    const drive = google.drive({
      version:'v3',
      auth:oAuth2Client
    })

    const filemetadata = {
      name:req.file.filename
    }

    const media = {
      mimeType:req.file.mimetype,
      body:fs.createReadStream(req.file.path)
    }

    drive.files.create({
      resource:filemetadata,
      media:media,
      fields:"id"
    }, (err, file) => {
      if (err) throw err

      fs.unlinkSync(req.file.path)
      res.render("home", { name:name, pic:pic, success:true })
    })
  })
})

// logout route
app.get('/logout', (req, res) => {
  userAuthed = false
  res.redirect('/')
})

// run server
app.listen(PORT, () => {
  console.log(`App Running on port ${ PORT }`)
})
