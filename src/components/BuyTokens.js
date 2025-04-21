// src/components/BuyTokens.js
import React, { useState, useEffect } from "react";
import "./BuyTokens.css";
import "./Message.css";
import "../components/MainContent.css"; // Estilos para encabezado

import headerAccessImg from "../assets/TokensHeader.jpg"; // Imagen del encabezado
import wsnipImg from "../assets/WSNIP.jpg";
import soonImg from "../assets/ComingSoon.jpg";

import { useWallet } from "@buidlerlabs/hashgraph-react-wallets";
import {
  KabilaConnector,
  HashpackConnector,
} from "@buidlerlabs/hashgraph-react-wallets/connectors";
import {
  TransferTransaction,
  TokenId,
  AccountId,
} from "@hashgraph/sdk";

import Message from "./Message";

// Constantes de configuración
const WSNIP_TOKEN_ID = "0.0.12345";          // ID del token WSNIP
const USDC_TOKEN_ID = "0.0.456858";           // ID del token USDC
const USDC_DECIMALS = 6;                       // Decimales de USDC en Hedera
const ADMIN_ACCOUNT_ID = "0.0.12345";         // Cuenta receptora de USDC

// Obtiene balance de cualquier token fungible para la cuenta
async function fetchTokenBalance(accountId, tokenId) {
  const baseUrl = "https://mainnet.mirrornode.hedera.com";
  const url = `${baseUrl}/api/v1/accounts/${accountId}/tokens?limit=100`;
  const resp = await fetch(url);
  const data = await resp.json();
  const token = data.tokens.find(t => t.token_id === tokenId);
  return token ? parseInt(token.balance, 10) : 0;
}

function BuyTokens({ accountId }) {
  // Detección de wallet (Kabila o Hashpack)
  const { isConnected: kc, signer: signerKabila } = useWallet(KabilaConnector);
  const { isConnected: hc, signer: signerHashpack } = useWallet(HashpackConnector);
  const isConnected = kc || hc;
  const signer = kc ? signerKabila : hc ? signerHashpack : null;

  // Estados locales
  const [wsnipBalance, setWsnipBalance] = useState(null);
  const [WSNIPS_Amount, setWSNIPS_Amount] = useState(5);
  const [message, setMessage] = useState("");

  // Al montar / cambiar accountId, obtenemos balance de WSNIP
  useEffect(() => {
    if (!accountId) return;
    fetchTokenBalance(accountId, WSNIP_TOKEN_ID).then(setWsnipBalance);
  }, [accountId]);

  // Función para procesar la compra
  const handleBuy = async () => {
    if (!isConnected || !signer) {
      alert("Wallet not connected");
      return;
    }
    if (WSNIPS_Amount < 5) {
      setMessage("La cantidad mínima es 5 WSNIP");
      return;
    }

    // Convertir USDC a unidades de token según decimales
    const amountUnits = WSNIPS_Amount * Math.pow(10, USDC_DECIMALS);

    try {
      setMessage("Enviando transacción...");
      const tx = new TransferTransaction()
        // Debita USDC de la cuenta del usuario
        .addTokenTransfer(
          TokenId.fromString(USDC_TOKEN_ID),
          AccountId.fromString(accountId),
          -amountUnits
        )
        // Acredita USDC a la cuenta administradora
        .addTokenTransfer(
          TokenId.fromString(USDC_TOKEN_ID),
          AccountId.fromString(ADMIN_ACCOUNT_ID),
          amountUnits
        )
        .setTransactionMemo("Compras de WSNIP By WhataLab");

      const populated = await signer.populateTransaction(tx);
      const signed = await signer.signTransaction(populated);
      const resp = await signed.executeWithSigner(signer);
      await resp.getReceiptWithSigner(signer);

      setMessage("Compra completada!");
      // Actualizar balance de WSNIP tras la compra
      const newBal = await fetchTokenBalance(accountId, WSNIP_TOKEN_ID);
      setWsnipBalance(newBal);
    } catch (err) {
      console.error(err);
      setMessage("Error en la transacción: " + err.message);
    }
  };

  return (
    <div className="buytokens-container">
      {/* Botón < Back */}
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

      {/* Encabezado con estilo MainContent */}
      <div className="top-section">
        <div className="top-left">
          <div className="tool-icon-block">
            <img src={headerAccessImg} alt="Tokens Header" className="icon-bg" />
          </div>
          <div className="tool-text-block">
            <span className="tool-label">ACCESS TOKENS</span>
            <span className="tool-title">ORDER YOUR ACCESS TOKENS</span>
          </div>
          <div className="description-box">
            <span className="desc-label">DESCRIPTION</span>
            <span className="desc-text">
            Acquire tokens that grant access to our many exclusive tools. <b>NEW: WhataSniper</b>
            </span>
          </div>
        </div>
      </div>

      {/* Grid de productos */}
      <div className="products-grid">
        {/* Tarjeta de WSNIP */}
        <div className="product-card">
          <img src={wsnipImg} alt="WSNIP" className="product-img" />
          <h3>WSNIP</h3>
          {/* Mostrar balance dentro de la tarjeta */}
          {wsnipBalance !== null && (
            <p className="balance-text">
              Holds <strong>{wsnipBalance}</strong> WSNIP
            </p>
          )}
          <p>
          Each token gives you access to create an order with our SNIPER.
          The WSNIPER is a tool that allows you to create an automatic, real-time order to purchase NFTs under a specific price condition.
          </p>
          <div className="input-group">
            <label htmlFor="WSNIPS_Amount">
              WSNIP to purchase
              <Message text="Minimum quantity: 5 WSNIPS" />
            </label>
            <input
              id="WSNIPS_Amount"
              type="number"
              min="5"
              step="1"
              value={WSNIPS_Amount}
              onChange={e => setWSNIPS_Amount(parseInt(e.target.value, 10) || 5)}
              className="quantity-input"
            />
          </div>
          <span className="price-banner">{WSNIPS_Amount} USDC</span>
          <button className="buy-btn" onClick={handleBuy}>
            BUY
          </button>
          {message && (
            <div className={`message ${message.startsWith("Error") ? "error" : "success"}`}>
              {message}
            </div>
          )}
        </div>
        {/* Placeholders SOON */}
        {[1, 2, 3].map(i => (
          <div key={i} className="product-card soon-card">
            <img src={soonImg} alt="Soon" className="product-img" />
            <h3>SOON</h3>
            <p>Get in touch</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default BuyTokens;
