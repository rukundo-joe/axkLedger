const express = require('express');
const router  = express.Router();
const ProduceManagement = require('./ProduceManagement');
const ProduceOwnershipV2 = require('./ProduceOwnershipV2');
const ProduceTraceability = require('./ProduceTraceability');
const ProduceTraceabilityV8 = require('./ProduceTraceabilityV8');
const { check, validationResult } = require('express-validator');
const {validateToken, validateAdmin, validateFarmer, validateFarmerExists } = require('../../server/psql/middleware/auth');
const farmerModel = require('../../server/psql/models/farmers');
const walletModel = require('../../server/psql/models/wallet');
const smartcontracts = require('../../server/psql/models/smartcontracts');
const {successResponse, errorResponse} = require('../eth/libs/response');
const { min } = require('bn.js');

const logStruct = (func, error) => {
    return {'func': func, 'file': 'supplychain', error}
  }

  const registerFarmer = async(req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try{
      //let address = req.farmer.address;
      const farmerExists = await farmerModel.checkFarmerExists(req.farmer.address);
      if (!farmerExists && !farmerExists.length) {
        return res.status(403).json({ msg : 'farmerNotExists' });
      } 
      const reg_frm = await ProduceTraceabilityV8.registerFarmer(req.farmer);
      return successResponse(200, reg_frm, 'register v2'); 
    } catch (error) {
    console.error('error -> ', logStruct('registerFarmer', error))
    return errorResponse(error.status, error.message);
  }
  }

  router.get('/reg/v2', [
    check('address', 'Please include farmer address').not().isEmpty(),
    check('name', 'Please include farmer name').not().isEmpty(),
    check('location', 'Please include farmer location').not().isEmpty(),
    check('x-farmer-token', 'Please include the farmer auth token').not().isEmpty()
  ] , validateFarmer, async(req, res, next) => {
    console.log(req.body);
    //const {to, amount} = req.body
    const tx = await registerFarmer(req, res);
  
    return res.status(tx.status).send(tx.data);
});

const verifyFarmer = async(req, res) => {
    try{
      const farmerExists = await farmerModel.checkFarmerExists(req.farmer.address);
      if (!farmerExists && !farmerExists.length) {
        return res.status(403).json({ msg : 'farmerNotExists' });
      }   
      const ver_fmr = await ProduceTraceabilityV8.verifyFarmer(req.farmer.address);
      await farmerModel.verifyFarmer(req.farmer);
      return successResponse(200, ver_fmr, 'verify v2'); 
    } catch (error) {
    console.error('error -> ', logStruct('verifyFarmer', error));
    return errorResponse(error.status, error.message);
  }
  }

  router.get('/ver/v2', [
    check('address', 'Please include farmer address').not().isEmpty(),
    check('wallet_id', 'Please include farmer wallet_id').not().isEmpty(),
    check('x-farmer-token', 'Please include the farmer auth token').not().isEmpty()
  ], validateFarmer, async(req, res, next) => {
    console.log(req.body);
    //const {to, amount} = req.body
    const ver = await verifyFarmer(req, res);
  
    return res.status(ver.status).send(ver.data);
});


const addFarmProduce = async(req, res) => {
    try{
      let consignment = {};  
      const farmerExists = await farmerModel.checkFarmerExists(req.body.farmer);
      if (!farmerExists && !farmerExists.length) {
        return res.status(403).json({ msg : 'farmerNotExists' });
      } 
      consignment.wallet_id = farmerExists[0].wallet_id;
      consignment.farmer = req.body.farmer;
      consignment.owner = req.body.farmer;

      const add_prd = await ProduceTraceability.addFarmProduce(req.body);
      const product = {
         product : add_prd
      }
      
      
      
      //await smartcontracts.createConsignment({wallet_})
      return res.send(product); //successResponse(200, bal_axk, 'balance'); 
    } catch (error) {
    console.error('error -> ', logStruct('addFarmProduce', error))
    return res.send(error.status);
  }
  }

  router.post('/add', validateToken,  async(req, res, next) => {
    console.log(req.body);
    //const {to, amount} = req.body
    const product = await addFarmProduce(req, res);
  
    return product;
});

const addFarmProduceV2 = async(req, res) => {
  const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
  try{
    let consignment = {};   
    const farmerExists = await farmerModel.checkFarmerExists(req.body.farmer);
    if (!farmerExists && !farmerExists.length) {
      return res.status(403).json({ msg : 'farmerNotExists'});
    } 
   
    consignment.wallet_id = farmerExists[0].wallet_id;
    consignment.farmer = req.body.farmer;
    consignment.owner = req.body.farmer;
    const add_prd = await ProduceTraceabilityV8.addFarmProduce(req.body);
    const product = {
       product : add_prd
    }
    const consignment_hash = await ProduceTraceabilityV8.getConsignmentHash(add_prd.lot_number, add_prd.farmer);
    consignment.consignment_hash = consignment_hash;
    const p_hash = await ProduceTraceabilityV8.getProduceHash(add_prd.lot_number, add_prd.farmer);
    consignment.tx_hash = p_hash;
    consignment.lot_number = add_prd.lot_number;
    consignment.storage_date = add_prd.storage_date;
    consignment.weight = add_prd.weight;
    consignment.quantity = add_prd.quantity;
    await smartcontracts.createConsignment(consignment);
    product.consignment = consignment;
    return res.send(product); //successResponse(200, bal_axk, 'balance'); 
  } catch (error) {
  console.error('error -> ', logStruct('addFarmProduce v2', error))
  return res.send(error.status);
}
}

router.post('/add/v2', [
  check('farmer', 'Please include farmer address').not().isEmpty(),
  check('produce', 'Please include produce name').not().isEmpty(),
  check('weight', 'Please include the weight').not().isEmpty(),
  check('quantity', 'Please include the quantity').isInt().not().isEmpty(),
  check('agents', 'Please include the agents array').isArray().not().isEmpty(),
  check('x-auth-token', 'Please include the authentication token').not().isEmpty()
], validateToken, validateAdmin, validateFarmerExists, async(req, res, next) => {
  console.log(req.body);
  //const {to, amount} = req.body
  const product = await addFarmProduceV2(req, res);

  return product;
});



const registerProduce = async(req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
  try{
    let product = {}; 
    const farmerExists = await farmerModel.checkFarmerExists(req.body.farmer);
    if (!farmerExists && !farmerExists.length) {
      return res.status(403).json({ msg : 'farmerNotExists'});
    }
    const produceExists = await smartcontracts.checkProduceExists(req.body);
    if (produceExists && produceExists.length) {
      return res.status(403).json({ msg : 'produceExists'});
    } 

    product.wallet_id = farmerExists[0].wallet_id;
    product.farmer = req.body.farmer;
    product.owner = req.body.farmer;
    //part_array.push(web3.utils.soliditySha3(accounts[0], web3.utils.fromAscii(lote_numbers[i]),web3.utils.fromAscii(part_types[i]), web3.utils.fromAscii(creation_date)))
    //const produce_hash = await ProduceManagement.createHashFromInfo(req.body.farmer, data.lot_number, req.body.produce, data.creation_date).call();
    const reg_prd = await ProduceManagement.registerProduce(req.body);//await ProduceOwnershipV2.addOwnership(req.body);
    const reg = {
       reg : reg_prd
    }
    product.produce_hash = reg_prd.produce_hash;
    product.tx_hash = reg_prd.txHash;
    product.lot_number = reg_prd.lot_number;
    product.creation_date = reg_prd.creation_date;
    product.produce_type = reg_prd.produce_type;
    await smartcontracts.createProduce(product);
    req.product = product;
    return res.send(reg); //successResponse(200, bal_axk, 'balance'); 
  } catch (error) {
  console.error('error -> ', logStruct('registerProduce V2', error))
  return res.send(error.status);
}
}

router.post('/reg/product/v2',  [
  check('farmer', 'Please include farmer address').not().isEmpty(),
  check('consignments', 'Please include produce consignments').isArray().not().isEmpty(),
  check('produce_type', 'Please include the produce type').not().isEmpty(),
  check('x-auth-token', 'Please include the authentication token').not().isEmpty()
] , validateToken, validateAdmin, validateFarmerExists, 
async(req, res, next) => {
  console.log(req.body);
  //const {to, amount} = req.body
  const reg = await registerProduce(req, res);

  return reg;
});

const addOwnership = async(req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
  }
  try{
    //let product_owner = {}; 
    const farmerExists = await farmerModel.checkFarmerExists(req.body.farmer);
    if (!farmerExists && !farmerExists.length) {
      return res.status(403).json({ msg : 'farmerNotExists'});
    } 
    const produceExists = await smartcontracts.checkProduce({farmer : req.body.farmer, hash : req.body.p_hash});
    if (!produceExists && !produceExists.length) {
      return res.status(403).json({ msg : 'produceNotExists'});
    }    
    //const produce_hash = await ProduceManagement.createHashFromInfo(req.body.farmer, data.lot_number, data.produce, data.storage_date).call();
    const add_own = await ProduceOwnershipV2.addOwnership(req.body);//await ProduceOwnershipV2.addOwnership(req.body);
    const own = {
       own : add_own
    }
    //product_owner.hash = req.body.p_hash;

    //product_owner.farmer = req.body.farmer;
    //product_owner.owner = req.body.farmer;

    return res.send(own); //successResponse(200, bal_axk, 'balance'); 
  } catch (error) {
  console.error('error -> ', logStruct('addOwnership V2', error))
  return res.send(error.status);
}
}

router.post('/own/product/v2', [
  check('farmer', 'Please include farmer address').not().isEmpty(),
  check('p_hash', 'Please include produce hash').not().isEmpty(),
  check('op_type', 'Please include the operation type').isInt().not().isEmpty(),
  check('x-auth-token', 'Please include the authentication token').not().isEmpty()
] ,validateToken, validateAdmin, validateFarmerExists, async(req, res, next) => {
  console.log(req.body);
  //const {to, amount} = req.body
  const own = await addOwnership(req, res);

  return own;
});

const changeOwnership = async(req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
  }
  try{
    const ownerExists = await walletModel.isEVM(req.body.to);
    if (!ownerExists && !ownerExists.length) {
      return res.status(403).json({ msg : 'newOwnerNotExists'});
    }
    const produceExists = await smartcontracts.checkProduceHash(req.body.p_hash);
    if (!produceExists && !produceExists.length) {
      return res.status(403).json({ msg : 'produceNotExists'});
    }   
    //const produce_hash = await ProduceManagement.createHashFromInfo(req.body.farmer, data.lot_number, data.produce, data.storage_date).call();
    const change_own = await ProduceOwnershipV2.changeOwnership(req.body);//await ProduceOwnershipV2.addOwnership(req.body);
    const change = {
       change : change_own
    }
    return res.send(change); //successResponse(200, bal_axk, 'balance'); 
  } catch (error) {
  console.error('error -> ', logStruct('changeOwnership V2', error))
  return res.send(error.status);
}
}

router.post('/change/product/v2', [
  check('owner', 'Please include the current owner address').not().isEmpty(),
  check('to', 'Please include the new owner address').not().isEmpty(),
  check('p_hash', 'Please include produce hash').not().isEmpty(),
  check('op_type', 'Please include the operation type').isInt().not().isEmpty(),
  check('x-auth-token', 'Please include the authentication token').not().isEmpty()
] ,validateToken, async(req, res, next) => {
  console.log(req.body);
  //const {to, amount} = req.body
  const change = await changeOwnership(req, res);

  return change;
});

const sellFarmProduce = async(req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try{
      let sale = {};
      sale.wallet_id = req.farmer.wallet_id;
      const consArray = await ProduceManagement.consignments(req.body.hash);
      if (!consArray && !consArray.farmer) {
        return res.status(403).json({ msg : 'hashNotExists'});
      } 
      if (consArray.farmer !== req.farmer.address){
        return res.status(403).json({ msg : 'consignment hash address mismatch'});
      }
      sale.farmer = req.farmer.address;
      const buyerExists = await walletModel.isEVM(req.body.buyer);
      if (!buyerExists && !buyerExists.length) {
        return res.status(403).json({ msg : 'buyerNotExists'});
      } 
      sale.buyer = req.body.buyer;
      const sell_pr = await ProduceTraceabilityV8.sellFarmProduce(req.body);
      
      let res_sell = {
         sell : sell_pr
      }
      sale.tx_hash = sell_pr.txHash;
      sale.hash = sell_pr.hash;
      sale.timestamp = sell_pr.timestamp;
      sale.amount = sell_pr.amount;
      sale.price = sell_pr.price;
      sale.index = sell_pr.index;
      await smartcontracts.sellProduce(sale);
      res_sell.sale = sale;
      return res.send(res_sell);//uccessResponse(200, bal_axk, 'tokens available'); 

    } catch (error) {
    console.error('error -> ', logStruct('sellFarmProduce v2', error))
    return res.send(error.status);//errorResponse(error.status, error.message);
  }
  }

  router.post('/sell/v2',[
    check('buyer', 'Please include buyer address').not().isEmpty(),
    check('farmer', 'Please include farmer address').not().isEmpty(),
    check('wallet_id', 'Please include farmer wallet id').not().isEmpty(),
    check('hash', 'Please include produce consignment hash').not().isEmpty(),
    check('amount', 'Please include the produce sale amount').isInt().not().isEmpty(),
    check('price', 'Please include the produce sale price').isInt().not().isEmpty(),
    check('x-auth-token', 'Please include the authentication token').not().isEmpty()
  ], validateToken, validateFarmerExists, async(req, res, next) => {
    //console.log(req.body);
    //const {to, amount} = req.body
    const sell = await sellFarmProduce(req, res);
  
    return sell;//res.status(balance.status).send(balance.data);
});

const getFarmer = async(req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try{   
      const _farmer = await ProduceTraceabilityV8.getFarmer(req.body.address);
      
      let farmer = {
         farmer : _farmer
      }
      return res.send(farmer);//uccessResponse(200, bal_axk, 'tokens available'); 
    } catch (error) {
    console.error('error -> ', logStruct('getFarmer v1', error))
    return res.send(error.status);//errorResponse(error.status, error.message);
  }
  }

  router.post('/farmer/v2', [
    check('address', 'Please include farmer address').not().isEmpty(),
    check('x-auth-token', 'Please include the authentication token').not().isEmpty()
  ] , validateToken, validateFarmerExists, async(req, res, next) => {
    //console.log(req.body);
    //const {to, amount} = req.body
    const farmer = await getFarmer(req, res);
  
    return farmer;//res.status(balance.status).send(balance.data);
});

const getProduce = async(req, res) => {
    try{   
      const _produce = await ProduceTraceabilityV8.getProduce(req.body.index);
      
      let produce = {
         produce : _produce
      }
      return res.send(produce);//uccessResponse(200, bal_axk, 'tokens available'); 
    } catch (error) {
    console.error('error -> ', logStruct('getProduce v2', error))
    return res.send(error.status);//errorResponse(error.status, error.message);
  }
  }

  router.post('/produce/v2', validateToken, async(req, res, next) => {
    //console.log(req.body);
    //const {to, amount} = req.body
    const produce = await getProduce(req, res);
  
    return produce;//res.status(balance.status).send(balance.data);
});

const getProduceHash = async(req, res) => {
  try{   
    const _produce = await ProduceTraceabilityV8.getProduceHash(req.body);
    
    let produce = {
       produce : _produce
    }
    return res.send(produce);//uccessResponse(200, bal_axk, 'tokens available'); 
  } catch (error) {
  console.error('error -> ', logStruct('getProduceHash v2', error))
  return res.send(error.status);//errorResponse(error.status, error.message);
}
}

router.post('/produce/hash/v2', validateToken, async(req, res, next) => {
  //console.log(req.body);
  //const {to, amount} = req.body
  const produce = await getProduceHash(req, res);

  return produce;//res.status(balance.status).send(balance.data);
});

const getProduceIndex = async(req, res) => {
    try{   
      const _index = await ProduceTraceabilityV8.getProduceIndex(req.body.hash);
      
      let index = {
         index : _index
      }
      return res.send(index);//uccessResponse(200, bal_axk, 'tokens available'); 
    } catch (error) {
    console.error('error -> ', logStruct('getProduceIndex v2', error))
    return res.send(error.status);//errorResponse(error.status, error.message);
  }
  }

  router.post('/index/v2', validateToken, async(req, res, next) => {
    //console.log(req.body);
    //const {to, amount} = req.body
    const index = await getProduceIndex(req, res);
  
    return index;//res.status(balance.status).send(balance.data);
});

const getProduceSale = async(req, res) => {
    try{   
      const _sale = await ProduceTraceabilityV8.getProduceSale(req.body.index);
      
      let sale = {
         sale : _sale
      }
      return res.send(sale);//uccessResponse(200, bal_axk, 'tokens available'); 
    } catch (error) {
    console.error('error -> ', logStruct('getProduceSale v2', error))
    return res.send(error.status);//errorResponse(error.status, error.message);
  }
  }

  router.post('/sale/v2', validateToken, async(req, res, next) => {
    //console.log(req.body);
    //const {to, amount} = req.body
    const sale = await getProduceSale(req, res);
  
    return sale;//res.status(balance.status).send(balance.data);
});


const getProduceSaleIndex = async(req, res) => {
    try{   
      const _sale = await ProduceTraceabilityV8.getProduceSaleIndex(req.body.index);
      
      let sale = {
         sale : _sale
      }
      return res.send(sale);//uccessResponse(200, bal_axk, 'tokens available'); 
    } catch (error) {
    console.error('error -> ', logStruct('getProduceSaleIndex v2', error))
    return res.send(error.status);//errorResponse(error.status, error.message);
  }
  }

  router.post('/sale/index/v2', validateToken, async(req, res, next) => {
    //console.log(req.body);
    //const {to, amount} = req.body
    const sale = await getProduceSaleIndex(req, res);
  
    return sale;//res.status(balance.status).send(balance.data);
});

const getConsignmentHash = async(req, res) => {
  try{   
    const _consHash = await ProduceTraceabilityV8.getConsignmentHash(req.body);
    
    let cons = {
       cons : _consHash
    }
    return res.send(cons);//uccessResponse(200, bal_axk, 'tokens available'); 
  } catch (error) {
  console.error('error -> ', logStruct('getConsignmentHash v2', error))
  return res.send(error.status);//errorResponse(error.status, error.message);
}
}

router.post('/prod/cons/v2', validateToken,  async(req, res, next) => {
  //console.log(req.body);
  //const {to, amount} = req.body
  const cons = await getConsignmentHash(req, res);

  return cons;//res.status(balance.status).send(balance.data);
});

const currentconsignment = async(req, res) => {
    try{   
      const _hash = await ProduceTraceabilityV8.currentconsignment(req.body.address);
      
      let hash = {
        hash : _hash
      }
      return res.send(hash);//uccessResponse(200, bal_axk, 'tokens available'); 
    } catch (error) {
    console.error('error -> ', logStruct('currentconsignment v2', error))
    return res.send(error.status);//errorResponse(error.status, error.message);
  }
  }

  router.post('/add/hash/v2', validateToken, async(req, res, next) => {
    //console.log(req.body);
    //const {to, amount} = req.body
    const hash = await currentconsignment(req, res);
  
    return hash;//res.status(balance.status).send(balance.data);
});

const consignments = async(req, res) => {
  try{   
    const _cons = await ProduceManagement.consignments(req.body.hash);
    
    let cons = {
      cons : _cons
    }
    return res.send(cons);//uccessResponse(200, bal_axk, 'tokens available'); 
  } catch (error) {
  console.error('error -> ', logStruct('consignments v2', error))
  return res.send(error.status);//errorResponse(error.status, error.message);
}
}


router.post('/cons/hash/v2', validateToken, async(req, res, next) => {
  //console.log(req.body);
  //const {to, amount} = req.body
  const cons = await consignments(req, res);

  return cons;//res.status(balance.status).send(balance.data);
});

const currentproduct = async(req, res) => {
  try{   
    const _hash = await ProduceTraceabilityV8.currentproduct(req.body.hash);
    
    let hash = {
      hash : _hash
    }
    return res.send(hash);//uccessResponse(200, bal_axk, 'tokens available'); 
  } catch (error) {
  console.error('error -> ', logStruct('currentproduct v2', error))
  return res.send(error.status);//errorResponse(error.status, error.message);
}
}

router.post('/sale/hash/v2', validateToken, async(req, res, next) => {
  //console.log(req.body);
  //const {to, amount} = req.body
  const hash = await currentproduct(req, res);

  return hash;//res.status(balance.status).send(balance.data);
});

const producedata = async(req, res) => {
  try{   
    const _hash = await ProduceTraceabilityV8.producedata(req.body);
    
    let hash = {
      hash : _hash
    }
    return res.send(hash);//uccessResponse(200, bal_axk, 'tokens available'); 
  } catch (error) {
  console.error('error -> ', logStruct('producedata v2', error))
  return res.send(error.status);//errorResponse(error.status, error.message);
}
}

router.post('/prod/hash/v2', validateToken, async(req, res, next) => {
  //console.log(req.body);
  //const {to, amount} = req.body
  const hash = await producedata(req, res);

  return hash;//res.status(balance.status).send(balance.data);
});

const productdata = async(req, res) => {
  try{   
    const _hash = await ProduceTraceabilityV8.productdata(req.body.index);
    
    let hash = {
      hash : _hash
    }
    return res.send(hash);//uccessResponse(200, bal_axk, 'tokens available'); 
  } catch (error) {
  console.error('error -> ', logStruct('productdata v2', error))
  return res.send(error.status);//errorResponse(error.status, error.message);
}
}

router.post('/prod/index/v2', validateToken, async(req, res, next) => {
  //console.log(req.body);
  //const {to, amount} = req.body
  const hash = await productdata(req, res);

  return hash;//res.status(balance.status).send(balance.data);
});

router.post('/lot/v2',  function(req, res, next) {
  //console.log(req.body);
  //const {to, amount} = req.body
  const number =  ProduceManagement.generateLotNumber(req.body.length);

  return res.send(number);//res.status(balance.status).send(balance.data);
});


const farmers = async(req, res) => {
  try{   
    const count = await ProduceTraceabilityV8.getFarmerCount();
    let farmers_array = [], farmer_data = [], _farmer, frm_data;
    for(let i = 0; i < count; i++){
      _farmer = await ProduceTraceabilityV8.FarmerAddresses(i);
      frm_data = await ProduceTraceabilityV8.getFarmer(_farmer);
      farmers_array.push(_farmer);
      farmer_data.push(frm_data);
    }
    const farmer_details = {
      farmer : farmers_array,
      data : farmer_data
    }
    return res.json(farmer_details);
  } catch (error) {
  console.error('error -> ', logStruct('farmers v2', error))
  return res.send(error.status);
}
}

router.get('/farmers/v2', validateToken, async(req, res, next) => {
  const _farmers =  await farmers(req, res);
  return res.send(_farmers);
});


const produces = async(req, res) => {
  try{   
    const counter = await ProduceTraceabilityV8.getProduceCount();
    let produces_array = [], index = [], produce_data;
    for(let ct = 0; ct< counter; ct++){
      produce_data = await ProduceTraceabilityV8.getProduce(ct);
      produces_array.push(produce_data);
      index.push(ct);
    }
    const produce_details = {
      index : index,
      data : produces_array
    }
    return res.send(produce_details);
  } catch (error) {
  console.error('error -> ', logStruct('produces v2', error))
  return res.send(error.status);
}
}

router.get('/produces/v2', validateToken, async(req, res, next) => {
  const _produces =  await produces(req, res);
  return res.send(_produces);
});

const sales = async(req, res) => {
  try{   
    const counter = await ProduceTraceabilityV8.getProduceSaleCount();
    let sales_array = [], index = [], sales_data;
    for(let ctr = 0; ctr < counter; ctr++){
      sales_data = await ProduceTraceabilityV8.getProduceSale(ctr);
      sales_array.push(sales_data);
      index.push(ctr);
    }
    const sales_details = {
      index : index,
      data : sales_array
    }
    return res.send(sales_details);
  } catch (error) {
  console.error('error -> ', logStruct('sales v2', error))
  return res.send(error.status);
}
}

router.get('/sales/v2', validateToken, async(req, res, next) => {
  const _sales =  await sales(req, res);
  return res.send(_sales);
});

module.exports = router; 