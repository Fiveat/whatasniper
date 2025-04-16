//src/components/SniperCard.js
import React, { useState, useEffect } from "react";
import "./SniperCard.css";
import tokensData from "../assets/tech/tokenIDs.json";
import SwipeButton from "../assets/tech/SwipeButton";
import { supabase } from "../config/supabaseClient";

// Importamos hooks de @buidlerlabs y conectores
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

// Leemos la API Key de SentX desde .env
const sentxApiKey = process.env.REACT_APP_SENTX_KEY;

function SniperCard({ handleCreate: externalHandleCreate, boosterUsed }) {
  /*************************************************************
   * 1) ESTADOS Y HOOKS PRINCIPALES
   *************************************************************/
  // Modo por defecto: "asociado"
  const [tokenMode, setTokenMode] = useState("asociado");
  const [tokenManual, setTokenManual] = useState("");
  const [tokenSelect, setTokenSelect] = useState("");
  const [sniperType, setSniperType] = useState("FIXED PRICE");
  const [hbar, setHbar] = useState("");

  // Para resetear el slider (o botón) tras cada inserción
  const [sliderKey, setSliderKey] = useState(0);

  // Mensaje sobre allowance
  const [allowanceMessage, setAllowanceMessage] = useState("");

  // Para mostrar el floor price del token (SentX)
  const [floorPrice, setFloorPrice] = useState(null);

  // Detección de dispositivo móvil: si el ancho de pantalla es menor a 768px
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
   * Se hace de forma similar a Header.js
   *************************************************************/
  // Para Kabila
  const { isConnected: isConnectedKabila, signer: signerKabila } =
    useWallet(KabilaConnector);
  const { data: accountIdKabila } = useAccountId({
    connector: KabilaConnector,
  });

  // Para Hashpack
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

  /*************************************************************
   * Función para resetear el formulario y el botón
   *************************************************************/
  const resetForm = () => {
    setTokenManual("");
    setTokenSelect("");
    setHbar("");
    setSliderKey((prev) => prev + 1);
  };

  /*************************************************************
   * 3) CHEQUEO DE ASOCIACIÓN + ALLOWANCE + REGISTRO EN SUPABASE
   *************************************************************/

  // Verifica si el token (NFT) está asociado en la wallet conectada
  const checkTokenAssociation = async (tokenIdToCheck) => {
    try {
      if (!connectedSigner || !accountIdToCheck || !isConnected) return false;
      const accountIdToCheck = AccountId.fromString(accountId);

      const balanceQuery = new AccountBalanceQuery().setAccountId(
        accountIdToCheck
      );
      const populatedTx = await connectedSigner.populateTransaction(balanceQuery);
      const balanceResult = await populatedTx.executeWithSigner(connectedSigner);

      // "tokens" dentro de balanceResult es un Map con IDs asociadas
      return balanceResult.tokens._map.has(tokenIdToCheck);
    } catch (error) {
      console.error("Error comprobando asociación del token:", error);
      return false;
    }
  };

  // Asocia el token si no está asociado
  const associateTokenIfNeeded = async (tokenIdToAssociate) => {
    try {
      const isAlreadyAssociated = await checkTokenAssociation(tokenIdToAssociate);
      if (!isAlreadyAssociated) {
        console.log("Token no asociado. Intentando asociar...");
        const associateTx = new TokenAssociateTransaction()
          .setAccountId(AccountId.fromString(accountId))
          .setTokenIds([tokenIdToAssociate])
          .setTransactionMemo("Asociación del NFT por WhataSniper")
          .setMaxTransactionFee(new Hbar(5)); // Evita "INSUFFICIENT_TX_FEE"

        const populatedTx = await connectedSigner.populateTransaction(associateTx);
        const signedTx = await connectedSigner.signTransaction(populatedTx);
        const response = await signedTx.executeWithSigner(connectedSigner);
        const receipt = await response.getReceiptWithSigner(connectedSigner);

        if (receipt.status.toString() === "SUCCESS") {
          console.log("Token asociado con éxito.");
        } else {
          console.error(
            "No se pudo completar la asociación del token. Receipt:",
            receipt
          );
        }
      } else {
        console.log("El token ya está asociado. Continuando...");
      }
    } catch (error) {
      console.error("Error en associateTokenIfNeeded:", error);

      // Si la red responde con "TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT", 
      // simplemente continuamos y no detenemos la ejecución.
      if (error.status === "TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT") {
        console.log("TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT: continuamos el proceso normal.");
        return;
      }

      // Si es otro tipo de error, lo lanzamos para que handleCreate se entere.
      throw error;
    }
  };

  // Calculamos la suma total de max_price de las órdenes abiertas (estado=0) +
  // el nuevo valor hbar, y aprobamos un allowance acumulativo.
  const handleSetAllowance = async (newHbarValue) => {
    console.log("handleSetAllowance iniciado");
    if (!isConnected || !accountId || !connectedSigner) {
      setAllowanceMessage("No se ha podido obtener el signer de la wallet.");
      return false;
    }

    try {
      setAllowanceMessage("Solicitando allowance...");

      // 1) Obtenemos todas las órdenes abiertas para sumar sus max_price
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
      //    Para evitar "Hbar in tinybars contains decimals",
      //    redondeamos a máximo 8 decimales.
      const existingAllowance = openOrders.reduce((acc, curr) => {
        return acc + parseFloat(curr.max_price || 0);
      }, 0);

      const newHbarParsed = parseFloat(newHbarValue || 0);
      const newHbarRounded = parseFloat(newHbarParsed.toFixed(8));
      const totalAllowanceNumber = existingAllowance + newHbarRounded;
      const finalTotal = parseFloat(totalAllowanceNumber.toFixed(8));

      if (isNaN(finalTotal) || finalTotal <= 0) {
        setAllowanceMessage(
          "No hay allowance para configurar (ninguna orden pendiente)."
        );
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

      // 4) Ejecutamos la transacción
      const populatedTx = await connectedSigner.populateTransaction(allowanceTx);
      const signedTx = await connectedSigner.signTransaction(populatedTx);
      const response = await signedTx.executeWithSigner(connectedSigner);
      const receipt = await response.getReceiptWithSigner(connectedSigner);

      if (receipt && receipt.status.toString() === "SUCCESS") {
        setAllowanceMessage(
          `Allowance total de ${finalTotal} HBAR confirmado.`
        );
        return true;
      } else {
        throw new Error("La transacción de allowance no fue confirmada.");
      }
    } catch (error) {
      console.error("Error al establecer allowance:", error);
      setAllowanceMessage(
        "Error en la transacción de allowance: " + error.message
      );
      return false;
    }
  };

  // Controla todo el proceso final de la orden
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
      // 1) Asociar el token si no está asociado
      await associateTokenIfNeeded(token_id);

      // 2) Solicitar allowance (acumulativa) si procede
      const allowanceOk = await handleSetAllowance(hbar);
      if (!allowanceOk) {
        alert("No se pudo confirmar el allowance. No se registrará la orden.");
        resetForm();
        return;
      }

      // 3) Insertar la nueva orden en Supabase SÓLO después de la confirmación del allowance
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
   * 4) OBTENER el floor price del token (SentX)
   *************************************************************/
  const currentToken = tokenMode === "manual" ? tokenManual : tokenSelect;

  useEffect(() => {
    if (!currentToken) {
      setFloorPrice(null);
      return;
    }
    if (!sentxApiKey) {
      console.warn(
        "REACT_APP_SENTX_KEY no definida. No se puede obtener el floor price."
      );
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
        if (data && data.success && data.floor !== undefined) {
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
   * 5) RENDER del componente
   *************************************************************/
  return (
    <div className="sniper-card">
      <h2 className="sniper-title">SNIPER</h2>

      {allowanceMessage && (
        <div
          style={{ marginBottom: "1rem", textAlign: "center", color: "#0bf" }}
        >
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

        {/* Floor Price sobre SNIPER TYPE */}
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

        {/* Botón: si es móvil se muestra un botón normal, sino el deslizador */}
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
