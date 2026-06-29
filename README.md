# Confidential Teacher Evaluation Web App

A full-stack anonymous voting system demonstrating Lattice-Based Cryptography (LWE-style) over a 2D vector space. This college mini-project shows how homomorphic encryption can enable privacy-preserving voting where votes are encrypted on the client side, aggregated blindly on the server, and decrypted only once to reveal the aggregate tally.

## 🎯 Project Overview

This application implements a simplified Learning With Errors (LWE) cryptographic scheme to ensure:
- **Individual Privacy**: Votes are encrypted before transmission and cannot be traced to students
- **Homomorphic Aggregation**: Encrypted votes can be summed without decryption
- **Aggregate Revelation**: Only the total tally is decrypted, preserving individual vote privacy

## 🏗️ Architecture

### Backend (Node.js + Express + Socket.IO)
- **server.js**: Main entry point with Express + Socket.IO setup
- **crypto/lwe.js**: LWE cryptographic engine (identical to frontend)
- **data/students.js**: Student roster management (loaded from .env)
- **data/votes.js**: Encrypted votes storage (no student identifiers)
- **routes/auth.js**: Login endpoint with anonymous session tokens
- **routes/vote.js**: Vote submission and retrieval endpoints

### Frontend (React + Vite + Tailwind CSS)
- **crypto/lwe.js**: LWE cryptographic engine (client-side encryption)
- **lib/socket.js**: Socket.IO client for real-time updates
- **pages/PresenterDashboard.jsx**: Live results dashboard with decryption
- **pages/StudentBooth.jsx**: Mobile voting interface

## 🔐 Cryptography Explained

### The LWE Scheme (Simplified 2D)

**Field**: Integers modulo 17 (Z_17)

**Private Key** (Good Basis): `s = [4, 1]` - Known only to the presenter

**Public Key** (Bad/Skewed Basis):
- `P1 = { vector: [2, 5], constant: 14 }`
- `P2 = { vector: [3, 2], constant: 15 }`

**Scaling Factor**: `delta = 8` (≈ q/2)

**Message Encoding**: `m ∈ {0, 1, 2}` maps to `m * 8`:
- Poor (0) → 0
- Average (1) → 8
- Excellent (2) → 16

### Encryption Algorithm

```
encryptVote(m):
  1. Pick random bits r1, r2 ∈ {0,1}  // Provides semantic security
  2. cA = r1*P1.vector + r2*P2.vector (mod 17)
  3. cB = r1*P1.constant + r2*P2.constant + m*8 (mod 17)
  4. Return { vector_cA: cA, scalar_cB: cB }
```

**Why random bits?** The random bits r1, r2 ensure the same message encrypts differently each time, preventing an attacker from linking votes to students by comparing ciphertexts.

### Homomorphic Addition

```
addCiphertexts(c1, c2):
  vector_cA = c1.vector_cA + c2.vector_cA (mod 17)
  scalar_cB = c1.scalar_cB + c2.scalar_cB (mod 17)
```

**Why this works**: The homomorphic property allows the server to sum encrypted votes without decryption. The noise accumulates but remains bounded due to the scaling factor.

### Decryption Algorithm

```
decryptAggregate(aggregateCiphertext, numVotes):
  1. noisy = (cB - dot(cA, s)) mod 17
  2. Find candidateSum ∈ [0, 2*numVotes] minimizing circular distance
     between noisy and (candidateSum*8 mod 17)
  3. Return decodedSum, averageScore, noisy
```

**Why snapping works**: The circular distance handles wrap-around in modular arithmetic. The candidate sum whose encoding is closest to the noisy coordinate is the decoded total.

## 🔒 Privacy Guarantees

### Complete Data Separation

**Student Roster Table** (`data/students.js`):
- Stores: `{ name, usn, hasVoted }`
- No vote data, no links to votes table

**Encrypted Votes Table** (`data/votes.js`):
- Stores: `{ vector_cA: [a,b], scalar_cB: c }`
- No names, no USNs, no timestamps, no identifiers

**No Shared Keys**: There are no foreign keys, no shared IDs, no references between tables. Even with full server access, it's cryptographically impossible to link votes to students.

### Token System

- Login validates against roster and marks `hasVoted = true` **before** issuing token
- Token is single-use and expires after 5 minutes
- Token contains no student information
- Token is consumed immediately after vote submission

### Client-Side Encryption

- Votes are encrypted in the browser using the LWE scheme
- Only the encrypted ciphertext is sent to the server
- Server never sees plaintext vote values
- Confirmation screen shows the ciphertext (proving it's unreadable)

## 🚀 Setup Instructions

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Backend Setup

1. **Navigate to backend directory**:
   ```bash
   cd backend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   - The `.env` file is already created with sample students
   - Edit `backend/.env` to customize the student roster:
     ```
     PORT=4000
     STUDENT_ROSTER=[{"name":"Alice Johnson","usn":"1MS21CS001"},{"name":"Bob Smith","usn":"1MS21CS002"}]
     ```
   - Format: JSON array string with `name` and `usn` fields

4. **Start the backend server**:
   ```bash
   npm start
   ```
   - Server runs on `http://localhost:4000`
   - You'll see: "🚀 Confidential Teacher Evaluation Server"

### Frontend Setup

1. **Navigate to frontend directory** (in a new terminal):
   ```bash
   cd frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```
   - Frontend runs on `http://localhost:3000`
   - Vite proxies API calls to the backend

## 📱 Usage

### For Students (Voting)

1. **Access the voting booth**:
   - Scan the QR code on the presenter's dashboard
   - Or navigate to `http://localhost:3000/vote`

2. **Login**:
   - Enter your name and USN (case-insensitive)
   - Must match the roster in `.env`

3. **Rate the teacher**:
   - Tap Poor (😞), Average (😐), or Excellent (😊)
   - Vote is encrypted locally before submission

4. **Confirmation**:
   - See the encrypted ciphertext (unintelligible)
   - Vote cannot be traced back to you

### For Presenter (Dashboard)

1. **Access the dashboard**:
   - Navigate to `http://localhost:3000`

2. **Share QR code**:
   - Students scan to access voting booth
   - Live vote counter updates in real-time

3. **Monitor encrypted votes**:
   - Middle column shows incoming ciphertexts
   - Updated in real-time via Socket.IO

4. **Decrypt aggregate tally**:
   - Click "🔑 Decrypt Aggregate Tally"
   - Reveals average score (0-2 scale)
   - Shows decoded sum and noisy coordinate

## 🧪 Testing

### Test the Flow

1. **Start both servers** (backend on 4000, frontend on 3000)

2. **Open presenter dashboard**:
   - Go to `http://localhost:3000`
   - Note the QR code and vote counter (0)

3. **Cast votes as students**:
   - Open `http://localhost:3000/vote` in incognito tabs
   - Login with roster credentials (e.g., "Alice Johnson", "1MS21CS001")
   - Submit a few votes with different ratings

4. **Watch real-time updates**:
   - Vote counter increments
   - Ciphertexts appear in the stream

5. **Decrypt the tally**:
   - Click the decrypt button
   - See the average score

### Reset for Testing

The `hasVoted` flag resets on server restart. To test again:
1. Stop the backend server (Ctrl+C)
2. Restart with `npm start`
3. All students can vote again

## 📁 Project Structure

```
cryptography/
├── backend/
│   ├── crypto/
│   │   └── lwe.js              # LWE cryptographic engine
│   ├── data/
│   │   ├── students.js         # Student roster management
│   │   └── votes.js            # Encrypted votes storage
│   ├── routes/
│   │   ├── auth.js             # Login endpoint
│   │   └── vote.js             # Vote submission/retrieval
│   ├── .env                    # Environment variables (gitignored)
│   ├── .env.example           # Example environment variables
│   ├── .gitignore              # Ignore node_modules and .env
│   ├── package.json            # Backend dependencies
│   └── server.js               # Main server entry point
├── frontend/
│   ├── crypto/
│   │   └── lwe.js              # LWE cryptographic engine (client-side)
│   ├── lib/
│   │   └── socket.js           # Socket.IO client
│   ├── src/
│   │   ├── pages/
│   │   │   ├── PresenterDashboard.jsx  # Live results dashboard
│   │   │   └── StudentBooth.jsx        # Voting interface
│   │   ├── App.jsx             # React Router setup
│   │   ├── main.jsx            # React entry point
│   │   └── main.css            # Tailwind directives
│   ├── .gitignore              # Ignore node_modules and dist
│   ├── index.html              # HTML template
│   ├── package.json            # Frontend dependencies
│   ├── postcss.config.js       # PostCSS configuration
│   ├── tailwind.config.js      # Tailwind CSS configuration
│   └── vite.config.js          # Vite configuration
└── README.md                   # This file
```

## 🔧 Technology Stack

### Backend
- **Node.js** + **Express** - REST API server
- **Socket.IO** - Real-time vote broadcasting
- **dotenv** - Environment variable management
- **cors** - Cross-origin resource sharing

### Frontend
- **React** - UI framework
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **React Router** - Client-side routing
- **axios** - HTTP client
- **qrcode.react** - QR code generation
- **socket.io-client** - Real-time updates

## 🎓 Educational Value

This project demonstrates several important concepts:

1. **Lattice-Based Cryptography**: A post-quantum cryptographic approach
2. **Homomorphic Encryption**: Computing on encrypted data
3. **Privacy by Design**: Architectural choices that preserve privacy
4. **Separation of Concerns**: Clear separation between identity and data
5. **Real-Time Web Applications**: Socket.IO for live updates
6. **Full-Stack Development**: End-to-end implementation

## ⚠️ Limitations

This is a simplified educational implementation:

- **Small field size** (Z_17) for demonstration purposes
- **In-memory storage** (data lost on server restart)
- **No persistent database**
- **No authentication beyond roster validation**
- **Single-use tokens expire after 5 minutes**
- **Not suitable for production use**

For a production system, you would need:
- Larger field sizes (Z_2^1024 or larger)
- Persistent database with proper encryption
- Robust authentication and authorization
- Audit logging and compliance features
- Rate limiting and abuse prevention

## 📝 License

MIT License - Feel free to use for educational purposes.

## 🤝 Contributing

This is a college mini-project. Feel free to extend it for learning purposes:
- Add more sophisticated LWE parameters
- Implement persistent storage
- Add vote verification mechanisms
- Extend to multiple-choice questions
- Add statistical analysis features

---

**Built with ❤️ for learning cryptography and privacy-preserving systems**
