const ConvertLib = artifacts.require('./ConvertLib.sol')
const CryptoPunks = artifacts.require('./CryptoPunks.sol')
const CryptoPunksMarket = artifacts.require('./CryptoPunksMarket.sol')

module.exports = function (deployer) {
  deployer.deploy(ConvertLib)
  deployer.link(ConvertLib, CryptoPunks)
  deployer.deploy(CryptoPunks)
  deployer.deploy(CryptoPunksMarket)
}
