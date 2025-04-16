import React from "react";
import "./SoonPage.css"; // Si deseas aplicar estilos personalizados

const SoonPage = ({ accountId }) => {
  if (!accountId) {
    return (
      <div className="soon-page">
        <p>
          Wallet not connected. Please connect your wallet to access options.
        </p>
      </div>
    );
  }
  return (
    <div className="soon-page">
      <h1>Soon</h1>
    </div>
  );
};

export default SoonPage;
