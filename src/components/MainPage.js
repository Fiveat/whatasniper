import React from "react";
import "./MainPage.css"; // Asegúrate que la ruta coincide con tu estructura
import iconMain from "../assets/Sniper.jpg"; // Imagen para el botón principal
import iconSoon from "../assets/ComingSoon.jpg"; // Imagen para los botones "soon"

const MainPage = ({ onSelectPage, accountId }) => {
  // Manejador de clics; recibe el evento para agregar el efecto shake si la wallet no está conectada.
  const handleClick = (e, page) => {
    if (!accountId) {
      const el = e.currentTarget;
      el.classList.add("shake");
      setTimeout(() => {
        el.classList.remove("shake");
      }, 500);
      alert("Wallet not connected");
      return;
    }
    onSelectPage(page);
  };

  return (
    <div className="main-page">
      <div className="button-grid">
        {/* Botón para mostrar el contenido principal */}
        <div
          className="diamond-button"
          onClick={(e) => handleClick(e, "maincontent")}
        >
          <div className="inner-content">
            <img
              src={iconMain}
              alt="Contenido Principal"
              className="btn-image"
            />
            <p>Contenido Principal</p>
          </div>
        </div>
        {/* Resto de botones, mostrando "Soon" */}
        {[1, 2, 3].map((item) => (
          <div
            key={item}
            className="diamond-button"
            onClick={(e) => handleClick(e, "soon")}
          >
            <div className="inner-content">
              <img src={iconSoon} alt="Soon" className="btn-image" />
              <p>Soon</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MainPage;
