const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const app = express();
require("express-ws")(app);
app.use(express.json());
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());
const port = 8081;


const { audio_stream } = require("./speakrexample.js");

app.get("/health", (req, res) => {
  res.send("Green");
});

app.ws("/v2v", audio_stream);

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
