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

contract('CryptoPunksMarket-transferPunk', function (accounts) {
  it('can not get transfer punk allPunksAssigned = false', async function () {
    const contract = await CryptoPunksMarket.deployed()
    await contract.setInitialOwner(accounts[0], 0)
    const allAssigned = await contract.allPunksAssigned.call()
    assert.equal(false, allAssigned, 'allAssigned should be false to start.')
    await expectThrow(contract.transferPunk(accounts[1], 0))
  }),
  it('can transfer a punk to someone else', async function () {
    const contract = await CryptoPunksMarket.deployed()

    // Initial owner set in previous test :|
    // await contract.setInitialOwner(accounts[0], 0);
    await contract.allInitialOwnersAssigned()
    await contract.transferPunk(accounts[1], 0)

    const owner = await contract.punkIndexToAddress.call(0)
    assert.equal(owner, accounts[1], 'Punk not owned by transfer recipient')

    const balance = await contract.balanceOf.call(accounts[0])
    // console.log("Balance acc0: " + balance);
    assert.equal(balance.valueOf(), 0, 'Punk balance account 0 incorrect')
    const balance1 = await contract.balanceOf.call(accounts[1])
    // console.log("Balance acc1: " + balance1);
    assert.equal(balance1.valueOf(), 1, 'Punk balance account 1 incorrect')
  }),
  it("can not transfer someone else's punk", async function () {
    const contract = await CryptoPunksMarket.deployed()
    await expectThrow(contract.transferPunk(accounts[2], 0)) // Now owned by account[1]
  }),
  it('can not use invalid punk index', async function () {
    const contract = await CryptoPunksMarket.deployed()
    await expectThrow(contract.transferPunk(accounts[1], 10000))
  })
})
