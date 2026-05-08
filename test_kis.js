require('dotenv').config();
const kisApi = require('./server/services/kisApi');
const mongoose = require('mongoose');

async function test() {
  try {
    const res = await kisApi.getStockPrice('005930');
    console.log("API Response:", res);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

test();
