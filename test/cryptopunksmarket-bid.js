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

contract('CryptoPunksMarket-bid', function (accounts) {
  it('attempt to bid on an unclaimed to punk', async function () {
    const contract = await CryptoPunksMarket.deployed()
    // Open up the contract for action
    await contract.allInitialOwnersAssigned()
    try {
      await contract.getPunk(0, { from: accounts[0] })
      await contract.getPunk(1, { from: accounts[1] })
      assert(false, 'Should have thrown exception.')
    } catch (err) {
      // Should catch an exception
    }
    // Should fail because it is unclaimed
    await expectThrow(
      contract.enterBidForPunk(2, { from: accounts[0], value: 1 })
    )
  }),
  it('attempt to bid on your own punk', async function () {
    const contract = await CryptoPunksMarket.deployed()
    await expectThrow(
      contract.enterBidForPunk(0, { from: accounts[0], value: 1 })
    )
  }),
  it('attempt to bid with zero value', async function () {
    const contract = await CryptoPunksMarket.deployed()
    await expectThrow(
      contract.enterBidForPunk(1, { from: accounts[0], value: 0 })
    )
  }),
  it('do a real bid', async function () {
    const contract = await CryptoPunksMarket.deployed()
    const account0BalancePrev = await web3.eth.getBalance(accounts[0])
    await contract.enterBidForPunk(1, { from: accounts[0], value: 1000 })
    const account0Balance = await web3.eth.getBalance(accounts[0])
    compareBalance(account0BalancePrev, account0Balance, -1000)
  }),
  it('wrong address tries to cancel bid', async function () {
    const contract = await CryptoPunksMarket.deployed()
    await expectThrow(contract.withdrawBidForPunk(1, { from: accounts[2] }))
  }),
  it('cancel bid', async function () {
    const contract = await CryptoPunksMarket.deployed()
    const account0BalancePrev = await web3.eth.getBalance(accounts[0])
    await contract.withdrawBidForPunk(1, { from: accounts[0] })
    const account0Balance = await web3.eth.getBalance(accounts[0])
    compareBalance(account0BalancePrev, account0Balance, 1000)
    const bid = await contract.punkBids.call(1)
    // Make sure bid is cleared
    assert.equal(false, bid[0])
  }),
  it('do another real bid', async function () {
    const contract = await CryptoPunksMarket.deployed()
    const account0BalancePrev = await web3.eth.getBalance(accounts[0])
    await contract.enterBidForPunk(1, { from: accounts[0], value: 2000 })
    const account0Balance = await web3.eth.getBalance(accounts[0])
    compareBalance(account0BalancePrev, account0Balance, -2000)
  }),
  it('bid underneath an existing bid', async function () {
    const contract = await CryptoPunksMarket.deployed()
    await expectThrow(
      contract.enterBidForPunk(1, { from: accounts[2], value: 500 })
    )
  }),
  it('outbid', async function () {
    const contract = await CryptoPunksMarket.deployed()
    const account2BalancePrev = await web3.eth.getBalance(accounts[2])
    await contract.enterBidForPunk(1, { from: accounts[2], value: 3000 })
    // todo - check to see if A2's balance went down
    const account2Balance = await web3.eth.getBalance(accounts[2])
    compareBalance(account2BalancePrev, account2Balance, -3000)
    // Make sure A1 was refunded.
    const amount = await contract.pendingWithdrawals.call(accounts[0])
    assert.equal(2000, amount)
    // Make sure withdraw works
    await contract.withdraw({ from: accounts[0] })
    const newAmount = await contract.pendingWithdrawals.call(accounts[0])
    assert.equal(0, newAmount)
  }),
  it('wrong owner tries to accept bid', async function () {
    const contract = await CryptoPunksMarket.deployed()
    await expectThrow(
      contract.acceptBidForPunk(1, 3000, { from: accounts[0] })
    )
  }),
  it('try to accept bid for a punk that has no bid', async function () {
    const contract = await CryptoPunksMarket.deployed()
    await expectThrow(
      contract.acceptBidForPunk(0, 3000, { from: accounts[0] })
    )
  }),
  it('try to accept bid for a punk with too high an accept value', async function () {
    const contract = await CryptoPunksMarket.deployed()
    await expectThrow(
      contract.acceptBidForPunk(1, 4000, { from: accounts[1] })
    )
  }),
  it('accept bid from A2', async function () {
    const contract = await CryptoPunksMarket.deployed()

    var bid = await contract.punkBids.call(1)
    const currentOwner = await contract.punkIndexToAddress.call(1)
    console.log('Current owner: ' + currentOwner)
    console.log('Bid: ' + bid)
    await contract.acceptBidForPunk(1, 3000, { from: accounts[1] })
    console.log('Bid accepted')
    // Was A1 paid?
    const amount = await contract.pendingWithdrawals.call(accounts[1])
    assert.equal(3000, amount)
    // Does A2 own the punk
    const owner = await contract.punkIndexToAddress.call(1)
    assert.equal(owner, accounts[2])
    const balance1 = await contract.balanceOf.call(accounts[1])
    const balance2 = await contract.balanceOf.call(accounts[2])
    assert.equal(balance1, 0)
    assert.equal(balance2, 1)
    // Ensure bid object has been zeroed out
    var bid = await contract.punkBids.call(1)
    assert.equal(false, bid[0])
  }),
  it('offer up a punk for sale, then get a lower bid, accept that bid', async function () {
    const contract = await CryptoPunksMarket.deployed()
    await contract.offerPunkForSale(0, 9000, { from: accounts[0] })
    await contract.enterBidForPunk(0, { from: accounts[2], value: 5000 })
    await contract.acceptBidForPunk(0, 5000, { from: accounts[0] })
    // Make sure transaction went through at 5000 price level
    const balance0 = await contract.balanceOf.call(accounts[0])
    const balance2 = await contract.balanceOf.call(accounts[2])
    assert.equal(balance0, 0)
    assert.equal(balance2, 2)
    const owner = await contract.punkIndexToAddress.call(0)
    assert.equal(owner, accounts[2])
    const amount = await contract.pendingWithdrawals.call(accounts[0])
    assert.equal(5000, amount)
    // Ensure offer object has been zeroed out
    const offer = await contract.punksOfferedForSale.call(0)
    assert.equal(false, offer[0])
  })
})
