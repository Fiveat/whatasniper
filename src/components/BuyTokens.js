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
  TokenAssociateTransaction,        // <-- NEW: Para asociar el token
  TokenId,
  AccountId,
  Hbar,
} from "@hashgraph/sdk";

import Message from "./Message";

/* ===== NEW: Supabase ===== */
/* En lugar de crear un cliente nuevo, reutilizamos el centralizado
   para asegurarnos de que las credenciales y las políticas RLS
   sean coherentes en toda la app.                       */
import { supabase } from "../config/supabaseClient";

/* =================== Config =================== */
const WSNIP_TOKEN_ID   = "0.0.9166263";   // Token WSNIP
const USDC_TOKEN_ID    = "0.0.456858";    // Token USDC
const USDC_DECIMALS    = 6;               // Decimales USDC
const ADMIN_ACCOUNT_ID = "0.0.4351034";   // Wallet receptora USDC

/* ===== Helper: balance por token ===== */
async function fetchTokenBalance(accountId, tokenId) {
  const url   = `https://mainnet.mirrornode.hedera.com/api/v1/accounts/${accountId}/tokens?limit=100`;
  const resp  = await fetch(url);
  const data  = await resp.json();
  const token = data.tokens.find((t) => t.token_id === tokenId);
  return token ? parseInt(token.balance, 10) : null;   // null si NO está asociado
}

/* ===== NEW Helper: comprobar asociación ===== */
async function checkTokenAssociation(accountId, tokenId) {
  const url   = `https://mainnet.mirrornode.hedera.com/api/v1/accounts/${accountId}/tokens?limit=100`;
  const resp  = await fetch(url);
  const data  = await resp.json();
  const token = data.tokens.find((t) => t.token_id === tokenId);
  return !!token;                                      // true si asociado
}

/* ===== NEW: registrar compra en Supabase ===== */
async function logPurchaseToSupabase({ sender, amount, txId }) {
  try {
    const { data, error } = await supabase
      .from("wsnip_purchases")
      .insert([
        {
          sender,
          amount,
          tx_id: txId,
          created_at: new Date().toISOString(),
        },
      ])
      .select();               // devolverá la fila insertada

    if (error) throw error;
    return data;               // nos será útil para debug
  } catch (err) {
    console.error("Supabase insert error:", err.message);
    throw err;                 // propagamos para que handleBuy lo capture
  }
}

/* =================== Componente =================== */
function BuyTokens({ accountId }) {
  /* Wallet detection (Kabila / Hashpack) */
  const { isConnected: kc, signer: signerKabila }   = useWallet(KabilaConnector);
  const { isConnected: hc, signer: signerHashpack } = useWallet(HashpackConnector);
  const isConnected = kc || hc;
  const signer      = kc ? signerKabila : hc ? signerHashpack : null;

  /* ======== Estados ======== */
  const [wsnipBalance,  setWsnipBalance]  = useState(null);  // null = sin asociar
  const [isAssociated,  setIsAssociated]  = useState(null);  // null = loading
  const [associateMsg,  setAssociateMsg]  = useState("");    // mensajes de asociación
  const [WSNIPS_Amount, setWSNIPS_Amount] = useState(5);
  const [message,       setMessage]       = useState("");

  /* ======== Efecto: check asociación + balance ======== */
  useEffect(() => {
    if (!accountId) return;

    // Primero verificamos si la cuenta tiene asociado el token
    checkTokenAssociation(accountId, WSNIP_TOKEN_ID).then((assoc) => {
      setIsAssociated(assoc);
      if (assoc) {
        // Si está asociado, traemos balance
        fetchTokenBalance(accountId, WSNIP_TOKEN_ID).then(setWsnipBalance);
      } else {
        // Si NO está asociado, dejamos balance en null (distingue balance 0 vs no asociado)
        setWsnipBalance(null);
      }
    });
  }, [accountId]);

  /* ======== Handle ASSOCIATION ======== */
  const handleAssociate = async () => {
    if (!isConnected || !signer) {
      alert("Wallet not connected");
      return;
    }

    try {
      setAssociateMsg("Firmando transacción de asociación...");
      const tx = new TokenAssociateTransaction()
        .setAccountId(AccountId.fromString(accountId))
        .setTokenIds([TokenId.fromString(WSNIP_TOKEN_ID)])
        .setMaxTransactionFee(new Hbar(2));           // margen de 2 HBAR

      const populated = await signer.populateTransaction(tx);
      const signed    = await signer.signTransaction(populated);
      const resp      = await signed.executeWithSigner(signer);
      const receipt   = await resp.getReceiptWithSigner(signer);

      if (receipt.status && receipt.status.toString() === "SUCCESS") {
        setAssociateMsg("Token asociado correctamente!");
        setIsAssociated(true);

        /* Tras asociar: refrescamos balance (será 0) */
        const newBal = await fetchTokenBalance(accountId, WSNIP_TOKEN_ID);
        setWsnipBalance(newBal);
      } else {
        setAssociateMsg("La transacción no fue confirmada en red.");
        console.error("Status Hedera:", receipt.status.toString());
      }
    } catch (err) {
      console.error(err);
      setAssociateMsg("Error al asociar: " + err.message);
    }
  };

  /* ======== Handle BUY ======== */
  const handleBuy = async () => {
    if (!isConnected || !signer) {
      alert("Wallet not connected");
      return;
    }
    if (!isAssociated) {
      setMessage("Debes asociar el token antes de comprar.");
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
        .setTransactionMemo("Compras de WSNIP By WhataLab")
        .setMaxTransactionFee(new Hbar(1)); // margen de 1 HBAR

      const populated = await signer.populateTransaction(tx);
      const signed    = await signer.signTransaction(populated);
      const resp      = await signed.executeWithSigner(signer);

      /* ===== Confirmamos éxito */
      const receipt = await resp.getReceiptWithSigner(signer);

      if (receipt.status && receipt.status.toString() === "SUCCESS") {
        /* ===== Guardamos en Supabase ===== */
        await logPurchaseToSupabase({
          sender: accountId,
          amount: WSNIPS_Amount,
          txId:   resp.transactionId.toString(),
        });
        setMessage("Compra completada y registrada!");
      } else {
        setMessage("La transacción no fue confirmada en red.");
        console.error("Status Hedera:", receipt.status.toString());
        return;
      }

      /* ===== Refrescamos saldo local ===== */
      const newBal = await fetchTokenBalance(accountId, WSNIP_TOKEN_ID);
      setWsnipBalance(newBal);
    } catch (err) {
      console.error(err);
      setMessage("Error en la transacción o al registrar: " + err.message);
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

            {/* ===== Saldo o estado de asociación ===== */}
            {isAssociated === false && (
              <p className="balance-text">
                ⚠️ Token <strong>NO asociado</strong>
              </p>
            )}
            {isAssociated && wsnipBalance !== null && (
              <p className="balance-text">
                Holds <strong>{wsnipBalance}</strong> WSNIP
              </p>
            )}

            <p>
              Each token lets you set a real-time, automatic order with our{" "}
              <strong>W&nbsp;SNIPER</strong> to snap NFTs below your target price.
            </p>
            <br />

            {/* --- Cantidad a comprar --- */}
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

            {/* ===== NEW: Acción de asociación si aplica ===== */}
            {isAssociated === false && (
              <>
                <div className="associate-warning">
                  Debes asociar el token a tu wallet antes de comprar.
                </div>
                <button className="associate-btn" onClick={handleAssociate}>
                  ASOCIAR WSNIP
                </button>
                {associateMsg && (
                  <div
                    className={`message ${
                      associateMsg.startsWith("Error") ? "error" : "success"
                    }`}
                  >
                    {associateMsg}
                  </div>
                )}
              </>
            )}

            {/* Banner de precio y botón BUY */}
            <span className="price-banner">{WSNIPS_Amount} USDC</span>
            {<button className="buy-btn" onClick={handleBuy}>
              BUY
            </button>}

            {/* Mensajes de compra */}
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
