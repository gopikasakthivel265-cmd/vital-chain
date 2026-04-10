---
description: how to run the healthcare blockchain project
---

To run the project locally, follow these steps in order:

1. **Start the Blockchain Node**
   Open a new terminal and run:
   ```powershell
   // turbo
   npx hardhat node
   ```
   *Keep this terminal open.* It provides the local Ethereum network.

2. **Compile and Deploy Smart Contracts (Optional)**
   If you have changed the smart contracts, run:
   ```powershell
   // turbo
   npx hardhat compile
   npx hardhat run scripts/deploy.js --network localhost
   ```

3. **Start the Backend Server**
   Open another terminal and run:
   ```powershell
   // turbo
   npm run dev
   ```
   *Keep this terminal open.* This starts the Express server which handles the database, OTP emails, and serves the frontend.

4. **Access the Website**
   Open your browser and navigate to:
   [http://localhost:3000](http://localhost:3000)

---
**Note on OTP Emails**: Ensure your `.env` file contains valid `EMAIL_USER` and `EMAIL_PASS` (App Password) for real email delivery. If not set, check the backend terminal for the OTP logs.
