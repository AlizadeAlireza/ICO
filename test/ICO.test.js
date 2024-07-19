const { assert, expect } = require("chai")
const { deployments, ethers, getNamedAccounts, network } = require("hardhat")
const { developmentChain, networkConfig } = require("../helper-hardhat-config")

describe("ICO Contract", () => {
    let contract, tokenContract
    let owner, user1, user2, user3, treasury
    const MAX_LIMIT_TOKEN = 10
    const ICO_PRICE = ethers.utils.parseEther("0.1")
    const DECIMALS = 18

    beforeEach(async () => {
        const accounts = await ethers.getSigners()
        owner = accounts[0]
        user1 = accounts[1]
        user2 = accounts[2]
        user3 = accounts[3]
        treasury = accounts[4]

        // token contract for our constructor
        const TokenContract = await ethers.getContractFactory("TestToken")
        tokenContract = await TokenContract.deploy()
        await tokenContract.deployed()

        // ico contract
        const IcoContract = await ethers.getContractFactory("HvIco")
        contract = await IcoContract.deploy(tokenContract.address, treasury.address)
        await contract.deployed()

        // transfer the all amount to this contract(ICO contract)
        await tokenContract.transfer(contract.address, tokenContract.totalSupply())
    })
    describe("deployment and equality to our variables", async () => {
        it("should equal to our contract variables", async () => {
            const contractTokenLimit = await contract.maxLimitToken()
            const hvTokenAddress = await contract.hvToken()
            const totalSupply = Number(await tokenContract.totalSupply())
            const expectedSupply = Number(
                await tokenContract._initialSupply() /** 10 ** DECIMALS*/
            )

            expect(MAX_LIMIT_TOKEN).to.equal(contractTokenLimit)
            expect(tokenContract.address).to.equal(hvTokenAddress)
            expect(totalSupply).to.equal(expectedSupply)
        })
    })
    describe("buying with ETH", async () => {
        it("expect when we send lesser eth than icoPrice, we get an error for this", async () => {
            const incomingAmountLesser = ethers.utils.parseEther("0.01")

            await expect(contract.buyTokenByETH({ value: incomingAmountLesser }))
                .to.be.revertedWithCustomError(contract, "HvIco__payMoreEther")
                .withArgs(ICO_PRICE)

            // buy a token and we expect not getting any errors
            const treasuryBalanceBefore = await ethers.provider.getBalance(contract.treasury())
            console.log(`treasury amount before: ${treasuryBalanceBefore}`)

            await contract.buyTokenByETH({ value: ICO_PRICE })

            const treasuryBalanceAfter = await ethers.provider.getBalance(contract.treasury())

            expect(treasuryBalanceAfter).to.equal(treasuryBalanceBefore.add(ICO_PRICE))
        })
        it("expect when we(user) send more than limit, we don't get error and set amount to ", async () => {
            const incomingAmountGreater = ethers.utils.parseEther("2")

            expect(await contract.buyTokenByETH({ value: incomingAmountGreater }))
        })
        it("We expect when he spends more, Return the extra amount", async () => {
            const incomingAmountGreater = ethers.utils.parseEther("2")

            // user balance of eth and token balance before tx
            const beforeUserBalance = Number(
                ethers.utils.formatEther(await ethers.provider.getBalance(user1.address))
            )
            console.log(`       user balance before tx is: ${beforeUserBalance} of Eth`)

            console.log(
                `the amount of tokens before tx: ${await tokenContract.balanceOf(
                    contract.address
                )}`
            )

            // spend for the contract and balances before and after

            // tx
            await contract.connect(user1).buyTokenByETH({ value: incomingAmountGreater })

            // user balance of eth and token balance after tx
            const afterUserBalance = Number(
                ethers.utils.formatEther(await ethers.provider.getBalance(user1.address))
            )

            console.log(`       user balance after tx is: ${afterUserBalance} of Eth`)

            expect(beforeUserBalance).to.gt(afterUserBalance)
            expect(afterUserBalance).to.lt(beforeUserBalance)

            console.log(
                `the amount of tokens after tx: ${await tokenContract.balanceOf(contract.address)}`
            )

            // we can assertion gas amount and fee to this test

            // maybe later we do this
        })

        it("We expect when he spends more, Return the extra amount(V2)", async () => {
            const incomingAmountGreater = ethers.utils.parseEther("2")

            const beforeUserBalance = Number(
                ethers.utils.formatEther(await ethers.provider.getBalance(user2.address))
            )

            const tx = await contract
                .connect(user2)
                .buyTokenByETH({ value: incomingAmountGreater })

            // getting the gas fee
            const txReceipt = await tx.wait(1)
            const { gasUsed, effectiveGasPrice } = txReceipt
            const gasCost = gasUsed.mul(effectiveGasPrice)
            console.log(`gasCost: ${gasCost}`)

            const afterUserBalance = Number(
                ethers.utils.formatEther(await ethers.provider.getBalance(user1.address))
            )

            // expect the before balance equal to afterBalance + fee + amount
            // expect(beforeUserBalance.toString()).to.equal(
            //     afterUserBalance + gasCost +
            // )

            // expect the after balance equal to (beforBalance - fee - amount)
        })
        it("when a user have enough money and have limitness, but the contract hasn't enough token", async () => {
            /*
            for this section we can imagine we have 20 tokens.
            a user bought the 10 token
            another user bought the 5 token
            -----------------------------------
            in prevoius tests we worked on the some aspects like:
            
            - can't buying lesser than 1 token price.
            - buying greater than the limit.
            -----------------------------------

            in this section of test:
            The user wants to buy tokens of her/his own range, but the contract hasn't 
            enough token.

            so after this situation, the extra amount return to her/his wallet
            */

            const amount1 = ethers.utils.parseEther("1")
            const amount2 = ethers.utils.parseEther("0.5")

            const tx1 = await contract.connect(user1).buyTokenByETH({ value: amount1 })
            console.log(
                `the amount of tokens after tx1: ${await tokenContract.balanceOf(
                    contract.address
                )}`
            )

            const tx2 = await contract.connect(user2).buyTokenByETH({ value: amount2 })
            console.log(
                `the amount of tokens after tx2: ${await tokenContract.balanceOf(
                    contract.address
                )}`
            )

            const tx3 = await contract.connect(user3).buyTokenByETH({ value: amount1 })
            // send 1 ether but the contract had just 5 token, so buy just 5 token
            console.log(
                "the amount of user balance",
                ethers.utils.formatEther(await ethers.provider.getBalance(user3.address))
            )
        })
        it("expect an error when want buying with 0 supply of contract", async () => {
            const incomingAmount = ethers.utils.parseEther("1")
            await contract.buyTokenByETH({ value: incomingAmount })
            await contract.connect(user3).buyTokenByETH({ value: incomingAmount })

            // after two purchase with 1 ether expect the supply is zero

            const remainToken = Number(await tokenContract.balanceOf(contract.address))
            console.log(`remain token is: ${remainToken}`)

            await expect(contract.connect(user2).buyTokenByETH({ value: incomingAmount }))
                .revertedWithCustomError(contract, "HvIco__AmountIsZero")
                .withArgs(0)
        })
        it("expect an error when a user want to buying more than his/her max limit", async () => {
            // buy the max
            const incomingAmount = ethers.utils.parseEther("1")
            await contract.buyTokenByETH({ value: incomingAmount })

            // buy over the max limit
            await expect(contract.buyTokenByETH({ value: incomingAmount }))
                .revertedWithCustomError(contract, "HvIco__ReachdToMaxLimit")
                .withArgs(owner.address, MAX_LIMIT_TOKEN)
        })
        describe("token transferring", () => {
            it("should transfer the token correctly", async () => {
                // get the current contract balance
                const contractBalanceBefore = await ethers.provider.getBalance(contract.address)
                const contractTokenBefore = await tokenContract.balanceOf(contract.address)

                // treasury balance before
                const treasuryBalanceBefore = await ethers.provider.getBalance(treasury.address)

                // buy some token
                const incomingAmount = ethers.utils.parseEther("2")
                const tx = await contract.buyTokenByETH({ value: incomingAmount })

                // get the current contract balance
                const contractBalanceAfter = await ethers.provider.getBalance(contract.address)

                // check the tokens were transfer correctly
                const buyerTokenBalance = await tokenContract.balanceOf(owner.address)
                console.log(`buyer token balance: ${buyerTokenBalance}`)
                expect(buyerTokenBalance).to.equal(MAX_LIMIT_TOKEN)

                // check the incoming amount updated
                const updatedIncomingAmount = await contract.incomingAmount()
                // const updatedIncomingAmountToEth = ethers.utils.parseEther(updatedIncomingAmount)
                expect(updatedIncomingAmount).to.equal(ethers.utils.parseEther("1"))

                // check that the eth was transferred to the treasury
                const treasuryBalanceAfter = await ethers.provider.getBalance(treasury.address)
                expect(treasuryBalanceAfter).to.equal(
                    treasuryBalanceBefore.add(updatedIncomingAmount)
                )

                // check the ramaining ether was returned to the buyer
                const buyerBalance = await ethers.provider.getBalance(owner.address)
                expect(buyerBalance).to.be.above(contractBalanceAfter)

                // after buying more than limit, we must have the all token - max limit token
                const contractTokenAfter = await tokenContract.balanceOf(contract.address)
                console.log(`token of contract : ${contractTokenAfter}`)

                expect(contractTokenAfter).to.equal(contractTokenBefore - buyerTokenBalance)

                // -------------------------------------------------------------------------------

                // after another buy, we must expect the incoming amount is updated again to token value
                const amount = ethers.utils.parseEther("0.5")
                const tx2 = await contract.connect(user1).buyTokenByETH({ value: amount })

                const tx2ContractToken = await tokenContract.balanceOf(contract.address)
                expect(tx2ContractToken).to.equal(contractTokenAfter - 5)
                const contractTokenAfterTx2 = await tokenContract.balanceOf(contract.address)
                console.log(`token of contract after tx2 : ${contractTokenAfterTx2}`)

                // -------------------------------------------------------------------------------

                // third buy, the amount must be updated to the remaining amount
                const contractTokenBeforeTx3 = await tokenContract.balanceOf(contract.address)
                console.log(`token of contract before tx 3 : ${contractTokenBeforeTx3}`)
                const tx3 = await contract.connect(user2).buyTokenByETH({ value: incomingAmount }) // expect remaining 0

                // updated amount when we have own limit range, nut contract hasn't enough token
                // get the updated amount
                const tx3AmountUpdatedInWei = await contract.incomingAmount()
                const tx3AmountUpdatedInEth = ethers.utils.formatEther(tx3AmountUpdatedInWei)
                const tx3ContractTokenAmount = await tokenContract.balanceOf(contract.address)

                console.log(`amount of price after tx3 : ${tx3AmountUpdatedInWei} in wei`)
                console.log(`amount of price after tx3 : ${tx3AmountUpdatedInEth} in eth`)
                console.log("remain token of contract after tx3: ", Number(tx3ContractTokenAmount))

                // console.log("updated amount: ", tx3AmountUpdated)

                expect(tx3ContractTokenAmount).to.equal(
                    contractTokenBeforeTx3 - contractTokenAfterTx2
                )

                // expect(tx3AmountUpdated).to.equal(Number(ethers.utils.parseEther("0.5")))
            })
        })
    })
    describe("after adding limit", () => {
        const incomingAmount = ethers.utils.parseEther("1")
        const incomingAmountGreater = ethers.utils.parseEther("2")
        const incomingAmountLesser = ethers.utils.parseEther("0.5")
        it("have max limit after buying with extra value", async () => {
            await contract.buyTokenByETH({ value: incomingAmountGreater })
            const tokenPurchase = await contract.userTokenBalance(owner.address)

            expect(tokenPurchase).to.equal(MAX_LIMIT_TOKEN)
        })
        it("expecting to purchase equal to limit when stake more eth", async () => {
            // first purchase token
            await contract.buyTokenByETH({ value: incomingAmountLesser })

            // first token amount
            const firstTokenAmount = await contract.userTokenBalance(owner.address)

            // second purchase token with extra limit
            await contract.buyTokenByETH({ value: incomingAmountGreater })

            // second tokenAmount
            const secondTokenAmount = await contract.userTokenBalance(owner.address)

            expect(secondTokenAmount).to.equal(MAX_LIMIT_TOKEN)
        })
        it("update with remaining contract token", async () => {
            // first purchase token ---> 10
            await contract.buyTokenByETH({ value: incomingAmount })

            // second purchase token ---> 5
            await contract.connect(user1).buyTokenByETH({ value: incomingAmountLesser })

            // third purchase with extra amount
            await contract.connect(user2).buyTokenByETH({ value: incomingAmountGreater })

            console.log(
                `the amount of tokens after tx: ${await tokenContract.balanceOf(contract.address)}`
            )
            await contract.connect(user3).buyTokenByETH({ value: incomingAmountGreater })
            const ownerTokenBalance = await contract.userTokenBalance(owner.address)
            const user1TokenBalance = await contract.userTokenBalance(user1.address)
            const user2TokenBalance = await contract.userTokenBalance(user2.address)
            console.log(ownerTokenBalance)
            console.log(user1TokenBalance)
            console.log(user2TokenBalance)
            // expect(user2TokenBalance).to.equal(5)
        })
        it("expect throw an error when the contract amount is zero instead update to remain amount", async () => {
            // purchase with enough amount
            await contract.buyTokenByETH({ value: incomingAmount })

            // purchase with extra amount
            await contract.connect(user2).buyTokenByETH({ value: incomingAmountGreater })
            // const remainToken = Number(await tokenContract.balanceOf(contract.address))
            // console.log(remainToken)
            await expect(contract.connect(user3).buyTokenByETH({ value: incomingAmount }))
                .revertedWithCustomError(contract, "HvIco__AmountIsZero")
                .withArgs(0)
        })
    })
})
