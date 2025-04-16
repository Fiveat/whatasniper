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
  AccountAllowanceApproveTransaction,
  AccountId,
  Hbar,
  TokenAssociateTransaction,
  AccountBalanceQuery,
} from "@hashgraph/sdk";

const sentxApiKey = process.env.REACT_APP_SENTX_KEY;

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
        .setTransactionMemo("Asociación del NFT por WhataSniper")
        .setMaxTransactionFee(new Hbar(5));

      const populatedTx = await connectedSigner.populateTransaction(tx);
      const signedTx = await connectedSigner.signTransaction(populatedTx);
      const response = await signedTx.executeWithSigner(connectedSigner);
      const receipt = await response.getReceiptWithSigner(connectedSigner);

      if (receipt.status.toString() === "SUCCESS") {
        console.log(`Token ${tokenIdBase} asociado con éxito.`);
      } else {
        console.error("Error: No se completó la asociación. Receipt:", receipt);
      }
    } catch (error) {
      console.error("Error en associateTokenIfNeeded:", error);

      // Si la red responde con "TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT", continuamos
      if (error.status === "TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT") {
        console.log("TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT: la cuenta ya lo tenía asociado.");
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
      setAllowanceMessage("No se ha podido obtener el signer de la wallet.");
      return false;
    }

    try {
      setAllowanceMessage("Solicitando allowance...");

      // 1) Obtenemos todas las órdenes abiertas (estado=0) para sumar sus max_price
      const { data: openOrders, error } = await supabase
        .from("snips")
        .select("max_price")
        .eq("wallet_id", accountId)
        .eq("estado", 0);

      if (error) {
        console.error("Error al obtener órdenes abiertas:", error);
        setAllowanceMessage("Error al obtener órdenes abiertas.");
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
        setAllowanceMessage("No hay allowance para configurar (sin órdenes).");
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
        .setMaxTransactionFee(new Hbar(2))
        .setTransactionMemo("Allowance WhataSniper");

      // 4) Ejecutamos
      const populatedTx = await connectedSigner.populateTransaction(allowanceTx);
      const signedTx = await connectedSigner.signTransaction(populatedTx);
      const response = await signedTx.executeWithSigner(connectedSigner);
      const receipt = await response.getReceiptWithSigner(connectedSigner);

      if (receipt && receipt.status.toString() === "SUCCESS") {
        setAllowanceMessage(`Allowance total de ${finalTotal} HBAR confirmado.`);
        return true;
      } else {
        throw new Error("La transacción de allowance no fue confirmada.");
      }
    } catch (error) {
      console.error("Error al establecer allowance:", error);
      setAllowanceMessage("Error en la transacción de allowance: " + error.message);
      return false;
    }
  };

  /**
   * Maneja todo el proceso final para crear la orden.
   */
  const handleCreate = async () => {
    console.log("handleCreate iniciado");
    const token_id = tokenMode === "manual" ? tokenManual : tokenSelect;

    if (!isConnected || !accountId) {
      alert("Tu wallet no está conectada.");
      resetForm();
      return;
    }
    if (!token_id || !sniperType || !hbar) {
      alert("Por favor completa todos los campos.");
      resetForm();
      return;
    }

    try {
      // 1) Asociar el token si NO está asociado (usa Mirror Node)
      await associateTokenIfNeeded(token_id);

      // 2) Solicitar allowance acumulativa
      const allowanceOk = await handleSetAllowance(hbar);
      if (!allowanceOk) {
        alert("No se pudo confirmar el allowance. No se registrará la orden.");
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
        console.error("Error al insertar en Supabase:", error);
        alert("Ocurrió un error al registrar la operación.");
        return;
      }

      alert("Registro en Supabase exitoso.");
      setAllowanceMessage("");
    } catch (err) {
      console.error("Error en handleCreate:", err);
      alert("No se pudo completar el registro en Supabase.");
    } finally {
      resetForm();
    }
  };

  /*************************************************************
   * 5) OBTENER el floor price del token (SentX)
   *************************************************************/
  const currentToken = tokenMode === "manual" ? tokenManual : tokenSelect;
  useEffect(() => {
    if (!currentToken) {
      setFloorPrice(null);
      return;
    }
    if (!sentxApiKey) {
      console.warn("REACT_APP_SENTX_KEY no definida. No se puede obtener el floor price.");
      setFloorPrice(null);
      return;
    }

    const fetchFloorPrice = async () => {
      try {
        const url = `https://api.sentx.io/v1/public/market/floor?apikey=${sentxApiKey}&token=${currentToken}`;
        console.log("SentX GET Floor URL:", url);

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Error HTTP: ${response.status}`);
        }
        const data = await response.json();
        if (data?.success && data.floor !== undefined) {
          setFloorPrice(data.floor);
        } else {
          setFloorPrice("(no hay floor disponible)");
        }
      } catch (error) {
        console.error("Error al obtener floor price:", error);
        setFloorPrice("(error al obtener floor)");
      }
    };

    fetchFloorPrice();
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
                Asociado
              </label>
            </div>
          </div>
          {tokenMode === "manual" ? (
            <input
              id="tokenID"
              className="field-input"
              type="text"
              placeholder="Introduce el Token ID manualmente"
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
              <option value="">Selecciona un Token</option>
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
              {floorPrice !== null ? `${floorPrice} $HBAR` : "Cargando..."}
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
            placeholder="Cantidad de HBAR"
            value={hbar}
            onChange={(e) => setHbar(e.target.value)}
          />
        </div>

        {/* Botón para crear */}
        {isMobile ? (
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
            Crear Orden
          </button>
        ) : (
          <SwipeButton
            key={sliderKey}
            text="Desliza para crear"
            onSwipe={handleCreate}
          />
        )}
      </form>
    </div>
  );
}

export default SniperCard;
