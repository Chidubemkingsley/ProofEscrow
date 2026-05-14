LocalP2P: Non-Custodial OTC Exchange
1. The Vision
LocalP2P is a censorship-resistant, non-custodial marketplace for buying and selling stablecoins with local fiat (NGN, GHS, KES). It eliminates the "Escrow Scams" common in centralized P2P by putting the collateral in a smart contract that neither party can touch without proof.

2. Problem & Solution
The Problem
Escrow Scams: On many P2P platforms, sellers can "ghost" buyers after receiving fiat, or centralized platform escrows can be frozen or seized due to regulatory pressure.
Lack of Privacy: Centralized exchanges require heavy KYC and can leak sensitive user data, making users vulnerable.
Chargeback/Receipt Fraud: Buyers sometimes use fake screenshots to trick sellers. Without an immutable record of evidence, disputes are hard to resolve fairly.
The Solution
Non-Custodial Security: Funds are locked in a Soroban Smart Contract. LocalP2P never holds user funds, meaning they cannot be frozen by the platform.
Immutable Evidence: When a buyer pays, they must upload proof to the milestone. This record is stored on-chain (or via IPFS), ensuring the Dispute Resolver has a single source of truth.
Trustless Payouts: Once the Seller verifies the fiat and clicks "Approve", the crypto is released instantly. The code enforces the agreement, not a middleman.
3. Technical Architecture (Trustless Work Integration)
Core Primitive
Escrow Type: Single-Release.
Network: Stellar Testnet.
Asset: USDC.
Role Mapping
Funder (The Seller): The person selling USDC for Naira. They lock the USDC in escrow.
Service Provider (The Buyer): The person paying Naira. They upload the bank receipt.
Approver (The Seller): Once they see the bank alert, they approve the release.
Receiver: The Buyer's wallet (gets the USDC).
Release Signer: The LocalP2P Platform (Triggers the move once approved).
Dispute Resolver: The Platform Admin (Arbitrates if the Buyer pays but the Seller won't release).
3. The Lifecycle (The "Trade" Flow)
Initiate: Seller creates an offer. Platform calls /deployer/single-release.
Funding: Seller signs the XDR to lock the USDC in the contract.
Evidence: Buyer sends bank transfer and uploads the screenshot of the alert to the milestone.
Release: Seller verifies the money is in their bank and signs the Approve transaction.
4. Technology Stack (The MVP Power-Pack)
Layer	Technology	Rationale
Frontend	Next.js 14	Responsive, mobile-first performance for P2P users.
Styling	Tailwind CSS	Utility-first CSS for custom "Trading Desk" UI.
Escrow Core	@trustless-work/blocks	Pre-built UI components for forms and transaction dialogs.
Wallet	@trustless-work/wallet-kit	Essential for connecting mobile/desktop Stellar wallets.
Notifications	Pusher / Socket.io	Real-time alerts when a buyer uploads payment proof.
Indexing	Trustless Work API	To fetch all active trades for the P2P marketplace list.
Asset	USDC (on Stellar)	The "Gold Standard" stablecoin for cross-border liquidity.
5. User Flow (Step-by-Step)
Phase 1: Listing
Seller connects wallet and creates a "Sell Offer" (e.g., "Selling 500 USDC for NGN").
Seller deploys a Single-Release escrow and funds it with 500 USDC.
The trade appears on the Marketplace as "Funded & Active".
Phase 2: Trading
Buyer finds the offer, connects wallet, and clicks "Buy".
Buyer sees the Seller's bank details (provided in the escrow metadata or chat).
Buyer makes the bank transfer and uploads a screenshot of the receipt as Evidence.
Seller receives a real-time notification that payment proof has been submitted.
Phase 3: Payout
Seller checks their bank app. Once confirmed, they click Approve on LocalP2P.
The 500 USDC is instantly released from the Soroban contract to the Buyer's wallet.
Both parties rate each other to build on-chain reputation.
6. Winning Demo Strategy (Judges' Perspective)
The Mobile Experience: P2P is used on phones. Demo using a responsive mobile-first UI.
The "Lock" Moment: Show the Seller locking 100 USDC. Explain that the platform cannot steal this money.
The Proof: Show a side-by-side view of a "Bank App" receipt being uploaded.
The Resolution: Briefly mention how the "Dispute Resolver" prevents the Seller from ghosting after receiving money.
6. MVP Roadmap (4-Day Hackathon)
Day 1: Wallet Integration (Freighter). User profile creation (Stellar Address).
Day 2: The "Sell Order" Flow (Deploy + Fund).
Day 3: The "Buy Order" Flow (Evidence Upload + Approval).
Day 4: Final UI Polish (Transaction history, success/failure toasts).