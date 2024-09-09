require('babel-polyfill')

const CryptoPunksMarket = artifacts.require('./CryptoPunksMarket.sol')

const expectThrow = async function (promise) {
  try {
    await promise
  } catch (error) {
    // TODO: Check jump destination to destinguish between a throw
    //       and an actual invalid jump.
    const invalidOpcode = error.message.search('invalid opcode') >= 0
    const invalidJump = error.message.search('invalid JUMP') >= 0
    // TODO: When we contract A calls contract B, and B throws, instead
    //       of an 'invalid jump', we get an 'out of gas' error. How do
    //       we distinguish this from an actual out of gas event? (The
    //       testrpc log actually show an 'invalid jump' event.)
    const outOfGas = error.message.search('out of gas') >= 0
    assert(
      invalidOpcode || invalidJump || outOfGas,
      "Expected throw, got '" + error + "' instead"
    )
    return
  }
  assert.fail('Expected throw not received')
}

const compareBalance = function (previousBalance, currentBalance, amount) {
  const strPrevBalance = String(previousBalance)
  const digitsToCompare = 10
  const subPrevBalance = strPrevBalance.substr(
    strPrevBalance.length - digitsToCompare,
    strPrevBalance.length
  )
  const strBalance = String(currentBalance)
  const subCurrBalance = strBalance.substr(
    strBalance.length - digitsToCompare,
    strBalance.length
  )
  console.log(
    'Comparing only least significant digits: ' +
      subPrevBalance +
      ' vs. ' +
      subCurrBalance
  )
  assert.equal(
    Number(subCurrBalance),
    Number(subPrevBalance) + amount,
    'Account 1 balance incorrect after withdrawal.'
  )
}

contract('CryptoPunksMarket-edgecases', function (accounts) {
  it('re-assign a punk during assignment phase, assign same punk twice', async function () {
    const contract = await CryptoPunksMarket.deployed()
    // Assign a two punks, then re-assign one of them
    await contract.setInitialOwner(accounts[3], 500, { from: accounts[0] })
    await contract.setInitialOwner(accounts[4], 501, { from: accounts[0] })
    await contract.setInitialOwner(accounts[4], 500, { from: accounts[0] })
    await contract.setInitialOwner(accounts[4], 501, { from: accounts[0] })
    // Check the balances
    const balance3 = await contract.balanceOf.call(accounts[3])
    const balance4 = await contract.balanceOf.call(accounts[4])
    assert.equal(balance3, 0)
    assert.equal(balance4, 2)
    // Check ownership
    const currentOwner = await contract.punkIndexToAddress.call(500)
    assert.equal(accounts[4], currentOwner)
    // Check the number of punks left to assign
    const leftToAssign = await contract.punksRemainingToAssign.call()
    assert.equal(leftToAssign, 9998)
  }),
  it('place a bid, then transfer the punk, then new owner accepts bid', async function () {
    const contract = await CryptoPunksMarket.deployed()
    // Open up the contract for action, assign some punks
    await contract.allInitialOwnersAssigned()
    await contract.getPunk(1001, { from: accounts[1] })
    await contract.getPunk(1002, { from: accounts[5] })
    await contract.getPunk(1003, { from: accounts[8] })
    const punkIndex = 1001
    const firstOwner = accounts[1]
    const bidder = accounts[0]
    const newOwner = accounts[2]
    const bidPrice = 8000
    // Check initial ownership
    const initialOwner = await contract.punkIndexToAddress.call(punkIndex)
    assert.equal(firstOwner, initialOwner)
    // Bidder bids on punk
    const accountBalancePrev = await web3.eth.getBalance(bidder)
    await contract.enterBidForPunk(punkIndex, {
      from: bidder,
      value: bidPrice
    })
    // Owner transfers it to New Owner
    await contract.transferPunk(newOwner, punkIndex, { from: firstOwner })
    // New owner accepts original bid
    const pendingAmount = await contract.pendingWithdrawals.call(bidder)
    assert.equal(0, pendingAmount)
    // console.log("Prev acc0: " + accountBalancePrev);
    await contract.acceptBidForPunk(punkIndex, bidPrice, { from: newOwner })
    // Make sure A0 was charged
    const accountBalance = await web3.eth.getBalance(bidder)
    // console.log("Post acc0: " + accountBalance);
    compareBalance(accountBalancePrev, accountBalance, -bidPrice)
    // Make sure new owner was paid
    const amount = await contract.pendingWithdrawals.call(newOwner)
    assert.equal(bidPrice, amount)
    await contract.withdraw({ from: newOwner })
    const newAmount = await contract.pendingWithdrawals.call(newOwner)
    assert.equal(0, newAmount)
    // Check ownership
    const currentOwner = await contract.punkIndexToAddress.call(punkIndex)
    assert.equal(bidder, currentOwner)
    // Check the balances
    const balance0 = await contract.balanceOf.call(bidder)
    const balance1 = await contract.balanceOf.call(firstOwner)
    const balance2 = await contract.balanceOf.call(newOwner)
    assert.equal(balance0, 1)
    assert.equal(balance1, 0)
    assert.equal(balance2, 0)
  }),
  it('place a bid, then owner offers for sale, somebody accepts that offer', async function () {
    const contract = await CryptoPunksMarket.deployed()
    const punkIndex = 1002
    const firstOwner = accounts[5]
    const bidder = accounts[6]
    const buyer = accounts[7]
    const bidPrice = 7000
    const salePrice = 9000
    // Check initial ownership
    const initialOwner = await contract.punkIndexToAddress.call(punkIndex)
    assert.equal(firstOwner, initialOwner)
    // Bidder bids on punk
    await contract.enterBidForPunk(punkIndex, {
      from: bidder,
      value: bidPrice
    })
    // Owner offers it for sale
    await contract.offerPunkForSale(punkIndex, salePrice, {
      from: firstOwner
    })
    // Buyer buys
    const accountBalancePrev = await web3.eth.getBalance(buyer)
    await contract.buyPunk(punkIndex, { from: buyer, value: salePrice })
    // Make sure Buyer was charged
    const accountBalance = await web3.eth.getBalance(buyer)
    compareBalance(accountBalancePrev, accountBalance, -salePrice)
    // Make sure First Owner was paid
    const amount = await contract.pendingWithdrawals.call(firstOwner)
    assert.equal(salePrice, amount)
    await contract.withdraw({ from: firstOwner })
    const newAmount = await contract.pendingWithdrawals.call(firstOwner)
    assert.equal(0, newAmount)
    // Check ownership
    const currentOwner = await contract.punkIndexToAddress.call(punkIndex)
    assert.equal(buyer, currentOwner)
    // Check the balances
    const balance0 = await contract.balanceOf.call(bidder)
    const balance1 = await contract.balanceOf.call(firstOwner)
    const balance2 = await contract.balanceOf.call(buyer)
    assert.equal(balance0, 0)
    assert.equal(balance1, 0)
    assert.equal(balance2, 1)
    // Make sure the bid is still in place
    const bid = await contract.punkBids.call(punkIndex)
    assert.equal(true, bid[0])
    assert.equal(punkIndex, bid[1])
    assert.equal(bidPrice, bid[3])
  }),
  it('place a bid, then owner offers for sale, then bidder accepts that offer', async function () {
    const contract = await CryptoPunksMarket.deployed()
    const punkIndex = 1003
    const firstOwner = accounts[8]
    const bidder = accounts[9]
    const bidPrice = 14000
    const salePrice = 15000
    // Check initial ownership
    const initialOwner = await contract.punkIndexToAddress.call(punkIndex)
    assert.equal(firstOwner, initialOwner)
    // Bidder bids on punk
    console.log('About to enter bid')
    const accountBalancePrev = await web3.eth.getBalance(bidder)
    await contract.enterBidForPunk(punkIndex, {
      from: bidder,
      value: bidPrice
    })
    console.log('Enter bid')
    // Owner offers it for sale
    await contract.offerPunkForSale(punkIndex, salePrice, {
      from: firstOwner
    })
    console.log('Offer for sale')
    // Bidder buys
    await contract.buyPunk(punkIndex, { from: bidder, value: 15000 })
    console.log('Buy punk')
    // Make sure bidder was charged for both bid and sale
    const accountBalance = await web3.eth.getBalance(bidder)
    compareBalance(
      accountBalancePrev,
      accountBalance,
      -(bidPrice + salePrice)
    )
    // Make sure seller was paid
    const amount = await contract.pendingWithdrawals.call(firstOwner)
    console.log('Amount: ' + amount)
    assert.equal(salePrice, amount)
    await contract.withdraw({ from: firstOwner })
    const newAmount = await contract.pendingWithdrawals.call(firstOwner)
    assert.equal(0, newAmount)
    // Check ownership
    const currentOwner = await contract.punkIndexToAddress.call(punkIndex)
    assert.equal(bidder, currentOwner)
    // Check the balances
    const balance0 = await contract.balanceOf.call(bidder)
    const balance1 = await contract.balanceOf.call(firstOwner)
    assert.equal(balance0, 1)
    assert.equal(balance1, 0)
    // Make sure the bid is now gone
    const bid = await contract.punkBids.call(punkIndex)
    assert.equal(false, bid[0])
    // Make sure bidder was refunded for bid
    const amount1 = await contract.pendingWithdrawals.call(bidder)
    console.log('Amount1: ' + amount1)
    assert.equal(bidPrice, amount1)
    await contract.withdraw({ from: bidder })
    const newAmount1 = await contract.pendingWithdrawals.call(bidder)
    assert.equal(0, newAmount1)
  }),
  it('place a bid, then owner transfers punk to bidder', async function () {
    const contract = await CryptoPunksMarket.deployed()
    const punkIndex = 501
    const firstOwner = accounts[4]
    const bidder = accounts[3]
    const bidPrice = 10000
    // Check initial ownership
    const initialOwner = await contract.punkIndexToAddress.call(punkIndex)
    assert.equal(firstOwner, initialOwner)
    // Bidder bids on punk
    await contract.enterBidForPunk(punkIndex, {
      from: bidder,
      value: bidPrice
    })
    // Owner transfers it to Bidder
    await contract.transferPunk(bidder, punkIndex, { from: firstOwner })
    // Check ownership
    const currentOwner = await contract.punkIndexToAddress.call(punkIndex)
    assert.equal(bidder, currentOwner)
    // Check the balances
    const balance0 = await contract.balanceOf.call(bidder)
    const balance1 = await contract.balanceOf.call(firstOwner)
    assert.equal(balance0, 1)
    assert.equal(balance1, 1)
    // Make sure the bid is now gone
    const bid = await contract.punkBids.call(punkIndex)
    assert.equal(false, bid[0])
    // Make sure bidder was refunded for bid
    const amount = await contract.pendingWithdrawals.call(bidder)
    assert.equal(bidPrice, amount)
    await contract.withdraw({ from: bidder })
    const newAmount = await contract.pendingWithdrawals.call(bidder)
    assert.equal(0, newAmount)
  })
})
