import { useState, useEffect } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import QRCode from 'react-qr-code';
import { Scanner } from '@yudiel/react-qr-scanner';
import './App.css';
import { auth, db } from './firebase-config1';

function App() {
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  
  const [user, setUser] = useState(null);
  
  const [scanInput, setScanInput] = useState(""); 
  const [showCamera, setShowCamera] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false); 
  
  // DEFAULT TO TRUE: Students are opted-in by default now
  const [meals, setMeals] = useState({
    breakfast: { optedIn: true, scanned: false },
    lunch: { optedIn: true, scanned: false },
    dinner: { optedIn: true, scanned: false }
  });

  const today = new Date().toISOString().split('T')[0];
  const currentHour = new Date().getHours();

  const isBreakfastLocked = currentHour >= 6;
  const isLunchLocked = currentHour >= 11;
  const isDinnerLocked = currentHour >= 18;

  useEffect(() => {
    onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser && currentUser.email !== "admin@gmail.com") {
        fetchTodayData(currentUser.uid, currentUser.email); 
      }
    });
  }, []);

  const fetchTodayData = async (uid, email) => {
    try {
      const docRef = doc(db, "mess_records", `${uid}_${today}`);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setMeals(docSnap.data().meals);
      } else {
        // NEW DAY DEFAULT: All meals set to TRUE
        const defaultMeals = {
          breakfast: { optedIn: true, scanned: false },
          lunch: { optedIn: true, scanned: false },
          dinner: { optedIn: true, scanned: false }
        };
        await setDoc(docRef, { email: email, date: today, meals: defaultMeals });
        setMeals(defaultMeals);
      }
    } catch (error) {
      console.log("Setup Error:", error);
    }
  };

  const toggleMeal = async (mealName, isLocked) => {
    if (isLocked) return alert(`Sorry, ${mealName} is locked for today!`);
    
    const newValue = !meals[mealName].optedIn;
    const updatedMeals = { ...meals, [mealName]: { ...meals[mealName], optedIn: newValue } };
    
    setMeals(updatedMeals); 
    
    try {
      const docRef = doc(db, "mess_records", `${user.uid}_${today}`);
      await setDoc(docRef, { meals: updatedMeals }, { merge: true });
    } catch (error) {
      alert("Firebase Error: " + error.message);
    }
  };

  const processScan = async (scanString) => {
    if (!scanString || !scanString.includes('-')) return alert("Invalid QR Format! Must contain meal type.");
    if (isProcessing) return; 
    
    setIsProcessing(true);
    
    const [scannedUid, scannedMeal] = scanString.split('-');

    try {
      const docRef = doc(db, "mess_records", `${scannedUid}_${today}`);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        alert(" No record found for this student today!");
        setIsProcessing(false);
        return;
      }

      const studentData = docSnap.data();
      const mealData = studentData.meals[scannedMeal];

      if (!mealData) {
        alert(" Invalid meal type scanned!");
      } else if (!mealData.optedIn) {
        alert(` DENIED: Student did NOT opt-in for ${scannedMeal.toUpperCase()} today.`);
      } else if (mealData.scanned) {
        alert(` ALREADY USED: Student already ate ${scannedMeal.toUpperCase()}!`);
      } else {
        studentData.meals[scannedMeal].scanned = true;
        await setDoc(docRef, { meals: studentData.meals }, { merge: true });
        alert(` SUCCESS: ${scannedMeal.toUpperCase()} approved for ${studentData.email}`);
        setShowCamera(false); 
      }
      setScanInput(""); 
    } catch (error) {
      alert("Database error: " + error.message);
    }
    
    setTimeout(() => setIsProcessing(false), 1500); 
  };

  const register = async () => {
    try { await createUserWithEmailAndPassword(auth, registerEmail, registerPassword); } 
    catch (error) { alert(error.message); }
  };
  const login = async () => {
    try { await signInWithEmailAndPassword(auth, loginEmail, loginPassword); } 
    catch (error) { alert(error.message); }
  };
  const logout = async () => await signOut(auth);

  if (user && user.email === "admin@gmail.com") {
    return (
      <div className="app-background">
        <div className="dashboard-card admin-card">
          <h2>Admin Dashboard</h2>
          <h3>Verify Today's Meals</h3>
          
          <div className="scanner-section">
            {showCamera ? (
              <div className="scanner-box">
                <Scanner 
                  onScan={(result) => processScan(result[0].rawValue)} 
                  onError={(error) => console.log(error)}
                />
                <button className="btn-no mt-10" onClick={() => setShowCamera(false)}>Close Camera</button>
              </div>
            ) : (
              <button className="btn-primary" onClick={() => setShowCamera(true)}>📷 Open Camera Scanner</button>
            )}
          </div>

          <p className="divider-text">OR ENTER MANUALLY (Format: UID-meal)</p>

          <input 
            placeholder="e.g. j1s9s-lunch" 
            value={scanInput} 
            onChange={(e) => setScanInput(e.target.value)} 
          />
          <button className="btn-secondary mt-10" onClick={() => processScan(scanInput)}>Verify Manual ID</button>
          
          <button className="btn-logout mt-10" onClick={logout}>Sign Out</button>
        </div>
      </div>
    );
  }

  if (user && user.email !== "admin@gmail.com") {
    return (
      <div className="app-background">
        <div className="dashboard-card student-card">
          <h2>Mess Menu: {today}</h2>
          
          <div className="meal-container">
            <div className={`meal-row ${isBreakfastLocked ? 'locked' : ''}`}>
              <div className="meal-info">
                <h4>Breakfast (8 AM)</h4>
                <p>{isBreakfastLocked ? "Locked at 6 AM" : "Closes at 6 AM"}</p>
              </div>
              <div className="meal-actions">
                {meals.breakfast.optedIn && (
                  <div className="mini-qr">
                    <QRCode value={`${user.uid}-breakfast`} size={90} />
                  </div>
                )}
                <button className={meals.breakfast.optedIn ? "btn-yes" : "btn-no"} onClick={() => toggleMeal('breakfast', isBreakfastLocked)}>
                  {meals.breakfast.optedIn ? "YES" : "NO"}
                </button>
              </div>
            </div>

            <div className={`meal-row ${isLunchLocked ? 'locked' : ''}`}>
              <div className="meal-info">
                <h4>Lunch (1 PM)</h4>
                <p>{isLunchLocked ? "Locked at 11 AM" : "Closes at 11 AM"}</p>
              </div>
              <div className="meal-actions">
                {meals.lunch.optedIn && (
                  <div className="mini-qr">
                    <QRCode value={`${user.uid}-lunch`} size={90} />
                  </div>
                )}
                <button className={meals.lunch.optedIn ? "btn-yes" : "btn-no"} onClick={() => toggleMeal('lunch', isLunchLocked)}>
                  {meals.lunch.optedIn ? "YES" : "NO"}
                </button>
              </div>
            </div>

            <div className={`meal-row ${isDinnerLocked ? 'locked' : ''}`}>
              <div className="meal-info">
                <h4>Dinner (8 PM)</h4>
                <p>{isDinnerLocked ? "Locked at 6 PM" : "Closes at 6 PM"}</p>
              </div>
              <div className="meal-actions">
                {meals.dinner.optedIn && (
                  <div className="mini-qr">
                    <QRCode value={`${user.uid}-dinner`} size={90} />
                  </div>
                )}
                <button className={meals.dinner.optedIn ? "btn-yes" : "btn-no"} onClick={() => toggleMeal('dinner', isDinnerLocked)}>
                  {meals.dinner.optedIn ? "YES" : "NO"}
                </button>
              </div>
            </div>
          </div>

          <div className="qr-container">
            <p className="qr-id">Student ID: {user.uid}</p>
          </div>

          <button className="btn-logout" onClick={logout}>Sign Out</button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-background">
    <div className="app-background">
      <marquee className="scrolling">
         🍔 🍕 Pehle Pet Pooja, Fir Kaam Dooja! 💻 🚀
      </marquee></div>
      <h1 className="main-title">PehlePetPooja</h1>
      <div className="auth-container">
        <div className="auth-card">
          <h3>Register</h3>
          <input placeholder="Email.." onChange={(e) => setRegisterEmail(e.target.value)} />
          <input placeholder="Password.." type="password" onChange={(e) => setRegisterPassword(e.target.value)} />
          <button className="btn-primary mt-10" onClick={register}>Sign Up</button>
        </div>
        <div className="auth-card">
          <h3>Login</h3>
          <input placeholder="Email.." onChange={(e) => setLoginEmail(e.target.value)} />
          <input placeholder="Password.." type="password" onChange={(e) => setLoginPassword(e.target.value)} />
          <button className="btn-secondary mt-10" onClick={login}>Log In</button>
        </div>
      </div>
    </div>
  );
}

export default App;