# four.market

A decentralized prediction market protocol where users stake predictions and challengers buy tickets to oppose outcomes, built on BNB Smart Chain (BSC) and compatible with other EVM networks.

## Technology Stack

**Blockchain:** BNB Smart Chain + EVM-compatible chains  
**Smart Contracts:** Solidity ^0.8.0  
**Frontend:** React 18 + ethers.js v6  
**Database:** Supabase (PostgreSQL)  
**Authentication:** Privy (Web3 auth)  
**Development:** Hardhat, OpenZeppelin libraries  
**Deployment:** Vercel (Frontend), BSC Mainnet (Contracts)

## Supported Networks

- **BNB Smart Chain Mainnet** (Chain ID: 56) - Primary network
- **BNB Smart Chain Testnet** (Chain ID: 97) - Testing environment
- Ethereum Mainnet (Chain ID: 1) - Future support
- Polygon (Chain ID: 137) - Future support

## Contract Addresses

| Network | Prediction Market Contract | Status |
|---------|---------------------------|--------|
| BNB Mainnet | `0x8dDbbBEAc546B4AeF8DFe8edd0084eF19B9077b6` | ✅ Active |
| BNB Testnet | Not deployed | ⏳ Pending |
| Ethereum | Not deployed | 🔜 Planned |

**Verify on BSCScan:** [View Contract](https://bscscan.com/address/0x8dDbbBEAc546B4AeF8DFe8edd0084eF19B9077b6)

## Features

✅ **Low-cost predictions on BNB Chain** - Create binary outcome markets with minimal gas fees  
✅ **Trustless resolution** - Smart contract-enforced payouts with admin verification  
✅ **Non-custodial** - Users maintain full control of their private keys and funds  
✅ **Flexible market parameters** - Customizable stake amounts (0.05-100 BNB), durations (6h-7d), and ticket counts (1-100)  
✅ **Winner-take-all mechanics** - Transparent prize pool distribution based on market outcomes  
✅ **Real-time updates** - Live market data via Supabase subscriptions  
✅ **Claims system** - One-click winnings and refund claims with blockchain verification  
✅ **Security features** - Rate limiting, audit logging, JWT authentication, emergency pause mechanism  
✅ **Gas-efficient design** - Optimized for BNB Smart Chain's low transaction costs  
✅ **Admin governance** - Multi-signature admin controls for market resolution and protocol management

## Quick Start

### Prerequisites

```bash
Node.js >= 16.x
npm or yarn
```

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/four-market.git
cd four-market

# Install dependencies
npm install

# Set up environment variables
cp env.template .env
# Edit .env with your configuration
```

### Environment Variables

Create a `.env` file with the following:

```env
# Supabase
REACT_APP_SUPABASE_URL=your_supabase_url
REACT_APP_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Privy Authentication
REACT_APP_PRIVY_APP_ID=your_privy_app_id

# Blockchain
REACT_APP_CONTRACT_ADDRESS=0x8dDbbBEAc546B4AeF8DFe8edd0084eF19B9077b6
REACT_APP_BSC_RPC_URL=https://bsc-dataseed.binance.org/
REACT_APP_CHAIN_ID=56

# Admin (for admin operations only)
ADMIN_PRIVATE_KEY=0x[your_admin_private_key]
```

### Development

```bash
# Start development server
npm start

# Build for production
npm run build

# Run tests
npm test
```

### Deployment

```bash
# Deploy to Vercel
vercel --prod
```

## Smart Contract Interface

### Core Functions

```solidity
// Create a new prediction market
function createMarket(
    string memory _question,
    uint8 _duration,
    uint8 _ticketAmount
) external payable returns (uint256);

// Purchase challenge tickets
function buyTickets(
    uint256 _marketId,
    uint256 _ticketCount
) external payable;

// Claim winnings from resolved market
function claimWinnings(uint256 _marketId) external;

// Claim refund from cancelled market
function claimRefund(uint256 _marketId) external;

// Admin: Resolve market outcome
function resolveMarket(
    uint256 _marketId,
    bool _outcome
) external onlyOwner;

// Admin: Cancel market
function cancelMarket(uint256 _marketId) external onlyOwner;
```

## Protocol Mechanics

### Market Creation
1. User stakes BNB (0.05-100 BNB)
2. Smart contract calculates ticket price: `stake / ticketCount`
3. Market opens with deadline (6 hours to 7 days)
4. Funds locked in contract

### Ticket Purchase
1. Challenger selects quantity
2. Payment: `ticketPrice × quantity`
3. Tickets assigned to buyer address
4. Market maker cannot buy own tickets

### Resolution
- **YES Outcome:** Market maker wins entire pool
- **NO Outcome:** Challengers win proportionally
- **Calculation:** `(userTickets / totalTickets) × totalPool`

### Claiming
1. Market resolves via admin
2. Winner navigates to `/winnings`
3. One-click claim with blockchain transaction
4. BNB transferred to wallet
5. Double-claim prevention

## Security

### Smart Contract
- Reentrancy guards on state-changing functions
- Access control via Ownable pattern
- Emergency pause mechanism
- Time-locked operations

### Application
- JWT authentication with auto-refresh
- Rate limiting (3 markets/hour, 5 purchases/min)
- Server-side input validation
- Audit logging for critical operations
- CORS restrictions

### User Protection
- Non-custodial architecture
- Transparent on-chain transactions
- Verifiable contract code
- Refunds for cancelled markets

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/create-bet` | POST | Create new market |
| `/api/buy-ticket` | POST | Purchase challenge tickets |
| `/api/claim-winnings` | POST | Claim winnings |
| `/api/claim-refund` | POST | Claim refunds |
| `/api/auth` | POST | User authentication |
| `/api/admin-*` | POST | Admin operations |

## Rate Limits

- **Market Creation:** 3 per hour per user
- **Ticket Purchase:** 5 per minute per user
- **Claims:** 3 per minute per user
- **Text Formatting:** 10 per minute per IP

## Roadmap

### Phase 1: Foundation (Q4 2025) ✅
- Smart contract deployment
- Web application launch
- Basic market creation and trading
- Admin resolution system

### Phase 2: Enhancement (Q1 2026)
- Mobile application
- Advanced market types
- Social features
- Analytics dashboard

## Documentation

- [Whitepaper](https://four.market/whitepaper) - Technical documentation

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Testing

```bash
# Run frontend tests
npm test

# Run contract tests (if using Hardhat)
npx hardhat test

# Run coverage
npx hardhat coverage
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **Website:** [https://four.market](https://four.market)
- **Documentation:** [https://four.market/whitepaper](https://four.market/whitepaper)
- **Contract:** [BSCScan](https://bscscan.com/address/0x8dDbbBEAc546B4AeF8DFe8edd0084eF19B9077b6)

## Acknowledgments

- Built on Binance Smart Chain
- Powered by Privy for authentication
- Database by Supabase
- Deployed on Vercel

---

**Version:** Demo 2.0
**Last Updated:** October 17, 2025  
**Status:** ✅ Production Ready
