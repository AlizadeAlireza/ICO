// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestToken is ERC20 {
    uint256 public constant _initialSupply = 20;

    // address public icoContractAddress;

    // uint256 decimals = decimals();

    constructor() /*address _icoContractAddress*/ ERC20("hearVerse Token", "HVC") {
        // icoContractAddress = _icoContractAddress;
        _mint(msg.sender, _initialSupply /* * (10 ** decimals())*/);
        // transfer(icoContractAddress, totalSupply());
    }
}
