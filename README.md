
---

# XPRL Testnet Bot v3.0

A robust and feature-rich bot for interacting with the **XPRL EVM Sidechain Testnet**, designed to automate token swaps, liquidity addition, token transfers, and balance checks. Built with **Node.js**, **Ethers.js**, and other dependencies, this script is optimized for performance and reliability on the XPRL testnet environment.

**Created by Kazuha787** | [Join our Telegram Community](https://t.me/Offical_Im_kazuha)

---

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [File Structure](#file-structure)
- [Usage](#usage)
- [Configuration](#configuration)
- [Available Actions](#available-actions)
- [Dependencies](#dependencies)
- [Error Handling](#error-handling)
- [Contributing](#contributing)
- [Support](#support)
- [License](#license)

---

## Features

- **Token Swaps**: Perform automated token swaps on Uniswap-like routers with customizable amounts and trading pairs.
- **Liquidity Provision**: Add liquidity to token pairs (XRP + ERC-20 tokens) on the XPRL testnet.
- **Token Transfers**:
  - **Random Send**: Send tokens to randomly generated addresses.
  - **Send and Receive**: Send tokens to new accounts and retrieve them back to the original wallet.
- **Balance Checks**: Display wallet balances for XRP and supported ERC-20 tokens.
- **Optimized Gas Usage**: Configurable gas limits and dynamic gas pricing with a 20% premium for faster confirmations.
- **Retry Mechanism**: Handles RPC timeouts with configurable retries for robust execution.
- **Interactive CLI**: User-friendly command-line interface powered by `inquirer` for action selection and configuration.
- **Colorized Output**: Enhanced console output using `chalk` for better readability.
- **Multi-Wallet Support**: Execute actions across multiple wallets loaded from environment variables.

---

## Prerequisites

Before running the bot, ensure you have the following:

- **Node.js**: Version 16.x or higher.
- **npm**: Node package manager for installing dependencies.
- **XPRL Testnet RPC**: A valid RPC URL (default: `https://rpc.testnet.xrplevm.org/`).
- **Private Keys**: Wallet private keys stored in a `.env` file (format: `PRIVATE_KEY_1`, `PRIVATE_KEY_2`, etc.).
- **Testnet Tokens**: Sufficient XRP and ERC-20 tokens (RIBBIT, RISE, WXRP) for testing.
- **Git**: For cloning the repository (optional).

---

## Installation

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/Kazuha787/Xprl-Auto-Bot.git
   cd Xprl-Auto-Bot
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Set Up Environment Variables**:
   Create a `.env` file in the project root and add your private keys and optional RPC URL:
   ```env
   PRIVATE_KEY_1=0xyour_private_key_here
   ```

4. **Run the Bot**:
   ```bash
   node index.js
   ```

---

## File Structure

The project follows a clean and modular structure:

```
xprl-testnet-bot/
├── index.js              # Main script with bot logic
├── .env                  # Environment variables (private keys, RPC URL)
├── package.json          # Project metadata and dependencies
├── package-lock.json     # Dependency lock file
├── README.md             # Project documentation (this file)
└── node_modules/         # Installed dependencies
```

- **`index.js`**: Core script containing the bot's logic, including wallet management, swaps, liquidity addition, and token transfers.
- **`.env`**: Stores sensitive information like private keys and RPC URL. **Never commit this file to version control.**
- **`package.json`**: Defines the project, scripts, and dependencies.
- **`README.md`**: Comprehensive documentation for setup, usage, and contribution.

---

## Usage

1. **Start the Bot**:
   Run the script to initialize the bot and test the RPC connection:
   ```bash
   node index.js
   ```

2. **Interact with the CLI**:
   - The bot displays a colorful ASCII banner and tests the RPC connection.
   - Choose an action from the interactive menu:
     - **Perform Swaps**: Execute token swaps across defined trading pairs.
     - **Add Liquidity**: Add liquidity to token pairs (e.g., XRP/WXRP).
     - **Send Tokens**: Perform random or send-and-receive token transfers.
     - **Check Balances**: View wallet balances for XRP and ERC-20 tokens.
     - **Exit**: Terminate the bot.

3. **Configure Actions**:
   - For swaps: Specify the number of swaps per wallet and the amount per swap.
   - For liquidity: Input the XRP and token amounts for the liquidity pool.
   - For token transfers: Choose the send type (random or send-and-receive), number of transfers, and amount per transfer.

4. **Monitor Output**:
   - Transactions are logged with links to the XPRL testnet explorer.
   - Success and error messages are color-coded for clarity.

---

## Configuration

The bot is pre-configured with the following settings, which can be modified in `index.js`:

- **Token Addresses**:
  ```javascript
  const TOKENS = {
    XRP: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
    RIBBIT: "0x73ee7BC68d3f07CfcD68776512b7317FE57E1939",
    RISE: "0x0c28777DEebe4589e83EF2Dc7833354e6a0aFF85",
    WXRP: "0x81Be083099c2C65b062378E74Fa8469644347BB7",
  };
  ```

- **Trading Pairs**:
  ```javascript
  const ALL_PAIRS = [
    ["XRP", "RIBBIT"],
    ["XRP", "RISE"],
    ["XRP", "WXRP"],
    ["RIBBIT", "RISE"],
    ["RISE", "WXRP"],
    ["WXRP", "RIBBIT"],
  ];
  ```

- **Gas Settings**:
  - `GAS_LIMIT_ERC20`: 65,000 (for ERC-20 transfers).
  - `GAS_LIMIT_XRP`: 21,000 (for XRP/ETH transfers).
  - `GAS_LIMIT_COMPLEX`: 200,000 (for swaps and liquidity).
  - Gas price: Dynamic with a 20% premium for faster confirmations.

- **Delays**:
  - `DELAY_BETWEEN_SWAPS`: 200ms.
  - `DELAY_BETWEEN_WALLETS`: 500ms.

- **Router Address**:
  ```javascript
  const ROUTER_ADDRESS = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
  ```

- **Explorer URL**:
  ```javascript
  const EXPLORER_TX_URL = "https://explorer.testnet.xrplevm.org/tx/";
  ```

---

## Available Actions

1. **Perform Swaps**:
   - Executes token swaps on a Uniswap-like router.
   - Supports XRP and ERC-20 token pairs (e.g., XRP/RIBBIT, RIBBIT/RISE).
   - Randomly selects trading pairs and direction (A-to-B or B-to-A).

2. **Add Liquidity**:
   - Adds liquidity to a token pair (e.g., XRP/WXRP).
   - Requires approval of ERC-20 tokens and XRP for the router contract.

3. **Send Tokens**:
   - **Random Send**: Transfers tokens to randomly generated addresses.
   - **Send and Receive**: Sends tokens to new accounts, funds them with XRP for gas, and retrieves tokens back.

4. **Check Balances**:
   - Displays balances for XRP and supported ERC-20 tokens for all wallets.

---

## Dependencies

The bot relies on the following npm packages:

| Package       | Version | Description                              |
|---------------|---------|------------------------------------------|
| `ethers`      | ^6.0.0  | Ethereum library for wallet and contract interactions |
| `chalk`       | ^4.1.2  | Colorized console output                 |
| `inquirer`    | ^8.2.4  | Interactive CLI prompts                  |
| `dotenv`      | ^16.0.0 | Environment variable management          |

Install them using:
```bash
npm install ethers chalk inquirer dotenv
```

---

## Error Handling

- **RPC Timeouts**: The bot retries failed RPC calls up to 3 times with a 200ms delay.
- **Insufficient Funds**: Checks wallet balances before transfers to prevent failures.
- **Transaction Failures**: Logs detailed error messages with transaction hashes for debugging.
- **Invalid Inputs**: Validates user inputs (e.g., swap count, amounts) to ensure proper execution.

---

## Contributing

We welcome contributions to improve the XPRL Testnet Bot! Follow these steps to contribute:

1. **Fork the Repository**:
   ```bash
   git clone https://github.com/Kazuha787/Xprl-Auto-Bot.git
   cd Xprl-Auto-Bot
   ```

2. **Create a Branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make Changes**:
   - Add new features, fix bugs, or improve documentation.
   - Ensure code follows the existing style and structure.
   - Test thoroughly on the XPRL testnet.

4. **Commit Changes**:
   ```bash
   git commit -m "Add your descriptive commit message"
   ```

5. **Push to Your Fork**:
   ```bash
   git push origin feature/Kazuha787
   ```

6. **Create a Pull Request**:
   - Go to the original repository and open a pull request.
   - Provide a clear description of your changes and their purpose.
   - Reference any related issues (e.g., `#issue-number`).

7. **Code Review**:
   - Respond to feedback from maintainers.
   - Make necessary revisions to your pull request.

**Contribution Guidelines**:
- Follow the [JavaScript Standard Style](https://standardjs.com/).
- Ensure all tests pass (if tests are added in the future).
- Do not commit sensitive data (e.g., `.env` files).
- Be respectful and collaborative in discussions.

---

## Support

For questions, feedback, or support, join our Telegram community:  
**[Official Im Kazuha Telegram Channel](https://t.me/Offical_Im_kazuha)**

Report bugs or suggest features by opening an issue on the [GitHub repository](https://github.com/your-username/xprl-testnet-bot).

---

## License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.

---

*Built with 💜 by Kazuha787 for the XPRL Testnet community.*

---

### Notes for Implementation

1. **GitHub Repository Setup**:
   - Replace `your-username` in the clone URLs with your actual GitHub username.
   - Create a `LICENSE` file in the repository root with the MIT License text:
     ```text
     MIT License

     Copyright (c) 2025 Kazuha787

     Permission is hereby granted, free of charge, to any person obtaining a copy
     of this software and associated documentation files (the "Software"), to deal
     in the Software without restriction, including without limitation the rights
     to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     copies of the Software, and to permit persons to whom the Software is
     furnished to do so, subject to the following conditions:

     The above copyright notice and this permission notice shall be included in all
     copies or substantial portions of the Software.

     THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
     SOFTWARE.
     ```

2. **GitHub Contribution Guide**:
   - The contribution section is designed to be professional and clear, encouraging community participation while maintaining code quality.
   - If you add tests or a linter (e.g., ESLint), update the contribution guidelines to include those requirements.

3. **Security Note**:
   - Ensure the `.env` file is added to `.gitignore` to prevent accidental exposure of private keys:
     ```gitignore
     .env
     node_modules/
     ```

4. **Customization**:
   - If you want to add more features (e.g., advanced analytics, additional token support), update the `Features` and `Available Actions` sections.
   - Adjust the Telegram link or add other contact methods as needed.

This README should serve as a professional and comprehensive guide for your project. Let me know if you need further tweaks or additional sections!
