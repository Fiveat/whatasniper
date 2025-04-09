// src/App.js
import React, { useState } from "react";
import Header from "./components/Header";
import MainContent from "./components/MainContent";
import Footer from "./components/Footer";
import Modal from "./modal";
import "./App.css";

function App() {
  const [isModalOpen, setModalOpen] = useState(false);

  // Estado para guardar el accountId que viene de Header
  const [accountId, setAccountId] = useState(null);

  const handleCreate = () => {
    alert("Create sniper");
  };

  return (
    <div className="app-container">
      {/* Pasamos setParentAccountId al Header para que nos notifique */}
      <Header onOpenModal={() => setModalOpen(true)} setParentAccountId={setAccountId} />
      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} />

      {/*
        Pasamos accountId al MainContent para que haga
        la lógica de lectura/creación de usuario en Supabase
      */}
      <MainContent handleCreate={handleCreate} accountId={accountId} />

      <Footer />
    </div>
  );
}

export default App;
