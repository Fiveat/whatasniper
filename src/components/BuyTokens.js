// src/components/BuyTokens.js
import React, { useState, useEffect } from "react";
import "./BuyTokens.css";
import "./Message.css";
import "../components/MainContent.css";         // Estilos heredados para el mini-header

import headerAccessImg from "../assets/TokensHeader.jpg";
import wsnipImg        from "../assets/WSNIP.jpg";
import soonImg         from "../assets/ComingSoon.jpg";

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

/* =================== Config =================== */
const WSNIP_TOKEN_ID   = "0.0.12345";   // Token WSNIP
const USDC_TOKEN_ID    = "0.0.456858";  // Token USDC
const USDC_DECIMALS    = 6;             // Decimales USDC
const ADMIN_ACCOUNT_ID = "0.0.12345";   // Wallet receptora USDC

/* ===== Helper: balance por token ===== */
async function fetchTokenBalance(accountId, tokenId) {
  const url   = `https://mainnet.mirrornode.hedera.com/api/v1/accounts/${accountId}/tokens?limit=100`;
  const resp  = await fetch(url);
  const data  = await resp.json();
  const token = data.tokens.find((t) => t.token_id === tokenId);
  return token ? parseInt(token.balance, 10) : 0;
}

/* =================== Componente =================== */
function BuyTokens({ accountId }) {
  /* Wallet detection (Kabila / Hashpack) */
  const { isConnected: kc, signer: signerKabila }   = useWallet(KabilaConnector);
  const { isConnected: hc, signer: signerHashpack } = useWallet(HashpackConnector);
  const isConnected = kc || hc;
  const signer      = kc ? signerKabila : hc ? signerHashpack : null;

  /* Estados */
  const [wsnipBalance, setWsnipBalance] = useState(null);
  const [WSNIPS_Amount, setWSNIPS_Amount] = useState(5);
  const [message, setMessage] = useState("");

  /* Balance de WSNIP al montar / cambiar accountId */
  useEffect(() => {
    if (!accountId) return;
    fetchTokenBalance(accountId, WSNIP_TOKEN_ID).then(setWsnipBalance);
  }, [accountId]);

  /* Handle BUY */
  const handleBuy = async () => {
    if (!isConnected || !signer) {
      alert("Wallet not connected");
      return;
    }
    if (WSNIPS_Amount < 5) {
      setMessage("La cantidad mínima es 5 WSNIP");
      return;
    }

    const amountUnits = WSNIPS_Amount * Math.pow(10, USDC_DECIMALS);

    try {
      setMessage("Enviando transacción...");
      const tx = new TransferTransaction()
        .addTokenTransfer(
          TokenId.fromString(USDC_TOKEN_ID),
          AccountId.fromString(accountId),
          -amountUnits
        )
        .addTokenTransfer(
          TokenId.fromString(USDC_TOKEN_ID),
          AccountId.fromString(ADMIN_ACCOUNT_ID),
          amountUnits
        )
        .setTransactionMemo("Compras de WSNIP By WhataLab");

      const populated = await signer.populateTransaction(tx);
      const signed    = await signer.signTransaction(populated);
      const resp      = await signed.executeWithSigner(signer);
      await resp.getReceiptWithSigner(signer);

      setMessage("Compra completada!");
      const newBal = await fetchTokenBalance(accountId, WSNIP_TOKEN_ID);
      setWsnipBalance(newBal);
    } catch (err) {
      console.error(err);
      setMessage("Error en la transacción: " + err.message);
    }
  };

  /* =================== Render =================== */
  return (
    /* NUEVO wrapper: ocupa flex: 1 y empuja footer con .buytokens-section */
    <main className="buytokens-section">
      <div className="buytokens-container">
        {/* Botón < Back */}
        <div
          className="back-label"
          style={{
            margin: "0.5rem 0",
            fontSize: "16px",
            color: "#26e2b3",
            cursor: "pointer",
            textAlign: "left",
          }}
          onClick={() => (window.location.href = "/")}
        >
          &lt; Back
        </div>

        {/* Encabezado estilo MainContent */}
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
                Acquire tokens that grant access to our many exclusive tools.&nbsp;
                <strong>NEW: WhataSniper</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Grid de productos */}
        <div className="products-grid">
          {/* --- WSNIP Card --- */}
          <div className="product-card">
            <img src={wsnipImg} alt="WSNIP" className="product-img" />
            <h3>WSNIP</h3>

            {wsnipBalance !== null && (
              <p className="balance-text">
                Holds <strong>{wsnipBalance}</strong> WSNIP
              </p>
            )}

            <p>
              Each token lets you set a real-time, automatic order with our{' '}
              <strong>W&nbsp;SNIPER</strong> to snap NFTs below your target price.
            </p>
            <br></br>

            <div className="input-group">
              <label htmlFor="WSNIPS_Amount">
                WSNIP to purchase&nbsp;
                <Message text="Minimum quantity: 5 WSNIPS" />
              </label>
              <input
                id="WSNIPS_Amount"
                type="number"
                min="5"
                step="1"
                value={WSNIPS_Amount}
                onChange={(e) =>
                  setWSNIPS_Amount(parseInt(e.target.value, 10) || 5)
                }
                className="quantity-input"
              />
            </div>

            <span className="price-banner">{WSNIPS_Amount} USDC</span>
            {/*<button className="buy-btn" onClick={handleBuy}>
              BUY
            </button>*/}

            {message && (
              <div
                className={`message ${
                  message.startsWith("Error") ? "error" : "success"
                }`}
              >
                {message}
              </div>
            )}
          </div>

          {/* --- Placeholders SOON --- */}
          {[1, 2, 3].map((i) => (
            <div key={i} className="product-card soon-card">
              <img src={soonImg} alt="Soon" className="product-img" />
              <h3>SOON</h3>
              <p>Get in touch</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

export default BuyTokens;
