require("dotenv").config();
const { ethers } = require("ethers");
const chalk = require("chalk");
const inquirer = require("inquirer");

// —— TOKEN ADDRESSES ——
const TOKENS = {
  XRP:    "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
  RIBBIT: "0x73ee7BC68d3f07CfcD68776512b7317FE57E1939",
  RISE:   "0x0c28777DEebe4589e83EF2Dc7833354e6a0aFF85",
  WXRP:   "0x81Be083099c2C65b062378E74Fa8469644347BB7",
};

// Trading pairs
const ALL_PAIRS = [
  ["XRP","RIBBIT"],
  ["XRP","RISE"],
  ["XRP","WXRP"],
  ["RIBBIT","RISE"],
  ["RISE","WXRP"],
  ["WXRP","RIBBIT"],
];

// —— ABIs ——
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
];
const ROUTER_ABI = [
  "function swapExactTokensForTokens(uint amountIn,uint amountOutMin,address[] calldata path,address to,uint deadline) returns (uint[] memory)",
  "function swapExactETHForTokens(uint amountOutMin,address[] calldata path,address to,uint deadline) external payable returns (uint[] memory)",
  "function swapExactTokensForETH(uint amountIn,uint amountOutMin,address[] calldata path,address to,uint deadline) external returns (uint[] memory)",
  "function addLiquidityETH(address token,uint amountTokenDesired,uint amountTokenMin,uint amountETHMin,address to,uint deadline) external payable returns (uint amountToken,uint amountETH,uint liquidity)",
];

// —— CONFIG ——
const RPC_URL = process.env.RPC_URL || "https://rpc.testnet.xrplevm.org/";
const provider = new ethers.JsonRpcProvider(RPC_URL);
const EXPLORER_TX_URL = "https://explorer.testnet.xrplevm.org/tx/";

const ROUTER_ADDRESS        = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
const GAS_LIMIT_ERC20       = 65_000; // Optimized for ERC-20 transfers
const GAS_LIMIT_XRP         = 21_000; // Optimized for XRP/ETH transfers
const GAS_LIMIT_COMPLEX     = 200_000; // For swaps and liquidity
const DELAY_BETWEEN_SWAPS   = 200; // Reduced from 1,000 ms
const DELAY_BETWEEN_WALLETS = 500; // Reduced from 2,000 ms
const delay = ms => new Promise(r => setTimeout(r, ms));

// Retry helper
async function withRetry(fn, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (err.code === "TIMEOUT" && i < retries - 1) {
        console.warn(chalk.yellow(`RPC timeout, retry ${i+1}/${retries}…`));
        await delay(200);
      } else {
        throw err;
      }
    }
  }
}

// Gas price with 20% premium for faster confirmations
async function getGasPrice() {
  const fee = await provider.getFeeData();
  const baseGasPrice = fee.gasPrice || ethers.parseUnits("10", "gwei");
  return baseGasPrice + (baseGasPrice * BigInt(20)) / BigInt(100); // Add 20% premium
}

// Banner
const asciiBanner = [
  "██╗  ██╗    ██████╗     ██████╗     ██╗     ",
  "╚██╗██╔╝    ██╔══██╗    ██╔══██╗    ██║     ",
  " ╚███╔╝     ██████╔╝    ██████╔╝    ██║     ",
  " ██╔██╗     ██╔═══╝     ██╔══██╗    ██║     ",
  "██╔╝ ██╗    ██║         ██║  ██║    ███████╗",
  "╚═╝  ╚═╝    ╚═╝         ╚═╝  ╚═╝    ╚══════╝",
  "",
  "   XPRL Testnet Bot v3.0 - Created By Kazuha787",
  "           LET’S FUCK THIS TESTNET            ",
].join("\n");
function displayBanner() {
  console.clear();
  console.log(chalk.hex("#D8BFD8").bold(asciiBanner), "\n");
}

// Test RPC
async function testRpc() {
  displayBanner();
  console.log(chalk.gray("Testing RPC connection…"));
  try {
    const block = await withRetry(() => provider.getBlockNumber());
    console.log(chalk.green(`RPC OK. Current block: ${block}`));
  } catch (err) {
    console.error(chalk.red(`RPC failed: ${err.message}`));
    process.exit(1);
  }
}

// Balances
async function getWalletBalances(wallet) {
  const out = { address: wallet.address };
  out.XRP = ethers.formatEther(await provider.getBalance(wallet.address));
  for (const t of Object.keys(TOKENS).filter(x => x !== "XRP")) {
    try {
      const c = new ethers.Contract(TOKENS[t], ERC20_ABI, provider);
      const decs = await c.decimals();
      const bal  = await c.balanceOf(wallet.address);
      out[t] = ethers.formatUnits(bal, decs);
    } catch {
      out[t] = "Error";
    }
  }
  return out;
}
async function displayBalances(wallets) {
  displayBanner();
  console.log(chalk.hex("#D8BFD8").bold("--- Wallet Balances ---"));
  for (const w of wallets) {
    console.log(chalk.yellow.bold(`\n${w.address}`));
    const b = await getWalletBalances(w);
    for (const [tok, amt] of Object.entries(b).filter(x => x[0] !== "address")) {
      console.log(`  • ${tok.padEnd(6)} : ${amt}`);
    }
  }
  console.log();
  await inquirer.prompt([{ name: "dummy", type: "input", message: "Press Enter to continue…" }]);
}

// Swap
async function performSwap(wallet, pair, amount, direction) {
  const [A, B] = pair;
  const [inTok, outTok] = direction === "AtoB" ? [A, B] : [B, A];
  console.log(chalk.blue(`SWAP: ${amount} ${inTok} → ${outTok}`));

  const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, wallet);
  const path = [
    inTok === "XRP" ? TOKENS.WXRP : TOKENS[inTok],
    outTok === "XRP" ? TOKENS.WXRP : TOKENS[outTok]
  ];
  const deadline = Math.floor(Date.now() / 1e3) + 600;
  const gasPrice = await getGasPrice();

  if (inTok === "XRP") {
    const val = ethers.parseEther(amount);
    await withRetry(() =>
      router.swapExactETHForTokens(0, path, wallet.address, deadline, { value: val, gasLimit: GAS_LIMIT_COMPLEX, gasPrice })
    )
    .then(tx => {
      console.log(chalk.cyan(`Swap TX: ${EXPLORER_TX_URL}${tx.hash}`));
      return tx.wait();
    })
    .then(() => console.log(chalk.green("✔ Completed")));
  } else {
    const tokenC = new ethers.Contract(TOKENS[inTok], ERC20_ABI, wallet);
    const decs = await tokenC.decimals();
    const amt = ethers.parseUnits(amount, decs);

    await withRetry(() =>
      tokenC.approve(ROUTER_ADDRESS, amt, { gasLimit: GAS_LIMIT_ERC20, gasPrice })
    )
    .then(tx => {
      console.log(chalk.cyan(`Approve TX: ${EXPLORER_TX_URL}${tx.hash}`));
      return tx.wait();
    });

    const swapFn = outTok === "XRP"
      ? () => router.swapExactTokensForETH(amt, 0, path, wallet.address, deadline, { gasLimit: GAS_LIMIT_COMPLEX, gasPrice })
      : () => router.swapExactTokensForTokens(amt, 0, path, wallet.address, deadline, { gasLimit: GAS_LIMIT_COMPLEX, gasPrice });

    await withRetry(swapFn)
      .then(tx => {
        console.log(chalk.cyan(`Swap TX: ${EXPLORER_TX_URL}${tx.hash}`));
        return tx.wait();
      })
      .then(() => console.log(chalk.green("✔ Completed")));
  }
}

// Add Liquidity
async function performAddLiquidity(wallet, cfg) {
  console.log(chalk.blue(`ADD LIQUIDITY: ${cfg.lpTokenAmount} ${cfg.lpTokenName} + ${cfg.lpBaseAmount} XRP`));
  const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, wallet);
  const tokenC = new ethers.Contract(TOKENS[cfg.lpTokenName], ERC20_ABI, wallet);
  const decs = await tokenC.decimals();
  const amtTok = ethers.parseUnits(cfg.lpTokenAmount, decs);
  const amtEth = ethers.parseEther(cfg.lpBaseAmount);
  const gasPrice = await getGasPrice();

  await withRetry(() =>
    tokenC.approve(ROUTER_ADDRESS, amtTok, { gasLimit: GAS_LIMIT_ERC20, gasPrice })
  )
  .then(tx => {
    console.log(chalk.cyan(`Approve TX: ${EXPLORER_TX_URL}${tx.hash}`));
    return tx.wait();
  });

  await withRetry(() =>
    router.addLiquidityETH(
      TOKENS[cfg.lpTokenName], amtTok, 0, 0,
      wallet.address,
      Math.floor(Date.now() / 1e3) + 600,
      { value: amtEth, gasLimit: GAS_LIMIT_COMPLEX, gasPrice }
    )
  )
  .then(tx => {
    console.log(chalk.cyan(`Add LP TX: ${EXPLORER_TX_URL}${tx.hash}`));
    return tx.wait();
  })
  .then(() => console.log(chalk.green("✔ Liquidity Added")));
}

// Send Tokens (Random Send)
async function performRandomSend(wallet, cfg) {
  console.log(chalk.blue(`RANDOM SEND: ${cfg.sendAmount} ${cfg.sendTokenName} → ${cfg.sendAddressCount} addrs`));
  const tokenC = new ethers.Contract(TOKENS[cfg.sendTokenName], ERC20_ABI, wallet);
  const decs = await tokenC.decimals();
  const amt = ethers.parseUnits(cfg.sendAmount, decs);
  let nonce = await provider.getTransactionCount(wallet.address, "pending");
  const gasPrice = await getGasPrice();

  // Batch transactions
  const txPromises = [];
  for (let i = 0; i < cfg.sendAddressCount; i++) {
    const addr = ethers.Wallet.createRandom().address;
    txPromises.push(
      withRetry(() =>
        tokenC.transfer(addr, amt, { nonce: nonce++, gasLimit: GAS_LIMIT_ERC20, gasPrice })
      )
      .then(tx => ({
        address: addr,
        tx: tx,
      }))
      .catch(err => ({
        address: addr,
        error: err,
      }))
    );
  }

  const results = await Promise.all(txPromises);
  for (const result of results) {
    if (result.error) {
      console.error(chalk.red(`✖ Failed ${result.address}: ${result.error.message}`));
    } else {
      console.log(chalk.cyan(`Transfer TX: ${EXPLORER_TX_URL}${result.tx.hash}`));
      await result.tx.wait();
      console.log(chalk.green(`✔ Sent to ${result.address}`));
    }
  }
}

// Send and Receive Tokens
async function performSendAndReceive(wallet, cfg) {
  console.log(chalk.blue(`SEND & RECEIVE: ${cfg.sendAmount} ${cfg.sendTokenName} → ${cfg.sendAddressCount} accounts & back`));
  const tokenC = new ethers.Contract(TOKENS[cfg.sendTokenName], ERC20_ABI, wallet);
  const decs = await tokenC.decimals();
  const amt = ethers.parseUnits(cfg.sendAmount, decs);
  let nonce = await provider.getTransactionCount(wallet.address, "pending");
  const gasPrice = await getGasPrice();

  // Check wallet balance
  const walletBalance = await provider.getBalance(wallet.address);
  const totalXrpNeeded = BigInt(cfg.sendAddressCount) * ethers.parseEther("0.1");
  if (walletBalance < totalXrpNeeded) {
    throw new Error(`Insufficient XRP in wallet: ${ethers.formatEther(walletBalance)} XRP < ${ethers.formatEther(totalXrpNeeded)} XRP needed`);
  }

  // Generate new accounts
  const newWallets = Array.from({ length: cfg.sendAddressCount }, () => ethers.Wallet.createRandom());
  console.log(chalk.yellow(`Generated ${cfg.sendAddressCount} accounts:`));
  newWallets.forEach((w, i) => console.log(chalk.white(`  ${i + 1}) ${w.address}`)));

  // Step 1: Send tokens to new accounts
  console.log(chalk.blue("\nSending tokens to new accounts…"));
  const sendTxPromises = [];
  for (const newWallet of newWallets) {
    sendTxPromises.push(
      withRetry(() =>
        tokenC.transfer(newWallet.address, amt, { nonce: nonce++, gasLimit: GAS_LIMIT_ERC20, gasPrice })
      )
      .then(tx => ({
        address: newWallet.address,
        tx: tx,
      }))
      .catch(err => ({
        address: newWallet.address,
        error: err,
      }))
    );
  }

  let results = await Promise.all(sendTxPromises);
  for (const result of results) {
    if (result.error) {
      console.error(chalk.red(`✖ Failed ${result.address}: ${result.error.message}`));
    } else {
      console.log(chalk.cyan(`Transfer TX: ${EXPLORER_TX_URL}${result.tx.hash}`));
      await result.tx.wait();
      console.log(chalk.green(`✔ Sent to ${result.address}`));
    }
  }

  // Step 2: Fund new accounts with XRP for gas
  console.log(chalk.blue("\nFunding new accounts with XRP for gas…"));
  const xrpAmount = ethers.parseEther("0.1");
  const fundTxPromises = [];
  for (const newWallet of newWallets) {
    fundTxPromises.push(
      withRetry(() =>
        wallet.sendTransaction({
          to: newWallet.address,
          value: xrpAmount,
          nonce: nonce++,
          gasLimit: GAS_LIMIT_XRP,
          gasPrice,
        })
      )
      .then(tx => ({
        address: newWallet.address,
        tx: tx,
      }))
      .catch(err => ({
        address: newWallet.address,
        error: err,
      }))
    );
  }

  results = await Promise.all(fundTxPromises);
  for (const result of results) {
    if (result.error) {
      console.error(chalk.red(`✖ Failed funding ${result.address}: ${result.error.message}`));
    } else {
      console.log(chalk.cyan(`XRP Transfer TX: ${EXPLORER_TX_URL}${result.tx.hash}`));
      await result.tx.wait();
      console.log(chalk.green(`✔ Funded ${result.address} with 0.1 XRP`));
    }
  }

  // Step 3: Send tokens back from new accounts to original wallet
  console.log(chalk.blue("\nReceiving tokens back from new accounts…"));
  const returnTxPromises = [];
  for (const newWallet of newWallets) {
    const newWalletWithProvider = new ethers.Wallet(newWallet.privateKey, provider);
    const newTokenC = new ethers.Contract(TOKENS[cfg.sendTokenName], ERC20_ABI, newWalletWithProvider);
    const newNonce = await provider.getTransactionCount(newWallet.address, "pending");

    // Check balance before attempting transfer
    const balance = await provider.getBalance(newWallet.address);
    const estimatedGasCost = gasPrice * BigInt(GAS_LIMIT_ERC20);
    if (balance < estimatedGasCost) {
      console.error(chalk.red(`✖ Skipping ${newWallet.address}: Insufficient XRP balance (${ethers.formatEther(balance)} XRP < ${ethers.formatEther(estimatedGasCost)} XRP)`));
      continue;
    }

    returnTxPromises.push(
      withRetry(() =>
        newTokenC.transfer(wallet.address, amt, { nonce: newNonce, gasLimit: GAS_LIMIT_ERC20, gasPrice })
      )
      .then(tx => ({
        address: newWallet.address,
        tx: tx,
      }))
      .catch(err => ({
        address: newWallet.address,
        error: err,
      }))
    );
  }

  results = await Promise.all(returnTxPromises);
  for (const result of results) {
    if (result.error) {
      console.error(chalk.red(`✖ Failed return from ${result.address}: ${result.error.message}`));
    } else {
      console.log(chalk.cyan(`Return TX: ${EXPLORER_TX_URL}${result.tx.hash}`));
      await result.tx.wait();
      console.log(chalk.green(`✔ Received back from ${result.address}`));
    }
  }
}

// CLI Menu
async function runMenu(wallets) {
  while (true) {
    displayBanner();
    const { action } = await inquirer.prompt([{
      name: "action", type: "list", message: "Select action:", choices: [
        { name: "1) Perform Swaps",  value: "swap" },
        { name: "2) Add Liquidity",  value: "liquidity" },
        { name: "3) Send Tokens",    value: "send" },
        { name: "4) Check Balances", value: "balances" },
        { name: "5) Exit",           value: "exit" },
      ]
    }]);
    if (action === "exit") { console.log(chalk.red("Goodbye!")); process.exit(0); }
    if (action === "balances") {
      await displayBalances(wallets);
      continue;
    }

    // Initialize cfgObj early to avoid reference errors
    let cfgObj = {
      sendType: "",
      swapCount: 0,
      swapAmount: "0",
      lpBaseAmount: "0",
      lpTokenAmount: "0",
      lpBaseTokenName: action === "liquidity" ? "XRP" : "",
      lpTokenName: action === "liquidity" ? "WXRP" : "",
      sendTokenName: "WXRP",
      sendAddressCount: 0,
      sendAmount: "0",
    };

    const qs = [];
    if (action === "send") {
      const { sendType } = await inquirer.prompt([{
        name: "sendType", type: "list", message: "Select send type:", choices: [
          { name: "1) Send and Receive", value: "sendAndReceive" },
          { name: "2) Random Send", value: "randomSend" },
        ]
      }]);
      cfgObj.sendType = sendType;
      qs.push(
        { name: "sendAddressCount", type: "input", message: "Number of transfers?", default: sendType === "sendAndReceive" ? "10" : "1" },
        { name: "sendAmount", type: "input", message: "Amount per transfer?", default: "0.0001" }
      );
    } else if (action === "swap") {
      qs.push(
        { name: "swapCount", type: "input", message: "Swaps per wallet?", default: "2" },
        { name: "swapAmount", type: "input", message: "Amount each swap?", default: "10" }
      );
    } else if (action === "liquidity") {
      qs.push(
        { name: "lpBaseAmount", type: "input", message: "XRP amount for LP?", default: "0.001" },
        { name: "lpTokenAmount", type: "input", message: "Token amount for LP?", default: "5" }
      );
    }

    displayBanner();
    console.log(chalk.hex("#D8BFD8").bold(`--- Configuring ${action} ---`));
    const cfg = await inquirer.prompt(qs);

    // Update cfgObj with user inputs
    cfgObj = {
      ...cfgObj,
      swapCount: parseInt(cfg.swapCount, 10) || 0,
      swapAmount: cfg.swapAmount || "0",
      lpBaseAmount: cfg.lpBaseAmount || "0",
      lpTokenAmount: cfg.lpTokenAmount || "0",
      sendAddressCount: parseInt(cfg.sendAddressCount, 10) || 0,
      sendAmount: cfg.sendAmount || "0",
    };

    displayBanner();
    console.log(chalk.hex("#D8BFD8").bold(`--- Executing ${action} ---`));
    for (const w of wallets) {
      console.log(chalk.yellow(`\nWallet: ${w.address}`));
      try {
        if (action === "send") {
          if (cfgObj.sendType === "sendAndReceive") {
            await performSendAndReceive(w, cfgObj);
          } else if (cfgObj.sendType === "randomSend") {
            await performRandomSend(w, cfgObj);
          }
        } else if (action === "swap") {
          for (let i = 0; i < cfgObj.swapCount; i++) {
            console.log(chalk.gray(`Swap #${i+1}`));
            const pair = ALL_PAIRS[Math.floor(Math.random() * ALL_PAIRS.length)];
            const direction = Math.random() < 0.5 ? "AtoB" : "BtoA";
            await performSwap(w, pair, cfgObj.swapAmount, direction);
            await delay(DELAY_BETWEEN_SWAPS);
          }
        } else if (action === "liquidity") {
          await performAddLiquidity(w, cfgObj);
        }
      } catch (err) {
        console.error(chalk.red(`Action failed: ${err.message}`));
      }
      await delay(DELAY_BETWEEN_WALLETS);
    }
    console.log(chalk.green(`\n✔ Completed ${action} for all wallets`));
    console.log();
    await inquirer.prompt([{ name: "dummy", type: "input", message: "Press Enter…" }]);
  }
}

// Main
async function main() {
  displayBanner();
  console.log(chalk.hex("#D8BFD8").bold("Initializing Pharos Testnet Bot v3.0…"));
  await testRpc();

  const keys = Object.entries(process.env)
    .filter(([k]) => k.startsWith("PRIVATE_KEY_"))
    .map(([,v]) => v);
  if (!keys.length) {
    console.error(chalk.red("No PRIVATE_KEY_ found in .env"));
    process.exit(1);
  }

  console.log(chalk.hex("#D8BFD8").bold(`\nLoaded ${keys.length} key(s):`));
  const wallets = keys.map(k => new ethers.Wallet(k, provider));
  wallets.forEach((w,i) => console.log(chalk.white(`${i+1}) ${w.address}`)));

  await runMenu(wallets);
}

process.on("SIGINT", () => {
  console.log(chalk.red("\nInterrupted — exiting."));
  process.exit(0);
});

main().catch(err => {
  console.error(chalk.red(`Fatal: ${err.message}`));
  process.exit(1);
});
