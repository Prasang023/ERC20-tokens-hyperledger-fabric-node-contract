/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const erc20token = require('./lib/erc20token');

module.exports.erc20token = erc20token;
module.exports.contracts = [ erc20token ];
