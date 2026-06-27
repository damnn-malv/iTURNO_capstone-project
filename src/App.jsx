import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useState } from "react";
import MainIndex from "./app/dashboard/mainIndex";
import Login from "./pages/Login";

function App() {
  return (
    <>
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard/*" element={<MainIndex />} />
      </Routes>
    </Router>
      
    </>
  );
}

export default App;