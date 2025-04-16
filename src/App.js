import React, { useState } from "react";
import Header from "./components/Header";
import MainContent from "./components/MainContent";
import MainPage from "./components/MainPage";
import SoonPage from "./components/SoonPage";
import Footer from "./components/Footer";
import Modal from "./modal";
import "./App.css";

function App() {
  const [isModalOpen, setModalOpen] = useState(false);
  // Estado central para almacenar el accountId detectado en Header
  const [accountId, setAccountId] = useState(null);
  const [currentPage, setCurrentPage] = useState("mainPage");

  const handleCreate = () => {
    alert("Create sniper");
  };

  const renderPage = () => {
    switch (currentPage) {
      case "mainPage":
        return <MainPage onSelectPage={setCurrentPage} accountId={accountId} />;
      case "maincontent":
        return <MainContent handleCreate={handleCreate} accountId={accountId} />;
      case "soon":
        return <SoonPage accountId={accountId} />;
      default:
        return <MainPage onSelectPage={setCurrentPage} accountId={accountId} />;
    }
  };

  return (
    <div className="app-container">
      <Header onOpenModal={() => setModalOpen(true)} setParentAccountId={setAccountId} />
      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} />
      {renderPage()}
      <Footer />
    </div>
  );
}

export default App;
