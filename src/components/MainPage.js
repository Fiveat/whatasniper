import React from "react";
import "../styles/MainPage.css"; // Ajusta la ruta según tu estructura
import iconMain from "../assets/iconMain.png"; // Imagen para el botón principal
import iconSoon from "../assets/soon.png"; // Imagen para los botones "soon"

const MainPage = ({ onSelectPage }) => {
  // onSelectPage será una función que actualice la página seleccionada en App.js

  return (
    <div className="main-page">
      <div className="button-grid">
        {/* Primer botón: muestra contenido principal */}
        <div className="diamond-button" onClick={() => onSelectPage("maincontent")}>
          <div className="inner-content">
            <img src={iconMain} alt="Icono principal" className="btn-image" />
            <p>Contenido Principal</p>
          </div>
        </div>

        {/* Botones restantes: muestran "soon" */}
        {[1, 2, 3].map((item) => (
          <div key={item} className="diamond-button" onClick={() => onSelectPage("soon")}>
            <div className="inner-content">
              <img src={iconSoon} alt="Próximamente" className="btn-image" />
              <p>Soon</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MainPage;
