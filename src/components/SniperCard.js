// src/components/SniperCard.js
import React, { useState, useEffect } from "react";
import "./SniperCard.css";
import tokensData from "../assets/tech/tokenIDs.json";
import SwipeButton from "../assets/tech/SwipeButton";
import { supabase } from "../config/supabaseClient";

// Hooks de @buidlerlabs y conectores
import { useWallet, useAccountId } from "@buidlerlabs/hashgraph-react-wallets";
import {
  KabilaConnector,
  HashpackConnector,
} from "@buidlerlabs/hashgraph-react-wallets/connectors";

// SDK de Hedera
import {
  Client,
  TokenInfoQuery,
  AccountAllowanceApproveTransaction,
  AccountId,
  Hbar,
  TokenAssociateTransaction,
  AccountBalanceQuery, // se deja aunque no se use (no eliminar)
} from "@hashgraph/sdk";
import { TokenId } from "@hashgraph/sdk"; // ← AÑADIDO

const sentxApiKey = process.env.REACT_APP_SENTX_KEY;

/* ------------------------------------------------------------------
 *  CREDENCIALES *EXACTAS* DEL FICHERO fallback.js
 *  (se usan **solo** para consultar TokenInfo; no toques nada)
 * ------------------------------------------------------------------*/
const FALLBACK_WALLET_ID = "0.0.8205787";
const FALLBACK_PRIVATE_KEY =
  "3030020100300706052b8104000a04220420153b05b0c6adbf60a5056eca0796d7a9e23932874944d543c2d9e2a1ac727ef5";

/* ------------------------------------------------------------------
 *  FUNCIÓN AUXILIAR: ¿el token tiene RoyaltyFee con Fallback?
 * ------------------------------------------------------------------*/
async function tokenHasRoyaltyFallback(tokenId) {
  try {
    const client = Client.forMainnet();
    client.setOperator(FALLBACK_WALLET_ID, FALLBACK_PRIVATE_KEY);

    // Si viene con “/serial”, lo recortamos (0.0.1234/7 → 0.0.1234)
    const tokenIdBase = tokenId.split("/")[0];

    const tokenInfo = await new TokenInfoQuery()
      .setTokenId(tokenIdBase)
      .execute(client);

    /* ----------------------------------------------------------------
       Detectamos fallback bajo **tres** posibilidades:
         1) fee.royaltyFee.fallbackFee  (getter público del SDK)
         2) fee._fallbackFee            (propiedad interna vista en JSON)
         3) fee.toJSON()?.fallbackFee   (por si el objeto expone un serializador)
       Se considera “true” si cualquiera de los casos anteriores existe
       y tiene *_amount* o *denominatingTokenId* (algún valor útil).
    ------------------------------------------------------------------*/
    const hasFallback =
      Array.isArray(tokenInfo.customFees) &&
      tokenInfo.customFees.some((fee) => {
        // Caso 1: getter estándar (enumerable o no)
        if (fee.royaltyFee && fee.royaltyFee.fallbackFee) {
          return true;
        }

        // Caso 2: propiedades internas con guión bajo
        if (
          fee._fallbackFee &&
          (fee._fallbackFee._amount !== undefined ||
            fee._fallbackFee._denominatingTokenId !== null)
        ) {
          return true;
        }

        // Caso 3: conversión a JSON
        try {
          const json = fee.toJSON ? fee.toJSON() : null;
          if (json && json.fallbackFee) return true;
        } catch (_) {
          /* ignoramos errores de serialización */
        }

        return false;
      });

    client.close();
    return hasFallback;
  } catch (err) {
    console.error("Error al verificar fallback:", err);
    /* Por seguridad, si no podemos verificar asumimos que NO hay fallback
       (así evitamos falsos bloqueos). */
    return false;
  }
}

// -----------------------------------------------------------
// FUNCIONES AUXILIARES PARA MIRROR NODE
// -----------------------------------------------------------

/**
 * Obtiene TODOS los NFTs que la cuenta (accountId) posee,
 * paginando si es necesario, usando la Mirror Node API.
 */
async function getNftInfo(accountId) {
  // Cambia la URL según tu red: testnet, mainnet, previewnet, etc.
  const baseUrl = "https://mainnet.mirrornode.hedera.com";
  let url = `${baseUrl}/api/v1/accounts/${accountId}/nfts?limit=100`;

  const nftInfos = [];
  while (url) {
    const resp = await fetch(url);
    if (!resp.ok) {
      console.error("Error al consultar Mirror Node:", resp.statusText);
      break;
    }
    const data = await resp.json();
    if (data?.nfts?.length) {
      nftInfos.push(...data.nfts);
    }
    url = data?.links?.next ? `${baseUrl}${data.links.next}` : null;
  }

  return nftInfos; // Estructura: [{ token_id: "0.0.xxxx", serial_number: N, ... }, ...]
}

/**
 * (AGREGADO) Obtiene TODOS los tokens asociados a la cuenta (fungibles + no fungibles),
 * incluyendo aquellos con balance = 0, usando la Mirror Node API.
 */
async function getTokens(accountId) {
  const baseUrl = "https://mainnet.mirrornode.hedera.com";
  let url = `${baseUrl}/api/v1/accounts/${accountId}/tokens?limit=100`;

  const tokens = [];
  while (url) {
    const resp = await fetch(url);
    if (!resp.ok) {
      console.error("Error al consultar Mirror Node (tokens):", resp.statusText);
      break;
    }
    const data = await resp.json();
    if (data?.tokens?.length) {
      tokens.push(...data.tokens);
    }
    url = data?.links?.next ? `${baseUrl}${data.links.next}` : null;
  }
  // Estructura: [{ token_id: "0.0.xxxx", balance: "0", ... }, ...]
  return tokens;
}

/**
 * Revisa si una cuenta "accountId" ya tiene asociado el token "tokenIdBase" (sin serial).
 * - Si aparece en la lista de NFTs *o* en la lista de tokens con balance >= 0 => asociado.
 */
async function isNftAssociatedMirrorNode(accountId, tokenIdBase) {
  try {
    const [nfts, tokens] = await Promise.all([
      getNftInfo(accountId),
      getTokens(accountId),
    ]);

    // 1) Si la cuenta posee algún NFT con ese token_id base
    const foundNft = nfts.some((nft) => nft.token_id === tokenIdBase);

    // 2) O si el token aparece en la lista de tokens (aunque sea balance = 0)
    const foundToken = tokens.some((tok) => tok.token_id === tokenIdBase);

    return foundNft || foundToken;
  } catch (error) {
    console.error("Error en isNftAssociatedMirrorNode:", error);
    // Para evitar bloqueos, si hay error asumimos "no asociado"
    return false;
  }
}

// -----------------------------------------------------------
// COMPONENTE PRINCIPAL
// -----------------------------------------------------------
function SniperCard({ handleCreate: externalHandleCreate, boosterUsed }) {
  /*************************************************************
   * 1) ESTADOS Y HOOKS PRINCIPALES
   *************************************************************/
  const [tokenMode, setTokenMode] = useState("asociado");
  const [tokenManual, setTokenManual] = useState("");
  const [tokenSelect, setTokenSelect] = useState("");
  const [sniperType, setSniperType] = useState("FIXED PRICE");
  const [hbar, setHbar] = useState("");
  const [sliderKey, setSliderKey] = useState(0);

  const [allowanceMessage, setAllowanceMessage] = useState("");

  // Floor price (vía SentX, si lo deseas)
  const [floorPrice, setFloorPrice] = useState(null);

  // NUEVO → estado “tiene fallback”
  const [hasFallback, setHasFallback] = useState(false);
  const [fallbackLoading, setFallbackLoading] = useState(false);

  // Responsividad para móvil
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // tokensData es un objeto con { "Kabila": "0.0.xxxx", "Hashpack": "0.0.yyyy" ... }
  const { tokens } = tokensData;
  const tokenEntries = Object.entries(tokens);

  /*************************************************************
   * 2) DETECCIÓN DE WALLET (Kabila o Hashpack)
   *************************************************************/
  const { isConnected: isConnectedKabila, signer: signerKabila } =
    useWallet(KabilaConnector);
  const { data: accountIdKabila } = useAccountId({ connector: KabilaConnector });

  const { isConnected: isConnectedHashpack, signer: signerHashpack } =
    useWallet(HashpackConnector);
  const { data: accountIdHashpack } = useAccountId({
    connector: HashpackConnector,
  });

  const isConnected = isConnectedKabila || isConnectedHashpack;
  const accountId = accountIdKabila || accountIdHashpack;
  const connectedSigner = isConnectedKabila
    ? signerKabila
    : isConnectedHashpack
    ? signerHashpack
    : null;

  console.log("SniperCard => isConnected:", isConnected);
  console.log("SniperCard => accountId (Kabila):", accountIdKabila);
  console.log("SniperCard => accountId (Hashpack):", accountIdHashpack);
  console.log("SniperCard => final accountId:", accountId);
  console.log("SniperCard => signer:", connectedSigner);

  // Función para resetear el formulario
  const resetForm = () => {
    setTokenManual("");
    setTokenSelect("");
    setHbar("");
    setSliderKey((prev) => prev + 1);
  };

  /*************************************************************
   * 3) ASOCIAR EL TOKEN SI ES NECESARIO
   *************************************************************/
  // En vez de usar checkTokenAssociation (que usaba balanceQuery),
  // consultamos la Mirror Node para ver si la cuenta ya tiene asociado el NFT.
  const associateTokenIfNeeded = async (tokenIdToAssociate) => {
    try {
      if (!connectedSigner || !accountId || !isConnected) return;

      // 1) Asegúrate de remover el serial si existe (por ejemplo 0.0.1234/7 => 0.0.1234)
      const tokenIdBase = tokenIdToAssociate.split("/")[0];

      // 2) Revisar en la Mirror Node si está asociado
      const alreadyAssociated = await isNftAssociatedMirrorNode(
        accountId,
        tokenIdBase
      );
      if (alreadyAssociated) {
        console.log("El token NFT ya está asociado. No se ejecuta la transacción.");
        return; // <-- No ejecutamos la asociación
      }

      // 3) En caso de que NO esté asociado, ejecutar la transacción
      console.log("NFT no asociado. Intentando asociar...");
      const tx = new TokenAssociateTransaction()
        .setAccountId(AccountId.fromString(accountId))
        .setTokenIds([tokenIdBase])
        .setTransactionMemo("WhataSniper NFT Association")
        .setMaxTransactionFee(new Hbar(5));

      const populatedTx = await connectedSigner.populateTransaction(tx);
      const signedTx = await connectedSigner.signTransaction(populatedTx);
      const response = await signedTx.executeWithSigner(connectedSigner);
      const receipt = await response.getReceiptWithSigner(connectedSigner);

      if (receipt.status.toString() === "SUCCESS") {
        console.log(`Token ${tokenIdBase} successfully associated.`);
      } else {
        console.error("Error: Association not completed. Receipt:", receipt);
      }
    } catch (error) {
      console.error("Error in associateTokenIfNeeded:", error);

      // Si la red responde con "TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT", continuamos
      if (error.status === "TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT") {
        console.log("TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT: account already had it.");
        return;
      }
      throw error;
    }
  };

  /*************************************************************
   * 4) ALLOWANCE + REGISTRO EN SUPABASE
   *************************************************************/
  const handleSetAllowance = async (newHbarValue) => {
    console.log("handleSetAllowance iniciado");
    if (!isConnected || !accountId || !connectedSigner) {
      setAllowanceMessage("Could not obtain wallet signer.");
      return false;
    }

    try {
      setAllowanceMessage("Requesting allowance...");

      // 1) Obtenemos todas las órdenes abiertas (estado=0) para sumar sus max_price
      const { data: openOrders, error } = await supabase
        .from("snips")
        .select("max_price")
        .eq("wallet_id", accountId)
        .eq("estado", 0);

      if (error) {
        console.error("Error fetching open orders:", error);
        setAllowanceMessage("Error fetching open orders.");
        return false;
      }

      // 2) Sumamos los max_price existentes + el nuevo valor
      const existingAllowance = openOrders.reduce((acc, curr) => {
        return acc + parseFloat(curr.max_price || 0);
      }, 0);

      const newHbarParsed = parseFloat(newHbarValue || 0);
      const newHbarRounded = parseFloat(newHbarParsed.toFixed(8));
      const totalAllowanceNumber = existingAllowance + newHbarRounded;
      const finalTotal = parseFloat(totalAllowanceNumber.toFixed(8));

      if (isNaN(finalTotal) || finalTotal <= 0) {
        setAllowanceMessage("No allowance to set (no open orders).");
        return false;
      }

      // 3) Creamos la transacción de allowance con la suma final
      const spenderAccountId = "0.0.4351034";
      const allowanceHbar = new Hbar(finalTotal);

      const allowanceTx = new AccountAllowanceApproveTransaction()
        .approveHbarAllowance(
          AccountId.fromString(accountId),
          AccountId.fromString(spenderAccountId),
          allowanceHbar
        )
        // -----------------------------------------------------------------
        // Allowance adicional: 1 unidad del token WSNIP
        .approveTokenAllowance(
          TokenId.fromString("0.0.9166263"),          // token a permitir
          AccountId.fromString(accountId),            // dueño (owner)
          AccountId.fromString(spenderAccountId),     // spender
          100                                           // cantidad
        )
        // -----------------------------------------------------------------
        .setMaxTransactionFee(new Hbar(2))
        .setTransactionMemo("WhataSniper Allowance");

      // 4) Ejecutamos
      const populatedTx = await connectedSigner.populateTransaction(allowanceTx);
      const signedTx = await connectedSigner.signTransaction(populatedTx);
      const response = await signedTx.executeWithSigner(connectedSigner);
      const receipt = await response.getReceiptWithSigner(connectedSigner);

      if (receipt && receipt.status.toString() === "SUCCESS") {
        setAllowanceMessage(`Total allowance of ${finalTotal} HBAR confirmed.`);
        return true;
      } else {
        throw new Error("Allowance transaction was not confirmed.");
      }
    } catch (error) {
      console.error("Error setting allowance:", error);
      setAllowanceMessage("Allowance transaction error: " + error.message);
      return false;
    }
  };

  /**
   * Maneja todo el proceso final para crear la orden.
   */
  const handleCreate = async () => {
    console.log("handleCreate iniciado");
    const token_id = tokenMode === "manual" ? tokenManual : tokenSelect;

    if (fallbackLoading) {
      alert("Still checking Fallback Fee. Please wait.");
      return;
    }

    if (hasFallback) {
      alert("The selected NFT has a Fallback Fee. You cannot create an order.");
      return;
    }

    if (!isConnected || !accountId) {
      alert("Your wallet is not connected.");
      resetForm();
      return;
    }
    if (!token_id || !sniperType || !hbar) {
      alert("Please complete all fields.");
      resetForm();
      return;
    }

    try {
      // 1) Asociar el token si NO está asociado (usa Mirror Node)
      await associateTokenIfNeeded(token_id);

      // 2) Solicitar allowance acumulativa
      const allowanceOk = await handleSetAllowance(hbar);
      if (!allowanceOk) {
        alert("Allowance could not be confirmed. Order will not be registered.");
        resetForm();
        return;
      }

      // 3) Insertar la nueva orden en Supabase SÓLO tras allowanceOk
      const { error } = await supabase.from("snips").insert([
        {
          wallet_id: accountId,
          token_id,
          type: sniperType,
          max_price: hbar,
          estado: 0,
          boost: boosterUsed,
        },
      ]);

      if (error) {
        console.error("Error inserting in Supabase:", error);
        alert("An error occurred while registering the operation.");
        return;
      }

      alert("Successfully registered in Supabase.");
      setAllowanceMessage("");
    } catch (err) {
      console.error("Error in handleCreate:", err);
      alert("Could not complete registration in Supabase.");
    } finally {
      resetForm();
    }
  };

  /*************************************************************
   * 5) OBTENER el floor price del token (SentX) + VERIFICAR FALLBACK
   *************************************************************/
  const currentToken = tokenMode === "manual" ? tokenManual : tokenSelect;
  useEffect(() => {
    /* ---------- 5a. Floor price ---------- */
    if (!currentToken) {
      setFloorPrice(null);
    } else if (!sentxApiKey) {
      console.warn("REACT_APP_SENTX_KEY not set. Cannot fetch floor price.");
      setFloorPrice(null);
    } else {
      const fetchFloorPrice = async () => {
        try {
          const url = `https://api.sentx.io/v1/public/market/floor?apikey=${sentxApiKey}&token=${currentToken}`;
          console.log("SentX GET Floor URL:", url);

          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
          }
          const data = await response.json();
          if (data?.success && data.floor !== undefined) {
            setFloorPrice(data.floor);
          } else {
            setFloorPrice("(no floor available)");
          }
        } catch (error) {
          console.error("Error fetching floor price:", error);
          setFloorPrice("(error fetching floor)");
        }
      };

      fetchFloorPrice();
    }

    /* ---------- 5b. Verificación de Fallback ---------- */
    if (!currentToken) {
      setHasFallback(false);
      return;
    }
    setFallbackLoading(true);
    tokenHasRoyaltyFallback(currentToken)
      .then((has) => {
        setHasFallback(has);
      })
      .finally(() => setFallbackLoading(false));
  }, [currentToken]);

  /*************************************************************
   * 6) RENDER DEL COMPONENTE
   *************************************************************/
  return (
    <div className="sniper-card">
      <h2 className="sniper-title">SNIPER</h2>

      {allowanceMessage && (
        <div style={{ marginBottom: "1rem", textAlign: "center", color: "#0bf" }}>
          {allowanceMessage}
        </div>
      )}

      {fallbackLoading && (
        <div style={{ marginBottom: "1rem", textAlign: "center", color: "#ff0" }}>
          Checking Fallback Fee...
        </div>
      )}

      {hasFallback && !fallbackLoading && (
        <div style={{ marginBottom: "1rem", textAlign: "center", color: "#f33" }}>
          This NFT has a Fallback Fee. Order creation disabled.
        </div>
      )}

      <form className="sniper-form" onSubmit={(e) => e.preventDefault()}>
        {/* TOKEN ID */}
        <div className="field-group">
          <label className="field-label" htmlFor="tokenID">
            TOKEN ID
          </label>
          <div className="token-mode-container">
            <div className="token-mode-selector">
              <label>
                <input
                  type="radio"
                  name="tokenMode"
                  value="manual"
                  checked={tokenMode === "manual"}
                  onChange={() => setTokenMode("manual")}
                />
                Manual
              </label>
              <label>
                <input
                  type="radio"
                  name="tokenMode"
                  value="asociado"
                  checked={tokenMode === "asociado"}
                  onChange={() => setTokenMode("asociado")}
                />
                Associated
              </label>
            </div>
          </div>
          {tokenMode === "manual" ? (
            <input
              id="tokenID"
              className="field-input"
              type="text"
              placeholder="Enter the Token ID manually"
              value={tokenManual}
              onChange={(e) => setTokenManual(e.target.value)}
            />
          ) : (
            <select
              id="tokenID"
              className="select-input"
              value={tokenSelect}
              onChange={(e) => setTokenSelect(e.target.value)}
            >
              <option value="">Select a Token</option>
              {tokenEntries.map(([nombre, id], idx) => (
                <option key={idx} value={id}>
                  {nombre}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Floor Price */}
        {currentToken && (
          <div style={{ marginBottom: "1rem", textAlign: "center" }}>
            <strong style={{ color: "#20e0b1" }}>Floor price:</strong>{" "}
            <span style={{ color: "#fff" }}>
              {floorPrice !== null ? `${floorPrice} $HBAR` : "Loading..."}
            </span>
          </div>
        )}

        {/* SNIPER TYPE */}
        <div className="field-group">
          <label className="field-label" htmlFor="sniperType">
            SNIPER TYPE
          </label>
          <select
            id="sniperType"
            className="select-input"
            value={sniperType}
            onChange={(e) => setSniperType(e.target.value)}
          >
            <option value="FIXED PRICE">FIXED PRICE</option>
            {/* Agrega otros tipos si los necesitas */}
          </select>
        </div>

        {/* HBAR TO PAY */}
        <div className="field-group">
          <label className="field-label" htmlFor="hbar">
            HBAR TO PAY
          </label>
          <input
            id="hbar"
            className="field-input"
            type="text"
            placeholder="Amount of HBAR"
            value={hbar}
            onChange={(e) => setHbar(e.target.value)}
          />
        </div>

        {/* Botón para crear */}
        {isMobile ? (
          hasFallback || fallbackLoading ? (
            <button
              type="button"
              className="create-button"
              disabled
              style={{
                width: "100%",
                padding: "1rem",
                fontSize: "16px",
                textAlign: "center",
                textTransform: "uppercase",
                fontWeight: "bold",
                opacity: 0.4,
                cursor: "not-allowed",
              }}
            >
              {fallbackLoading ? "Checking..." : "Fallback detected"}
            </button>
          ) : (
            <button
              type="button"
              className="create-button"
              onClick={handleCreate}
              style={{
                width: "100%",
                padding: "1rem",
                fontSize: "16px",
                textAlign: "center",
                textTransform: "uppercase",
                fontWeight: "bold",
              }}
            >
              Create Order
            </button>
          )
        ) : hasFallback || fallbackLoading ? (
          <button
            type="button"
            className="create-button"
            disabled
            style={{
              width: "100%",
              padding: "1rem",
              fontSize: "16px",
              textAlign: "center",
              textTransform: "uppercase",
              fontWeight: "bold",
              opacity: 0.4,
              cursor: "not-allowed",
            }}
          >
            {fallbackLoading ? "Checking..." : "Fallback detected"}
          </button>
        ) : (
          <SwipeButton
            key={sliderKey}
            text="Swipe to create"
            onSwipe={handleCreate}
          />
        )}
      </form>
    </div>
  );
}

export default SniperCard;
