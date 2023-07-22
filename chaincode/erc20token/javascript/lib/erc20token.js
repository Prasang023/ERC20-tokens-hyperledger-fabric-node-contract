/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const { Contract } = require('fabric-contract-api');
const { ClientIdentity } = require('fabric-shim');

class erc20token extends Contract {

    async initLedger(ctx) {
        console.log('---------- START : Initialize Ledger --------------');
        const tokenNameKey = 'My Token';
        const symbolKey = 'MTY';
        const totalSupplyKey = '0'; 
        await ctx.stub.putState('tokenNameKey', Buffer.from(JSON.stringify(tokenNameKey)));
        await ctx.stub.putState('symbolKey', Buffer.from(JSON.stringify(symbolKey)));
        await ctx.stub.putState('totalSupplyKey', Buffer.from(JSON.stringify(totalSupplyKey)));
        console.info('============= END : Initialize Ledger ===========');
    }

    async checkAccess(ctx) {
        let cid = new ClientIdentity(ctx.stub);
        console.log("cid: ", cid);
        if (!cid.assertAttributeValue('role', 'minter')) { 
            throw new Error('Not a valid user');
        }
        return true;
    }

    async symbol(ctx) {
        const symbolBytes = await ctx.stub.getState('symbolKey');
        return symbolBytes.toString();
    }

    async name(ctx) {
        const nameBytes = await ctx.stub.getState('tokenNameKey');
        return nameBytes.toString();
    }

    async totalSupply(ctx) {
        const totalSupplyBytes = await ctx.stub.getState('totalSupplyKey');       
        return totalSupplyBytes.toString();
    }

    async getWalletAddress(ctx) {
        return ctx.clientIdentity.getID();
    }

    async balanceOf(ctx, address){
        // const address = ctx.clientIdentity.getID();
        const balanceBytes = await ctx.stub.getState(address);
        console.info(balanceBytes.toString());
        return balanceBytes.toString();
    }

    async mint(ctx, amt) {

        let isApprover = await this.checkAccess(ctx);

        const amtInt = parseInt(amt);
        console.log("mint --- amount: ", amtInt);
        const address = ctx.clientIdentity.getID();
        console.log("mint --- address: ", address);

        const currentBalanceBytes = await ctx.stub.getState(address);
        let currentBalance;
        if (!currentBalanceBytes || currentBalanceBytes.length === 0) {
            currentBalance = 0;
        } else {
            currentBalance = parseInt(JSON.parse(currentBalanceBytes.toString()));
        }
        const updatedBalance = currentBalance + amtInt;
        console.log("mint --- Before writing updatedBalance: ",updatedBalance);
        await ctx.stub.putState(address, Buffer.from(JSON.stringify(updatedBalance.toString())));

        // Increase totalSupply
        const totalSupplyBytes = await ctx.stub.getState('totalSupplyKey');
        let totalSupply;
        if (!totalSupplyBytes || totalSupplyBytes.length === 0) {
            throw new Error('Contract not initalised');
        } else {
            totalSupply = parseInt(JSON.parse(totalSupplyBytes.toString()));
        }
        totalSupply = totalSupply + amtInt;
        await ctx.stub.putState('totalSupplyKey', Buffer.from(JSON.stringify(totalSupply.toString())));

        // Emit the Transfer event
        // const transferEvent = { from: '0x0', to: minter, value: amountInt };
        // ctx.stub.setEvent('Transfer', Buffer.from(JSON.stringify(transferEvent)));

        console.log(`minter account ${address} balance updated from ${currentBalance} to ${updatedBalance}`);
        return true;
        
    }

    async approve(ctx, spender, amt) {

        let owner = ctx.clientIdentity.getID();
        let isApprover = await this.checkAccess(ctx);
        if(checkUser) console.log("User Approved");

        let indexName = 'allowance';
        let allowanceKey = await ctx.stub.createCompositeKey(indexName, [owner, spender]);

        // let valueInt = parseInt(value);
        await ctx.stub.putState(allowanceKey, Buffer.from(amt.toString()));

        // Emit the Approval event
        const approvalEvent = { owner, spender, value: amt };
        ctx.stub.setEvent('Approval', Buffer.from(JSON.stringify(approvalEvent)));

        console.log('approve ended successfully');
        return true;
    }

    async allowance(ctx, owner, spender) {

        let indexName = 'allowance';
        const allowanceKey = await ctx.stub.createCompositeKey(indexName, [owner, spender]);

        const allowanceBytes = await ctx.stub.getState(allowanceKey);
        if (!allowanceBytes || allowanceBytes.length === 0) {
            throw new Error(`spender ${spender} has no allowance from ${owner}`);
        }

        const allowance = parseInt(JSON.parse(allowanceBytes.toString()));
        return allowance;
    }

    async transfer(ctx, to, value) {

        let isApprover = await this.checkAccess(ctx);
        const from = ctx.clientIdentity.getID();
        console.log("transfer-- from client ID: ", from);

        const transferResp = await this._transfer(ctx, from, to, value);
        if (!transferResp) {
            throw new Error('Failed to transfer');
        }

        // Emit the Transfer event
        const transferEvent = { from, to, value: parseInt(value) };
        ctx.stub.setEvent('Transfer', Buffer.from(JSON.stringify(transferEvent)));

        return true;
    }

    async _transfer(ctx, from, to, value) {

        if (from === to) {
            throw new Error('cannot transfer to and from same client account');
        }

        // Convert value from string to int
        const valueInt = parseInt(value);

        if (valueInt < 0) { // transfer of 0 is allowed in ERC20, so just validate against negative amounts
            throw new Error('transfer amount cannot be negative');
        }

        // Retrieve the current balance of the sender
        const fromCurrentBalanceBytes = await ctx.stub.getState(from);

        if (!fromCurrentBalanceBytes || fromCurrentBalanceBytes.length === 0) {
            throw new Error(`client account ${from} has no balance`);
        }
        console.log("checking from balance: ");
        const fromCurrentBalance = parseInt(JSON.parse(fromCurrentBalanceBytes.toString()));
        console.log(fromCurrentBalance);
        // Check if the sender has enough tokens to spend.
        if (fromCurrentBalance < valueInt) {
            throw new Error(`client account ${from} has insufficient funds.`);
        }

        // Retrieve the current balance of the recepient
        const toCurrentBalanceBytes = await ctx.stub.getState(to);

        let toCurrentBalance;
        // If recipient current balance doesn't yet exist, we'll create it with a current balance of 0
        if (!toCurrentBalanceBytes || toCurrentBalanceBytes.length === 0) {
            toCurrentBalance = 0;
        } else {
            toCurrentBalance = parseInt(JSON.parse(toCurrentBalanceBytes.toString()));
        }

        // Update the balance
        const fromUpdatedBalance = fromCurrentBalance-valueInt;
        const toUpdatedBalance = toCurrentBalance+valueInt;

        await ctx.stub.putState(from, Buffer.from(fromUpdatedBalance.toString()));
        await ctx.stub.putState(to, Buffer.from(toUpdatedBalance.toString()));

        console.log(`client ${from} balance updated from ${fromCurrentBalance} to ${fromUpdatedBalance}`);
        console.log(`recipient ${to} balance updated from ${toCurrentBalance} to ${toUpdatedBalance}`);

        return true;
    }

    async transferFrom(ctx, from, to, value) {
        let isApprover = await this.checkAccess(ctx);
        const spender = ctx.clientIdentity.getID();
        if(from[0] === '0') {
            await this.mint(ctx, value);
            return true;
        }
        // Retrieve the allowance of the spender
        let indexName = "allowance";
        const allowanceKey = ctx.stub.createCompositeKey(indexName, [from, spender]);
        const currentAllowanceBytes = await ctx.stub.getState(allowanceKey);

        if (!currentAllowanceBytes || currentAllowanceBytes.length === 0) {
            throw new Error(`spender ${spender} has no allowance from ${from}`);
        }

        const currentAllowance = parseInt(currentAllowanceBytes.toString());

        // Convert value from string to int
        const valueInt = parseInt(value);

        // Check if the transferred value is less than the allowance
        if (currentAllowance < valueInt) {
            throw new Error('The spender does not have enough allowance to spend.');
        }
        const transferResp = await this._transfer(ctx, from, to, value);
        if (!transferResp) {
            throw new Error('Failed to transfer');
        }

        // Decrease the allowance
        const updatedAllowance = currentAllowance-valueInt;
        await ctx.stub.putState(indexName, Buffer.from(updatedAllowance.toString()));
        console.log(`spender ${spender} allowance updated from ${currentAllowance} to ${updatedAllowance}`);

        // Emit the Transfer event
        const transferEvent = { from, to, value: valueInt };
        ctx.stub.setEvent('Transfer', Buffer.from(JSON.stringify(transferEvent)));

        console.log('transferFrom ended successfully');
        return true;
    }

}

module.exports = erc20token;