---
description: How to run the Healthcare Blockchain application
---

Follow these steps to get the application up and running on your local machine.

### 1. Database Initialization
Ensure your MySQL server is running and the credentials in `.env` are correct. Then, run the initialization script to create the necessary tables:

```powershell
node backend/utils/initDb.js
```

### 2. Install Dependencies
Install all required Node.js packages:

```powershell
npm install
```

### 3. Blockchain Setup (Optional)
To use the blockchain features (hashing and verification), you need to run a local Ethereum node and deploy the smart contract:

**Terminal A (Start Node):**
```powershell
npx hardhat node
```

**Terminal B (Deploy Contract):**
```powershell
npx hardhat run scripts/deploy.js --network localhost
```
*Note: After deploying, copy the contract address from the terminal and update the `CONTRACT_ADDRESS` in your `.env` file.*

### 4. Start the Backend Server
Start the Express server with nodemon (auto-reloads on changes):

```powershell
npm run dev
```

### 5. Access the Application
Open your web browser and go to:
**[http://localhost:3000](http://localhost:3000)**

---

### Testing the "Treatment" Logic
1. **Patient**: Register/Login, upload a record. See your **Patient ID** on the dashboard.
2. **Doctor**: Register/Login. Click "Send Notification" (Request Access) and enter the **Patient ID**.
3. **Verification**: The patient will appear in the doctor's search/patient list, and the doctor can now view their records.
