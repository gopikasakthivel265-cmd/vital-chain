# 🏥 Blockchain-Based Healthcare Patient Records System

A secure, decentralized healthcare data management system using hybrid blockchain architecture (on-chain hashes + off-chain storage) with role-based access control for patients and doctors.

## 🌟 Features

- **🔐 Secure Authentication**: JWT-based authentication with role-based access (Patient/Doctor)
- **⛓️ Hybrid Blockchain Model**: 
  - On-chain: Cryptographic hashes stored on Ethereum blockchain
  - Off-chain: Actual medical records stored in MySQL database
- **👤 Patient Dashboard**:
  - Upload medical records (PDF, images, documents)
  - View all personal medical records
  - Grant/revoke doctor access to specific records
  - Track blockchain verification status
- **👨‍⚕️ Doctor Dashboard**:
  - View accessible patient records (with permission)
  - Download medical files
  - Verify record integrity via blockchain
  - Search and filter patient records
- **✅ Data Integrity**: Blockchain-based verification ensures records haven't been tampered with
- **📊 Real-time Statistics**: Dashboard analytics for both patients and doctors

## 🛠️ Technology Stack

### Backend
- **Node.js** + **Express.js** - RESTful API server
- **MySQL** - Off-chain database storage
- **Solidity** - Smart contracts for on-chain hash storage
- **Hardhat** - Ethereum development environment
- **ethers.js** - Blockchain interaction library

### Frontend
- **HTML5** + **CSS3** + **Vanilla JavaScript**
- Modern responsive design with dark theme
- Drag-and-drop file upload

### Security
- **bcryptjs** - Password hashing
- **jsonwebtoken** - JWT authentication
- **SHA-256** - File hashing
- **Smart Contract Access Control** - Blockchain-based permissions

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v16 or higher) - [Download here](https://nodejs.org/)
- **MySQL Server** (v8.0 or higher) - [Download here](https://dev.mysql.com/downloads/)
- **MySQL Workbench** (optional but recommended) - [Download here](https://dev.mysql.com/downloads/workbench/)
- **Git** - [Download here](https://git-scm.com/)

## 🚀 Installation & Setup

### Step 1: Clone or Navigate to Project Directory

```bash
cd C:\Users\Gopika Sakthivel\min1
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Setup MySQL Database

1. Open **MySQL Workbench** and connect to your MySQL server

2. Execute the database schema:
   ```bash
   # In MySQL Workbench, open and run the schema file:
   # File -> Open SQL Script -> Select: database/schema.sql
   # Then click Execute (⚡ lightning icon)
   ```

3. Verify the database was created:
   ```sql
   SHOW DATABASES;
   USE healthcare_blockchain;
   SHOW TABLES;
   ```

### Step 4: Configure Environment Variables

1. Copy the example environment file:
   ```bash
   copy .env.example .env
   ```

2. Edit `.env` file with your MySQL credentials:
   ```env
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_mysql_password_here
   DB_NAME=healthcare_blockchain
   DB_PORT=3306

   JWT_SECRET=your_super_secret_jwt_key_change_this
   JWT_EXPIRES_IN=24h

   PORT=3000
   NODE_ENV=development

   BLOCKCHAIN_NETWORK=localhost
   BLOCKCHAIN_RPC_URL=http://127.0.0.1:8545
   CONTRACT_ADDRESS=

   UPLOAD_DIR=./uploads
   MAX_FILE_SIZE=10485760
   CORS_ORIGIN=http://localhost:3000
   ```

### Step 5: Compile Smart Contracts

```bash
npx hardhat compile
```

### Step 6: Start Local Blockchain (Hardhat Node)

Open a **new terminal window** and run:

```bash
npx hardhat node
```

**Keep this terminal running!** This is your local Ethereum blockchain.

### Step 7: Deploy Smart Contract

In your **original terminal**, run:

```bash
npx hardhat run scripts/deploy.js --network localhost
```

**Important**: Copy the contract address from the output and add it to your `.env` file:

```env
CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
```

(Your address will be different - use the one from the deployment output)

### Step 8: Start Backend Server

```bash
npm start
```

You should see:
```
✅ Database connected successfully
✅ Blockchain service initialized
📝 Contract address: 0x5FbDB...
👤 Signer address: 0xf39Fd...
✅ Server running on http://localhost:3000
```

### Step 9: Access the Application

Open your web browser and navigate to:

```
http://localhost:3000
```

## 👥 Usage Guide

### For First-Time Setup

1. **Register as a Patient**:
   - Click "Register here" on login page
   - Select role: "Patient"
   - Fill in your details (name, date of birth, medical history, etc.)
   - Click "Register"

2. **Register as a Doctor**:
   - Same process but select role: "Doctor"
   - Fill in professional details (specialization, license number, etc.)

### Patient Workflow

1. **Login** with your patient credentials
2. **Upload Medical Records**:
   - Fill in record title and type
   - Drag & drop or click to select file
   - Click "Upload Record"
   - Record hash is automatically stored on blockchain
3. **Grant Doctor Access**:
   - Click "Grant Access" button on any record
   - Select a doctor from the dropdown
   - Confirm to grant access (stored on blockchain)
4. **View Permissions**: Check which doctors have access to each record

### Doctor Workflow

1. **Login** with your doctor credentials
2. **View Dashboard**: See all patient records you have access to
3. **View Record Details**: Click "View" to see patient info and record details
4. **Download Records**: Download medical files for review
5. **Verify Integrity**: Click "Verify Integrity" to check blockchain verification
6. **Search Records**: Use search bar to filter by patient name or record title

## 🗂️ Project Structure

```
min1/
├── backend/
│   ├── middleware/
│   │   └── auth.js              # JWT authentication middleware
│   ├── services/
│   │   ├── blockchain.js        # Smart contract interaction
│   │   └── database.js          # MySQL database operations
│   ├── utils/
│   │   └── fileUtils.js         # File hashing and validation
│   └── server.js                # Express server and API routes
├── blockchain/
│   └── contracts/
│       └── MedicalRecords.sol   # Solidity smart contract
├── database/
│   └── schema.sql               # MySQL database schema
├── frontend/
│   ├── css/
│   │   └── styles.css           # Application styling
│   ├── js/
│   │   ├── auth.js              # Login/registration logic
│   │   ├── patient.js           # Patient dashboard logic
│   │   └── doctor.js            # Doctor dashboard logic
│   ├── index.html               # Login/registration page
│   ├── patient-dashboard.html   # Patient dashboard
│   └── doctor-dashboard.html    # Doctor dashboard
├── scripts/
│   └── deploy.js                # Smart contract deployment
├── uploads/                     # Uploaded medical records (created automatically)
├── .env.example                 # Environment variables template
├── .env                         # Your environment variables (create this)
├── hardhat.config.js            # Hardhat configuration
├── package.json                 # Dependencies and scripts
└── README.md                    # This file
```

## 🔒 Security Features

- **Password Hashing**: bcrypt with salt rounds
- **JWT Tokens**: Secure authentication with expiration
- **File Hash Verification**: SHA-256 hashing for integrity
- **Blockchain Immutability**: On-chain hash storage prevents tampering
- **Access Control**: Smart contract-based permission management
- **Role-Based Access**: Separate permissions for patients and doctors
- **Audit Logging**: All actions logged in database

## 🧪 Testing

### Test Smart Contract

```bash
npx hardhat test
```

### Test API Endpoints

You can use tools like **Postman** or **cURL** to test API endpoints:

**Example: Login**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"patient@example.com\",\"password\":\"password123\"}"
```

## 📊 Database Schema

Main tables:
- `users` - User authentication and role information
- `patients` - Patient profile details
- `doctors` - Doctor profile details
- `medical_records` - Off-chain medical record storage
- `access_permissions` - Doctor access permissions
- `audit_log` - System activity tracking
- `sessions` - User session management

## 🔗 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/update-wallet` - Update blockchain wallet address

### Patient
- `GET /api/patient/dashboard` - Get patient dashboard data
- `POST /api/patient/upload` - Upload medical record
- `POST /api/patient/grant-access` - Grant doctor access
- `POST /api/patient/revoke-access` - Revoke doctor access
- `GET /api/patient/record/:recordId/permissions` - View permissions

### Doctor
- `GET /api/doctor/dashboard` - Get doctor dashboard data
- `GET /api/doctor/record/:recordId` - View specific record
- `GET /api/doctors` - Get list of all doctors

### Blockchain
- `POST /api/blockchain/verify/:recordId` - Verify record integrity

### Files
- `GET /api/record/:recordId/download` - Download medical record

## 🐛 Troubleshooting

### Database Connection Failed
- Verify MySQL is running: `mysql --version`
- Check credentials in `.env` file
- Ensure database exists: Run `schema.sql` again

### Blockchain Service Not Initialized
- Make sure Hardhat node is running in a separate terminal
- Verify `CONTRACT_ADDRESS` in `.env` file
- Redeploy contract: `npx hardhat run scripts/deploy.js --network localhost`

### Port Already in Use
- Change `PORT` in `.env` file
- Or kill process on port 3000: 
  ```bash
  netstat -ano | findstr :3000
  taskkill /PID <PID> /F
  ```

### File Upload Fails
- Check `uploads/` directory exists
- Verify file size is under 10MB
- Check file type is allowed (PDF, images, documents)

## 📝 Development Scripts

```bash
npm start         # Start production server
npm run dev       # Start development server with auto-reload
npm run compile   # Compile smart contracts
npm run deploy    # Deploy smart contracts
npm run node      # Start Hardhat blockchain node
npm test          # Run smart contract tests
```

## 🌐 Production Deployment

For production deployment:

1. Use a production-grade database (MySQL in production mode)
2. Deploy smart contracts to Ethereum mainnet or testnet (Sepolia)
3. Update `BLOCKCHAIN_RPC_URL` to use Infura or Alchemy
4. Set strong `JWT_SECRET`
5. Enable HTTPS
6. Use environment-specific `.env` files
7. Implement rate limiting and additional security measures

## 📄 License

MIT License

## 👨‍💻 Support

For issues or questions:
- Check the troubleshooting section
- Review API documentation
- Check blockchain transaction logs
- Review server console logs

## 🎯 Key Takeaways

This system demonstrates:
- ✅ Hybrid blockchain architecture (best of both worlds)
- ✅ Practical healthcare data management
- ✅ Smart contract access control
- ✅ Data integrity verification
- ✅ Role-based authentication
- ✅ Modern web application development

---

**Happy Coding! 🚀**
"# vital-chain" 
"# vital-chain" 
