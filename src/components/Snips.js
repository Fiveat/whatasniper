// src/components/Snips.js
import React from "react";
import "./Snips.css";

function Snips() {
  // Ejemplo: añadimos 'logo' en los 3 primeros
  const snips = [
    {
      id: 1,
      tokenID: "0.0.123564789",
      hbar: 246,
      logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Bitcoin.svg/1200px-Bitcoin.svg.png", // Ejemplo
    },
    {
      id: 2,
      tokenID: "0.0.987654321",
      hbar: 300,
      logo: "https://pbs.twimg.com/profile_images/1802465571218259968/ff0UOB1b_400x400.jpg",
    },
    {
      id: 3,
      tokenID: "0.0.222222222",
      hbar: 999,
      logo: "https://pbs.twimg.com/profile_images/1881842579643269120/11wyP853_400x400.jpg",
    },
    { id: 4, tokenID: "0.0.555555555", hbar: 120 },
    { id: 5, tokenID: "0.0.777777777", hbar: 888 },
    { id: 6, tokenID: "0.0.444444444", hbar: 350 },
    { id: 7, tokenID: "0.0.333333333", hbar: 150 },
  ];

  return (
    <div className="my-snips-container">
      <div className="my-snips-header">
        <h2>My Snips</h2>
        <div className="active-label">active</div>
      </div>
      <div className="snips-list">
        {snips.map((snip) => (
          <div key={snip.id} className="snip-item">
            <div className="snip-header">
              {/* Si existe logo, lo mostramos */}
              {snip.logo && (
                <img
                  src={snip.logo}
                  alt="Logo"
                  className="snip-logo"
                />
              )}
              <span className="snip-token">TOKEN ID: {snip.tokenID}</span>
            </div>
            <span className="snip-amount">snip: {snip.hbar} HBAR</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Snips;
