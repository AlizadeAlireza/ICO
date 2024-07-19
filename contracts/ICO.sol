// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

error HvIco__payMoreEther(uint icoPrice);
error HvIco__AmountIsZero(uint amount);
error HvIco__ReachdToMaxLimit(address userAddress, uint maxAmount);

contract HvIco is Ownable, ReentrancyGuard {
    using SafeMath for uint256;

    /*
        variables
    */
    ERC20 public immutable hvToken;
    uint256 public incomingAmount;

    address public immutable treasury;

    uint256 public constant maxLimitToken = 10;
    uint256 public constant icoPrice = 0.1 ether;

    /*
        mappings
    */
    mapping(address => uint256) public userTokenBalance;

    /*
        constructor
    */
    constructor(address _tokenAddress, address _treasury) {
        hvToken = ERC20(_tokenAddress);
        treasury = _treasury;
    }

    /*
        main functions
    */
    /**
     * @notice buy the token with limitation
     * @dev the user send eth to buy the token, if the amount was more than limit or
     * contract capacity, will be calculated and return the true amount
     */

    function buyTokenByETH() public payable nonReentrant {
        uint tokenPurchase = _userTokenPurchaseBalance(msg.sender);

        if (tokenPurchase < maxLimitToken) {
            incomingAmount = msg.value;
        } else {
            revert HvIco__ReachdToMaxLimit(msg.sender, tokenPurchase);
        }

        _validateAmount(incomingAmount);

        _updatedAmountByMoreAmount(incomingAmount, tokenPurchase);

        // now how much token user can buy ==> example : 1ether / 0.1 = 10 tokens;
        // uint256 sendToTheUser = incomingAmount.div(icoPrice);
        uint sendToTheUserToken = _sendTokenToUserAmount(incomingAmount);

        // get balance of address this for hvToken;
        uint256 contractTokenAmount = hvToken.balanceOf(address(this));

        // amount not zero
        if (contractTokenAmount == 0) {
            revert HvIco__AmountIsZero(contractTokenAmount);
        }

        sendToTheUserToken = _validateAmountMoreThanCapacity(
            sendToTheUserToken,
            contractTokenAmount
        );

        // transfer hvTokens to the user;
        _sendTokenToUser(sendToTheUserToken);

        // instantly transfer ether to the bank
        _sendEthToTreasury();

        // transfer reamin amount to the user(extra amount for spended)
        if (address(this).balance > 0) {
            _notSpendedAmount();
        }
    }

    /*
    internal functions
    */
    /**
     * @notice validation of input amout.
     * @dev throw an custom error when the price isn't met.
     * @param _incomingAmount  is the amount that user entered.(msg.value)(ether value)
     */
    function _validateAmount(uint _incomingAmount) internal pure {
        if (_incomingAmount < icoPrice) {
            revert HvIco__payMoreEther(icoPrice);
        }
    }

    /**
     * @notice checking and updating to max limit
     * @dev when see input amount is greater, updated to the max limit
     * @param _incomingAmount is the amount that user entered.
     * @param _tokenPurchase is the number of user token.
     */
    function _updatedAmountByMoreAmount(uint _incomingAmount, uint _tokenPurchase) internal {
        if (_incomingAmount > (maxLimitToken - _tokenPurchase) * icoPrice) {
            incomingAmount = (maxLimitToken - _tokenPurchase) * icoPrice;
        }
    }

    /**
     * @notice getting the amount of the token
     * @dev we calculate the number of token that can be sent to the user
     * @param _incomingAmount is the amount that user entered.
     */
    function _sendTokenToUserAmount(uint _incomingAmount) internal pure returns (uint sendToUser) {
        uint256 sendToTheUser = _incomingAmount.div(icoPrice);
        return sendToTheUser;
    }

    /**
     * @notice getting the amount that can be sent updated
     * @dev calculate the number of sending token when the contract has the capacity or not.
     * updated the incoming amount and return it.
     * @param _sendToTheUserToken is the amount of token that user request
     * @param _contractTokenAmount is the balance of amount that the contract has.
     */
    function _validateAmountMoreThanCapacity(
        uint _sendToTheUserToken,
        uint _contractTokenAmount
    ) internal returns (uint sendToTheUser) {
        if (_sendToTheUserToken > _contractTokenAmount) {
            _sendToTheUserToken = _contractTokenAmount;
        }
        incomingAmount = _sendToTheUserToken * icoPrice;
        return _sendToTheUserToken;
    }

    /**
     * @dev sending the calculated amount to the user
     * @param _sendToTheUserToken is the calculated amount based on limit and capacity
     */

    function _sendTokenToUser(uint _sendToTheUserToken) internal {
        require(hvToken.transfer(msg.sender, _sendToTheUserToken), "error");
        userTokenBalance[msg.sender] += _sendToTheUserToken;
    }

    /**
     * @notice sending the amount of ether that user spend to buying token
     */
    function _sendEthToTreasury() internal {
        (bool Ok, ) = treasury.call{value: incomingAmount}("");
        require(Ok, "error");
    }

    /**
     * @notice send extra amount to the user
     * @dev after calculation of the token amount, the extra eth that user put it in,
     * return to his/her wallet
     */
    function _notSpendedAmount() internal {
        // now if all msg.value is not spneded, we return back extra msg.value to the user !

        (bool Ok, ) = msg.sender.call{value: address(this).balance}("");
        require(Ok, "error");
    }

    /*
        getter functions
    */
    function _userTokenPurchaseBalance(
        address _userAddress
    ) internal view returns (uint tokenPurchaseBalance) {
        return userTokenBalance[_userAddress];
    }
}
