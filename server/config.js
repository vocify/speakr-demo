require("dotenv").config({ path: "./config.env" });

const api_key = process.env.SPEAKR_APIKEY;

module.exports = {api_key}