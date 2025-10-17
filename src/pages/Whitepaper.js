import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Whitepaper.css';

export default function Whitepaper() {
  const navigate = useNavigate();

  return (
    <div className="whitepaper-page">
      <button className="whitepaper-back-btn" onClick={() => navigate('/')}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
        <span>BACK</span>
      </button>

      <div className="whitepaper-container">
        <header className="whitepaper-header">
          <h1>four.market</h1>
          <div className="whitepaper-subtitle">Technical Whitepaper</div>
          <div className="whitepaper-version">Version 1.0 | October 2025</div>
        </header>

        <section className="whitepaper-section">
          <h2>Abstract</h2>
          <p>
            four.market is a decentralized prediction market protocol built on Binance Smart Chain. 
            The platform enables users to create binary outcome markets, stake predictions, and allow 
            challengers to purchase opposing positions through a transparent, trustless mechanism.
          </p>
        </section>

        <section className="whitepaper-section">
          <h2>1. Introduction</h2>
          <p>
            Prediction markets have proven to be effective mechanisms for aggregating distributed 
            information and forecasting future events. Traditional prediction markets suffer from 
            centralization, arbitrary rules, and lack of transparency. four.market addresses these 
            limitations through blockchain technology.
          </p>
          <div className="whitepaper-subsection">
            <h3>1.1 Problem Statement</h3>
            <ul>
              <li>Centralized platforms control market resolution</li>
              <li>High fees and withdrawal restrictions</li>
              <li>Lack of transparency in fund management</li>
              <li>Geographic and regulatory restrictions</li>
            </ul>
          </div>
          <div className="whitepaper-subsection">
            <h3>1.2 Solution</h3>
            <p>
              A decentralized protocol where market creation, ticket sales, and payouts are managed 
              entirely through smart contracts on BSC, ensuring transparency and eliminating 
              counterparty risk.
            </p>
          </div>
        </section>

        <section className="whitepaper-section">
          <h2>2. Architecture</h2>
          
          <div className="whitepaper-subsection">
            <h3>2.1 Smart Contract</h3>
            <p>
              The core protocol is implemented as a Solidity smart contract deployed on Binance Smart Chain. 
              Contract address: <code>0x8dDbbBEAc546B4AeF8DFe8edd0084eF19B9077b6</code>
            </p>
          </div>

          <div className="whitepaper-subsection">
            <h3>2.2 Market Structure</h3>
            <p>Each market contains the following parameters:</p>
            <ul>
              <li><strong>Question:</strong> Binary prediction statement (50-256 characters)</li>
              <li><strong>Market Maker Stake:</strong> BNB staked by creator (0.05-100 BNB)</li>
              <li><strong>Ticket Price:</strong> Calculated automatically based on stake and ticket count</li>
              <li><strong>Total Tickets:</strong> Fixed supply (1, 10, 50, or 100 tickets)</li>
              <li><strong>Deadline:</strong> Market expiration time (6h to 7 days)</li>
              <li><strong>Status:</strong> Active, Resolved, or Cancelled</li>
            </ul>
          </div>

          <div className="whitepaper-subsection">
            <h3>2.3 Technical Stack</h3>
            <div className="tech-grid">
              <div className="tech-item">
                <div className="tech-label">Blockchain</div>
                <div className="tech-value">Binance Smart Chain</div>
              </div>
              <div className="tech-item">
                <div className="tech-label">Smart Contract</div>
                <div className="tech-value">Solidity ^0.8.0</div>
              </div>
              <div className="tech-item">
                <div className="tech-label">Frontend</div>
                <div className="tech-value">React 18</div>
              </div>
              <div className="tech-item">
                <div className="tech-label">Database</div>
                <div className="tech-value">Supabase (PostgreSQL)</div>
              </div>
              <div className="tech-item">
                <div className="tech-label">Authentication</div>
                <div className="tech-value">Privy</div>
              </div>
              <div className="tech-item">
                <div className="tech-label">Web3 Library</div>
                <div className="tech-value">ethers.js v6</div>
              </div>
            </div>
          </div>
        </section>

        <section className="whitepaper-section">
          <h2>3. Protocol Mechanics</h2>

          <div className="whitepaper-subsection">
            <h3>3.1 Market Creation</h3>
            <ol>
              <li>User submits prediction and stake amount</li>
              <li>Smart contract calculates ticket price: <code>stake / ticketCount</code></li>
              <li>Market is created with unique ID and deadline</li>
              <li>Funds are locked in contract</li>
            </ol>
          </div>

          <div className="whitepaper-subsection">
            <h3>3.2 Ticket Purchase</h3>
            <ol>
              <li>Challenger selects ticket quantity</li>
              <li>Payment equals <code>ticketPrice × quantity</code></li>
              <li>Tickets are assigned to buyer's address</li>
              <li>Funds are added to prize pool</li>
              <li>Market maker cannot purchase own tickets</li>
            </ol>
          </div>

          <div className="whitepaper-subsection">
            <h3>3.3 Market Resolution</h3>
            <p>Markets are resolved through admin verification:</p>
            <ul>
              <li><strong>YES Outcome:</strong> Market maker wins, receives entire pool</li>
              <li><strong>NO Outcome:</strong> Challengers win proportionally to tickets held</li>
            </ul>
            <p className="formula">
              Challenger Payout = (userTickets / totalTickets) × totalPool
            </p>
          </div>

          <div className="whitepaper-subsection">
            <h3>3.4 Claiming Mechanism</h3>
            <ol>
              <li>Winner calls <code>claimWinnings(marketId)</code></li>
              <li>Contract verifies market is resolved</li>
              <li>Contract verifies caller is eligible winner</li>
              <li>Contract transfers BNB to winner</li>
              <li>Prevents double-claiming through state tracking</li>
            </ol>
          </div>
        </section>

        <section className="whitepaper-section">
          <h2>4. Security Model</h2>

          <div className="whitepaper-subsection">
            <h3>4.1 Smart Contract Security</h3>
            <ul>
              <li>Reentrancy guards on all state-changing functions</li>
              <li>Access control through Ownable pattern</li>
              <li>Emergency pause mechanism</li>
              <li>Time-locked operations</li>
            </ul>
          </div>

          <div className="whitepaper-subsection">
            <h3>4.2 Application Security</h3>
            <ul>
              <li>JWT-based authentication with auto-refresh</li>
              <li>Rate limiting on all API endpoints</li>
              <li>Server-side input validation</li>
              <li>Audit logging for critical operations</li>
              <li>CORS restrictions</li>
            </ul>
          </div>

          <div className="whitepaper-subsection">
            <h3>4.3 User Protection</h3>
            <ul>
              <li>Non-custodial: Users maintain key ownership</li>
              <li>Transparent: All transactions on-chain</li>
              <li>Verifiable: Contract code is public</li>
              <li>Refundable: Cancelled markets allow refunds</li>
            </ul>
          </div>
        </section>

        <section className="whitepaper-section">
          <h2>5. Economic Model</h2>

          <div className="whitepaper-subsection">
            <h3>5.1 Fee Structure</h3>
            <p>Protocol fee: Configurable (0-10% in basis points)</p>
            <p>Default: 0 bps (0%) - Currently no protocol fees</p>
          </div>

          <div className="whitepaper-subsection">
            <h3>5.2 Incentive Alignment</h3>
            <ul>
              <li>Market makers incentivized to create accurate predictions</li>
              <li>Challengers incentivized to identify incorrect predictions</li>
              <li>Winner-take-all mechanism encourages conviction</li>
            </ul>
          </div>

          <div className="whitepaper-subsection">
            <h3>5.3 Market Constraints</h3>
            <div className="constraints-table">
              <div className="constraint-row">
                <span className="constraint-label">Minimum Stake</span>
                <span className="constraint-value">0.05 BNB</span>
              </div>
              <div className="constraint-row">
                <span className="constraint-label">Maximum Stake</span>
                <span className="constraint-value">100 BNB</span>
              </div>
              <div className="constraint-row">
                <span className="constraint-label">Ticket Options</span>
                <span className="constraint-value">1, 10, 50, 100</span>
              </div>
              <div className="constraint-row">
                <span className="constraint-label">Duration Range</span>
                <span className="constraint-value">6 hours - 7 days</span>
              </div>
              <div className="constraint-row">
                <span className="constraint-label">Creation Rate Limit</span>
                <span className="constraint-value">3 markets/hour</span>
              </div>
            </div>
          </div>
        </section>

        <section className="whitepaper-section">
          <h2>6. Governance</h2>

          <div className="whitepaper-subsection">
            <h3>6.1 Admin Functions</h3>
            <p>Current governance model uses admin multisig with following capabilities:</p>
            <ul>
              <li>Resolve markets (determine outcome)</li>
              <li>Cancel markets (enable refunds)</li>
              <li>Pause contract (emergency stop)</li>
              <li>Set protocol fee</li>
              <li>Withdraw protocol fees</li>
            </ul>
          </div>

          <div className="whitepaper-subsection">
            <h3>6.2 Future Decentralization</h3>
            <p>
              Future versions will explore decentralized resolution mechanisms including 
              oracle integration, reputation-based voting, and stake-weighted governance.
            </p>
          </div>
        </section>

        <section className="whitepaper-section">
          <h2>7. User Flows</h2>

          <div className="whitepaper-subsection">
            <h3>7.1 Market Creator Flow</h3>
            <div className="flow-steps">
              <div className="flow-step">1. Connect wallet via Privy</div>
              <div className="flow-step">2. Submit prediction (50-256 chars)</div>
              <div className="flow-step">3. Set stake amount (0.05-100 BNB)</div>
              <div className="flow-step">4. Select duration and ticket count</div>
              <div className="flow-step">5. Market becomes active</div>
            </div>
          </div>

          <div className="whitepaper-subsection">
            <h3>7.2 Challenger Flow</h3>
            <div className="flow-steps">
              <div className="flow-step">1. Browse active markets</div>
              <div className="flow-step">2. Select market to challenge</div>
              <div className="flow-step">3. Choose ticket quantity</div>
              <div className="flow-step">4. Tickets assigned to address</div>
              <div className="flow-step">5. Wait for resolution</div>
            </div>
          </div>

          <div className="whitepaper-subsection">
            <h3>7.3 Winner Flow</h3>
            <div className="flow-steps">
              <div className="flow-step">1. Market gets resolved</div>
              <div className="flow-step">2. Navigate to /winnings</div>
              <div className="flow-step">3. View claimable amount</div>
              <div className="flow-step">4. Click claim button</div>
              <div className="flow-step">5. BNB received in wallet</div>
            </div>
          </div>
        </section>

        <section className="whitepaper-section">
          <h2>8. Risk Considerations</h2>

          <div className="whitepaper-subsection">
            <h3>8.1 Smart Contract Risk</h3>
            <p>
              While the contract follows security best practices, smart contracts are immutable 
              and may contain undiscovered vulnerabilities. Users should only risk funds they 
              can afford to lose.
            </p>
          </div>

          <div className="whitepaper-subsection">
            <h3>8.2 Resolution Risk</h3>
            <p>
              Current admin-based resolution introduces centralization risk. Admins determine 
              market outcomes based on real-world events. Disputed resolutions cannot be reversed.
            </p>
          </div>

          <div className="whitepaper-subsection">
            <h3>8.3 Market Risk</h3>
            <p>
              Users may lose their entire stake or ticket purchase if their position is incorrect. 
              Markets are winner-take-all with no partial refunds for losers.
            </p>
          </div>

          <div className="whitepaper-subsection">
            <h3>8.4 Platform Risk</h3>
            <p>
              Frontend downtime or bugs may affect ability to interact with contracts. However, 
              funds remain safe in smart contracts and can be accessed through direct contract calls.
            </p>
          </div>
        </section>

        <section className="whitepaper-section">
          <h2>9. Roadmap</h2>

          <div className="roadmap-timeline">
            <div className="roadmap-phase">
              <div className="phase-title">Phase 1: Foundation (Q4 2025)</div>
              <ul>
                <li>Smart contract deployment</li>
                <li>Web application launch</li>
                <li>Basic market creation and trading</li>
                <li>Admin resolution system</li>
              </ul>
            </div>

            <div className="roadmap-phase">
              <div className="phase-title">Phase 2: Enhancement (Q1 2026)</div>
              <ul>
                <li>Mobile application</li>
                <li>Advanced market types</li>
                <li>Social features</li>
                <li>Analytics dashboard</li>
              </ul>
            </div>

          </div>
        </section>

        <section className="whitepaper-section">
          <h2>10. Technical Specifications</h2>

          <div className="whitepaper-subsection">
            <h3>10.1 Contract Interface</h3>
            <div className="code-block">
              <pre>{`function createMarket(
    string memory _question,
    uint8 _duration,
    uint8 _ticketAmount
) external payable returns (uint256);

function buyTickets(
    uint256 _marketId,
    uint256 _ticketCount
) external payable;

function claimWinnings(
    uint256 _marketId
) external;

function claimRefund(
    uint256 _marketId
) external;`}</pre>
            </div>
          </div>

          <div className="whitepaper-subsection">
            <h3>10.2 Events</h3>
            <div className="code-block">
              <pre>{`event MarketCreated(
    uint256 indexed marketId,
    string question,
    address indexed marketMaker,
    uint256 marketMakerStake,
    uint256 ticketPrice,
    uint256 totalTickets,
    uint256 deadline,
    uint256 createdAt
);

event TicketsPurchased(
    uint256 indexed marketId,
    address indexed buyer,
    uint256 ticketCount,
    uint256 totalCost,
    uint256 timestamp
);

event WinningsClaimed(
    uint256 indexed marketId,
    address indexed claimer,
    uint256 amount
);`}</pre>
            </div>
          </div>
        </section>

        <footer className="whitepaper-footer">
          <div className="footer-line"></div>
          <div className="footer-content">
            <div className="footer-links">
              <a href="https://bscscan.com/address/0x8dDbbBEAc546B4AeF8DFe8edd0084eF19B9077b6" target="_blank" rel="noopener noreferrer">
                Contract on BSCScan
              </a>
              <span>|</span>
              <a href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }}>
                Launch App
              </a>
            </div>
            <div className="footer-copyright">
              four.market | Decentralized Prediction Markets
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

