// src/components/MainContent.js
import React, { useState, useEffect } from "react";
import SniperCard from "./SniperCard";
import Sidebar from "./Snips";
import iconBg from "../assets/Icon bg.svg";
import circlesThreePlus from "../assets/CirclesThreePlus.svg";
import "./MainContent.css";

import { supabase } from "../config/supabaseClient";

const MainContent = ({ handleCreate, accountId }) => {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  // Estados para los datos de la tabla usuarios
  const [usos, setUsos] = useState(0);
  const [usosTotales, setUsosTotales] = useState(0);
  const [booster, setBooster] = useState(0);
  
  // Estado local para el contador de booster
  const [boosterUsed, setBoosterUsed] = useState(0);

  useEffect(() => {
    const upsertAndFetchUser = async () => {
      if (!accountId) return;
      try {
        let { data, error } = await supabase
          .from("usuarios")
          .select("*")
          .eq("wallet_id", accountId)
          .maybeSingle();

        if (error) {
          console.error("Error buscando el usuario:", error);
          return;
        }

        if (!data) {
          const { data: newData, error: insertError } = await supabase
            .from("usuarios")
            .insert({
              wallet_id: accountId,
              usos: 5,
              usos_totales: 5,
              booster: 3,
            })
            .select("*")
            .single();

          if (insertError) {
            console.error("Error al crear el usuario:", insertError);
            return;
          }
          data = newData;
        }

        setUsos(data.usos || 0);
        setUsosTotales(data.usos_totales || 0);
        setBooster(data.booster || 0);
      } catch (err) {
        console.error("Error en upsertAndFetchUser:", err);
      }
    };

    upsertAndFetchUser();
  }, [accountId]);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const usados = usosTotales - usos;

  // Si boosterUsed < booster, incrementa; si ya alcanzó el máximo, reinicia al hacer clic.
  const handleBoosterClick = () => {
    if (boosterUsed < booster) {
      setBoosterUsed(boosterUsed + 1);
    } else {
      setBoosterUsed(0);
    }
  };

  // Cuando se alcanza o supera el máximo, se oculta el texto
  const isMaxed = boosterUsed >= booster;
  const boosterIconClass = isMaxed
    ? "booster-icon booster-icon-max"
    : "booster-icon";

  return (
    <main className="main-content">
      {/* NUEVO: Label "< Back" ajustado para volver a mainpage.js */}
      <div
        className="back-label"
        style={{
          margin: "0.5rem 0",
          fontSize: "16px",
          color: "#26e2b3",
          cursor: "pointer",
          textAlign: "left"
        }}
        onClick={() => (window.location.href = "/")}
      >
        &lt; Back
      </div>

      {/* SECCIÓN SUPERIOR */}
      <div className="top-section">
        <div className="top-left">
          <div className="tool-icon-block">
            <img src={iconBg} alt="Icon background" className="icon-bg" />
            <img src={circlesThreePlus} alt="Circles plus" className="circles-plus" />
          </div>
          <div className="tool-text-block">
            <span className="tool-label">TOOL</span>
            <span className="tool-title">WℏataSniper</span>
          </div>
          <div className="description-box">
            <span className="desc-label">DESCRIPTION</span>
            <span className="desc-text">
              Snag exclusive Hedera Hashgraph NFTs first! Our pioneering NFT Sniper gives you the edge on launches and rarities. Join the Hedera NFT revolution!
            </span>
          </div>
        </div>

        {/* SECCIÓN DERECHA: USAGE COUNTER, STATUS y BOOSTER */}
        <div className="top-right">
          <div className="usage-counter">
            <span className="usage-label">USAGE COUNTER</span>
            <div className="usage-stats">
              <div className="usage-column">
                <span className="stat-label">USADOS</span>
                <span className="stat-value">{usados}</span>
              </div>
              <div className="usage-column">
                <span className="stat-label">LIBRES</span>
                <span className="stat-value">{usos}</span>
              </div>
              <div className="usage-column totales-col">
                <span className="stat-label">TOTALES</span>
                <span className="stat-value">{usosTotales}</span>
              </div>
            </div>
          </div>
          <div className="status-block">
            <span className="status-label">STATUS</span>
            <div className="status-indicator">
              <div className="dot"></div>
              <span className="status-text">AVAILABLE</span>
            </div>
          </div>
          <div className="booster-block">
            <span className="booster-label">BOOSTER</span>
            <div className="booster-indicator">
              {/* En caso de máximo, solo se muestra el ícono */}
              <div
                className={boosterIconClass}
                onClick={handleBoosterClick}
                style={{ cursor: "pointer" }}
              />
              {/* Ocultamos el texto cuando se ha alcanzado el máximo */}
              {!isMaxed && (
                <span className="booster-text">
                  {boosterUsed}/{booster}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SECCIÓN INFERIOR: My Snips + SniperCard */}
      <div className="bottom-section">
        {windowWidth > 768 && (
          <div className="bottom-left">
            <Sidebar />
          </div>
        )}
        <div className="bottom-right">
          <SniperCard handleCreate={handleCreate} boosterUsed={boosterUsed} />
        </div>
      </div>
    </main>
  );
};

export default MainContent;
