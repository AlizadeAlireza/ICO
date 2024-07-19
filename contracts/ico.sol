// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

// start to try turn this code to an oop code

error HvIco__payMoreEther(uint icoPrice);
error HvIco__AmountIsZero(uint amount);

contract HvICO is Ownable, ReentrancyGuard {
    ERC20 public immutable hvToken;

    // address[] public buyers;
    // account address ----> token count
    mapping(address => uint256) public addressToBuyer;

    using SafeMath for uint256;

    address public immutable treasury;

    uint256 public incomingAmount;
    uint256 public constant maxLimitToken = 10;
    uint256 public constant icoPrice = 0.1 ether;

    constructor(address _tokenAddress, address _treasury) {
        hvToken = ERC20(_tokenAddress);
        treasury = _treasury;
    }

    function buyTokenByETH() public payable nonReentrant {
        uint256 tokenPurchase = addressToBuyer[msg.sender]; // number of token
        if (tokenPurchase < maxLimitToken) {
            // get incoming amount => save gas
            incomingAmount = msg.value;
        }

        // require(incomingAmount >= icoPrice, "Invalid Amount");
        if (incomingAmount < icoPrice) {
            revert HvIco__payMoreEther(icoPrice);
        }

        // addressToBuyer[msg.sender] += (incomingAmount / icoPrice); // count of token
        // we say if incoming amount is greater than icoProce map the value.

        // if incoming amount is more than max incoming amount ( maxLimitToken * icoPrice ) ==> incomignAmount = max incoming amount;
        if (incomingAmount > (maxLimitToken - tokenPurchase) * icoPrice) {
            incomingAmount = (maxLimitToken - tokenPurchase) * icoPrice;
        }

        // now how much token user can buy ==> example : 1ether / 0.1 = 10 tokens;
        uint256 sendToTheUser = incomingAmount.div(icoPrice);

        addressToBuyer[msg.sender] += sendToTheUser;

        // require(tokenPurchase.add(sendToTheUser) <= maxLimitToken, "max limit reached");

        // get balance of address this for hvToken;
        uint256 contractTokenAmount = hvToken.balanceOf(address(this));

        // amount not zero
        if (contractTokenAmount == 0) {
            revert HvIco__AmountIsZero(contractTokenAmount);
        }

        if (sendToTheUser > contractTokenAmount) {
            sendToTheUser = contractTokenAmount;
            incomingAmount = sendToTheUser * icoPrice;
        }

        // transfer hvTokens to the user;
        require(hvToken.transfer(msg.sender, sendToTheUser), "error");

        // instantly transfer ether to the bank;
        (bool Ok, ) = treasury.call{value: incomingAmount}("");
        require(Ok, "error");

        // now if all msg.value is not spneded, we return back extra msg.value to the user !
        if (address(this).balance > 0) {
            (Ok, ) = msg.sender.call{value: address(this).balance}("");
            require(Ok, "error");
        }
    }
}
