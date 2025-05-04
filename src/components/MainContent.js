// src/components/MainContent.js
import React, { useState, useEffect } from "react";
import SniperCard from "./SniperCard";
import Sidebar from "./Snips";
import iconBg from "../assets/Icon bg.svg";
import circlesThreePlus from "../assets/CirclesThreePlus.svg";
import "./MainContent.css";

import { supabase } from "../config/supabaseClient";

/*
 * Token Hedera usado como “créditos de uso” ⇒ balance en wallet = LIBRES
 * Este token tiene 2 decimales, así que cada «100» unidades on‑chain = 1 crédito real.
 */
const CREDIT_TOKEN_ID = "0.0.6455559";
const TOKEN_DECIMALS = 0; // ←👈 importante: controla el redondeo a INT
const MIRROR_API = "https://mainnet-public.mirrornode.hedera.com/api/v1";

const MainContent = ({ handleCreate, accountId }) => {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  // ────────────────────────────────────────────────
  //  ESTADOS
  // ────────────────────────────────────────────────
  const [usos, setUsos] = useState(0);               // LIBRES (balance INT)
  const [usosTotales, setUsosTotales] = useState(0); // TOTALES (tokens comprados)
  const [usadosReal, setUsadosReal] = useState(0);   // USADOS  (tokens gastados)
  const [booster, setBooster] = useState(0);
  const [boosterUsed, setBoosterUsed] = useState(0);

  /* ------------------------------------------------------------------
   *  helper → obtiene el balance INT (sin decimales) del token
   * ------------------------------------------------------------------ */
  const fetchTokenBalance = async (wallet) => {
    try {
      const resp = await fetch(`${MIRROR_API}/accounts/${wallet}/tokens?token.id=${CREDIT_TOKEN_ID}`);
      const json = await resp.json();
      const entry = json?.tokens?.find((t) => t.token_id === CREDIT_TOKEN_ID);
      const raw = Number(entry?.balance || 0);              // valor on‑chain (incluye decimales)
      const human = Math.floor(raw / 10 ** TOKEN_DECIMALS); // quitamos decimales ⇒ entero usable
      return human;
    } catch (err) {
      console.error("fetchTokenBalance error:", err);
      return 0;
    }
  };

  /* ------------------------------------------------------------------
   *  1️⃣  useEffect  → Alta‑segura o lectura de la fila en "usuarios"
   * ------------------------------------------------------------------ */
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
            .insert({ wallet_id: accountId, usos: 0, usos_totales: 0, booster: 3 })
            .select("*")
            .single();

          if (insertError) {
            console.error("Error al crear el usuario:", insertError);
            return;
          }
          data = newData;
        }

        setBooster(data.booster || 0);
      } catch (err) {
        console.error("Error en upsertAndFetchUser:", err);
      }
    };

    upsertAndFetchUser();
  }, [accountId]);

  /* ------------------------------------------------------------------
   *  2️⃣  useEffect  → Manejo del resize (sin cambios)
   * ------------------------------------------------------------------ */
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  /* ------------------------------------------------------------------
   *  3️⃣  useEffect  → Fuente de la verdad para TOTALES / USADOS / LIBRES
   *      - TOTALES  = SUM(amount) de wsnip_purchases  (sender = wallet)
   *      - USADOS   = COUNT(*)    de snips            (wallet_id = wallet)
   *      - LIBRES   = BALANCE INT del token CREDIT_TOKEN_ID
   * ------------------------------------------------------------------ */
  useEffect(() => {
    if (!accountId) return;

    const refreshUsage = async () => {
      try {
        /* 📊  TOTALES */
        const { data: purchases, error: pErr } = await supabase
          .from("wsnip_purchases")
          .select("amount")
          .eq("sender", accountId);
        if (pErr) throw pErr;
        const totalTokens = (purchases ?? []).reduce((acc, r) => acc + Number(r.amount || 0), 0);

        /* 📊  USADOS */
        const { count: usedCount, error: sErr } = await supabase
          .from("snips")
          .select("wallet_id", { count: "exact", head: true })
          .eq("wallet_id", accountId);
        if (sErr) throw sErr;
        const used = Number(usedCount || 0);

        /* 📊  LIBRES (INT) */
        const balanceInt = await fetchTokenBalance(accountId);

        /*  Actualizamos estados */
        setUsosTotales(totalTokens);
        setUsadosReal(used);
        setUsos(balanceInt);

        console.debug("[refreshUsage] total", totalTokens, "used", used, "freeInt", balanceInt);
      } catch (err) {
        console.error("refreshUsage error:", err);
      }
    };

    refreshUsage();

    // 🔔 realtime subs
    const purchasesSub = supabase
      .channel("wsnip_purchases_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "wsnip_purchases", filter: `sender=eq.${accountId}` }, refreshUsage)
      .subscribe();

    const snipsSub = supabase
      .channel("snips_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "snips", filter: `wallet_id=eq.${accountId}` }, refreshUsage)
      .subscribe();

    return () => {
      supabase.removeChannel(purchasesSub);
      supabase.removeChannel(snipsSub);
    };
  }, [accountId]);

  /* ------------------------------------------------------------- */
  const usados = usadosReal; // mostrado en UI
  /* ------------------------------------------------------------- */

  const handleBoosterClick = () => {
    setBoosterUsed((prev) => (prev < booster ? prev + 1 : 0));
  };

  const isMaxed = boosterUsed >= booster;
  const boosterIconClass = isMaxed ? "booster-icon booster-icon-max" : "booster-icon";

  return (
    <main className="main-content">
      <div className="back-label" style={{ margin: "0.5rem 0", fontSize: 16, color: "#26e2b3", cursor: "pointer", textAlign: "left" }} onClick={() => (window.location.href = "/")}> &lt; Back </div>

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
            <span className="desc-text">Snag exclusive Hedera Hashgraph NFTs first! Our pioneering NFT Sniper gives you the edge on launches and rarities. Join the Hedera NFT revolution!</span>
          </div>
        </div>

        {/* SECCIÓN DERECHA */}
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
              <div className={boosterIconClass} onClick={handleBoosterClick} style={{ cursor: "pointer" }} />
              {!isMaxed && <span className="booster-text">{boosterUsed}/{booster}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* SECCIÓN INFERIOR */}
      <div className="bottom-section">
        {windowWidth > 768 && <div className="bottom-left"><Sidebar /></div>}
        <div className="bottom-right"><SniperCard handleCreate={handleCreate} boosterUsed={boosterUsed} /></div>
      </div>
    </main>
  );
};

export default MainContent;
