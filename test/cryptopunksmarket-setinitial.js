require('babel-polyfill')
const CryptoPunksMarket = artifacts.require('./CryptoPunksMarket.sol')

contract('CryptoPunksMarket-setInitial', function (accounts) {
  it('Should start with 0 balance', async function () {
    const contract = await CryptoPunksMarket.deployed()

    await contract.setInitialOwner(accounts[0], 0)
    const balance = await contract.balanceOf.call(accounts[0])
    assert.equal(balance.valueOf(), 1, "Didn't get the initial punk")
    const owner = await contract.punkIndexToAddress.call(0)
    assert.equal(owner, accounts[0], 'Ownership array wrong')
    const remaining = await contract.punksRemainingToAssign.call()
    assert.equal(9999, remaining)

    // todo Set this back to 10000 for final runs
    const assignCoins = 100
    for (let i = 1; i < assignCoins; i++) {
      await contract.setInitialOwner(accounts[0], i)
    }

    const remainingAfter = await contract.punksRemainingToAssign.call()
    assert.equal(10000 - assignCoins, remainingAfter)
    const balanceAfter = await contract.balanceOf.call(accounts[0])
    assert.equal(assignCoins, balanceAfter)
  }),
  it('bulk assign', async function () {
    const contract = await CryptoPunksMarket.deployed()
    const owners = [
      accounts[0],
      accounts[1],
      accounts[2],
      accounts[3],
      accounts[4],
      accounts[5],
      accounts[6],
      accounts[7],
      accounts[8],
      accounts[9]
    ]
    const punks = [
      1000, 1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008, 1009
    ]
    await contract.setInitialOwners(owners, punks)
    for (let i = 0; i < 10; i++) {
      const currentOwner = await contract.punkIndexToAddress.call(punks[i])
      assert.equal(currentOwner, owners[i])
    }
    const remainingAfter = await contract.punksRemainingToAssign.call()
    assert.equal(10000 - 110, remainingAfter)
  }),
  it('can not pass an invalid index to assign initial', async function () {
    const contract = await CryptoPunksMarket.deployed()
    try {
      await contract.setInitialOwner(accounts[0], 10000)
      assert(false, 'Should have thrown exception.')
    } catch (err) {
      // Should catch an exception
    }
  }),
  it('only owner can assign initial', async function () {
    const contract = await CryptoPunksMarket.deployed()
    try {
      await contract.setInitialOwner(accounts[1], 1)
      assert(false, 'Should have thrown exception.')
    } catch (err) {
      // Should catch an exception
    }
  }),
  it('Can not claim punk after set initial owners assigned', async function () {
    const contract = await CryptoPunksMarket.deployed()
    await contract.allInitialOwnersAssigned()
    try {
      await contract.setInitialOwner(accounts[0], 0)
      assert(false, 'Should have thrown exception.')
    } catch (err) {
      // Should catch an exception
    }
  })
})
