// src/ReactWalletsProvider.js
import React from 'react';
import { HWBridgeProvider } from '@buidlerlabs/hashgraph-react-wallets';
import { HashpackConnector, KabilaConnector } from '@buidlerlabs/hashgraph-react-wallets/connectors';
import { HederaTestnet, HederaMainnet } from '@buidlerlabs/hashgraph-react-wallets/chains';
import { TokenInfoQuery } from '@hashgraph/sdk';
import { Client } from '@hashgraph/sdk';

const metadata = {
  name: 'WℏataLab!',
  description: 'Your Blockchain partner',
  icons: [
    'https://pbs.twimg.com/profile_images/1802465571218259968/ff0UOB1b_400x400.jpg'
  ],
  url: window.location.href,
};

const ReactWalletsProvider = ({ children }) => {
  React.useEffect(() => {
  }, []);

  return (
    <HWBridgeProvider
      metadata={metadata}
      projectId={'cf5f905105402b8b39430d5546a0add6'} // Reemplaza con tu Project ID de Wallet Connect
      connectors={[KabilaConnector, HashpackConnector]}
      chains={[HederaMainnet, HederaTestnet]}
    >
      {children}
    </HWBridgeProvider>
  );
};

export default ReactWalletsProvider;
