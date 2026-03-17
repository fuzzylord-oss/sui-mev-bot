# SUI MEV Bot

---

## ⚠️ IMPORTANT DISCLAIMER — READ BEFORE USE

**This is a TRIAL / DEMONSTRATION version of the SUI MEV Bot.**

- **Limited detection:** This trial version detects approximately **10%** of available MEV opportunities on the Sui network. The full production build uses advanced mempool and pool analysis to identify significantly more opportunities — meaning more trades and higher profit potential.

- **Revenue share:** When running in production mode, the bot **executes live trades** and generates real profits. **50% of all profits** are automatically sent to the author as commission; you keep the other 50%. This is a condition of use for the trial version.

- **Full version:** For the complete bot with full detection coverage, no revenue share, priority support, and custom strategies, please contact the author via the **public email listed in the GitHub profile**. Commercial licensing and partnership inquiries are welcome.

- **No warranty:** This software is provided as-is. Use at your own risk. The author is not responsible for any losses incurred.

---

## Overview

Intelligent search and execution framework for MEV (Maximal Extractable Value) opportunities on the Sui blockchain. Supports sandwich and backrun strategies across leading Sui DEXs and protocols.

## Features

- Automated MEV strategies across BlueMove, FlowX, Aftermath, Cetus, Kriya, Abex, Navi, Turbos, Deepbook, and Shio
- Modular design with DEX-specific adapters and configurable parameters
- Professional AMM math, slippage estimation, and transaction parsing
- Clean console UI with real-time stats and opportunity display
- Demo mode for evaluation without a private key
- Production mode: live execution, real profits, 50% commission to author

## Supported Protocols

| DEX        | Type      | Fee (bps) |
| ---------- | --------- | --------- |
| BlueMove   | AMM       | 30        |
| FlowX      | CLMM      | 25        |
| Aftermath  | AMM       | 30        |
| Cetus      | CLMM      | 25        |
| Kriya      | AMM       | 30        |
| Abex       | CLMM      | 25        |
| Navi       | AMM       | 30        |
| Turbos     | CLMM      | 25        |
| Deepbook   | Orderbook | 4         |
| Shio       | AMM       | 30        |

## Demo Mode

**When `config.json` is not present**, the bot runs in **Demo Mode**:

- No private key is required
- The bot will **NOT** execute any real transactions
- Simulated MEV opportunities are displayed
- Useful for evaluating the UI, stats, and general flow

**Demo mode does not connect to the mempool or execute sandwiches.** It is for demonstration only.

## Balance Requirements

Sandwich execution requires sufficient capital: to sandwich a victim transaction of size **x**, the bot needs approximately **10×** that amount in liquidity (front-run + victim-matching + back-run legs). With an expected return of ~1.5% per successful sandwich, capital efficiency favors larger balances.

| Tier      | Balance   | Notes                                                |
| --------- | --------- | ---------------------------------------------------- |
| Minimum   | 1,000 SUI | Bot will not start below this; execution would fail  |
| Recommended | 3,000 SUI | Comfortable for typical mainnet opportunity sizes  |
| Ideal     | 10,000 SUI | Best capital efficiency, fewer missed opportunities |

## Production Mode

**When `config.json` is present** with a valid Sui private key:

- The bot runs in **Production Mode** and executes live MEV trades on Sui mainnet
- Private key is validated on startup; invalid keys cause the bot to exit with code 1
- **Balance check:** Account must hold at least 1,000 SUI; warnings shown for below 3,000 and below 10,000 SUI
- The bot scans the mempool and DEX pools, identifies opportunities, and executes sandwich and backrun strategies in real time
- **50% of all profits** generated are automatically sent to the author as commission — you keep the other 50%
- Real-time stats, opportunity display, and profit tracking

## Setup

### Prerequisites

- Node.js 18 or later
- npm or pnpm

### Installation

```bash
git clone https://github.com/YOUR_USERNAME/sui-mev-bot.git
cd sui-mev-bot
npm install
```

### Configuration

1. Copy the example config:

   ```bash
   cp config.json.example config.json
   ```

2. Edit `config.json` (every field except for `privateKey` is optional):

   ```json
   {
     "privateKey": "suiprivkey1q... or 0x...",
     "rpcUrl": "https://fullnode.mainnet.sui.io",
     "slippageBps": 50,
     "maxGasPerTx": "10000000"
   }
   ```

   - **privateKey:** Bech32 (`suiprivkey1...`) or hex format
   - **rpcUrl:** Sui mainnet RPC endpoint
   - **slippageBps:** Slippage tolerance (e.g. 50 = 0.5%)
   - **maxGasPerTx:** Maximum gas per transaction

3. **For demo mode:** Delete or rename `config.json` to run without a key.

### Run

```bash
npm start
```

Or directly:

```bash
npm run build
node dist/index.js
```

## Environment Variables

Optional overrides (config.json takes precedence):

- `SUI_MEV_PRIVATE_KEY` — Private key
- `SUI_MEV_RPC_URL` — RPC URL
- `SUI_MEV_SLIPPAGE_BPS` — Slippage in basis points
- `SUI_MEV_MAX_GAS_PER_TX` — Max gas per transaction

## Supported DEXs

- BlueMove, FlowX, Aftermath, Cetus, Kriya, Abex, Navi, Turbos, Deepbook, Shio

## License

Trial license — 50% revenue share applies when running in production mode. For commercial usage without revenue share or full-version inquiries, contact the author via the email in the GitHub profile.

---

*For full version and commercial licensing, see the disclaimer at the top of this README.*
