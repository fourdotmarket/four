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

## Contract Addresses

| Network | Prediction Market Contract | Status |
|---------|---------------------------|--------|
| BNB Mainnet | `0x8dDbbBEAc546B4AeF8DFe8edd0084eF19B9077b6` | ✅ Active |

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

## Roadmap

### Phase 1: Foundation (Q4 2025) ✅
- Smart contract deployment
- Web application launch
- Basic market creation and trading
- Admin resolution system
- Official token launch

### Phase 2: Enhancement (Q1 2026)
- Mobile application
- Advanced market types
- Social features
- Analytics dashboard
- UMA system

## Documentation

- [Whitepaper](https://four.market/whitepaper) - Technical documentation

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **Website:** [https://four.market](https://four.market)
- **Documentation:** [https://four.market/whitepaper](https://four.market/whitepaper)
- **Contract:** [BSCScan](https://bscscan.com/address/0x8dDbbBEAc546B4AeF8DFe8edd0084eF19B9077b6)

**Version:** Demo 2.0
**Last Updated:** October 17, 2025  
**Status:** ✅ Production Ready
