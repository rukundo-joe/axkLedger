const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
//const {} = require('../../validators/address');
const {validateToken} = require('../../middleware/auth');

const {  addTransaction, getTransaction } = require('../../controllers/transaction');

router.get('/', validateToken, getTransaction);

router.post(
    '/',
    [
      check('wallet_id', 'Please include a wallet id').exists(),
      check('address', 'Please include an address').exists(),
      check('tx_hash', 'tx_hash is required').exists(),
      check('type', 'Please include the type').exists(),
      check('mode', 'Please include the mode').exists(),
      check('to', 'to is required').exists(),
      check('value', 'value is required').exists(),
    ],
    validateToken,
    addTransaction,
);

 
module.exports = router;