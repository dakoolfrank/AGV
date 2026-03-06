'use client';

import React from 'react';
import { ThirdwebProvider as ThirdwebProviderBase } from '@thirdweb-dev/react';
import { Ethereum, Polygon, Binance, Arbitrum, Optimism, Fantom, Avalanche, Base } from '@thirdweb-dev/chains';

interface ThirdwebProviderProps {
  children: React.ReactNode;
}

export function ThirdwebProvider({ children }: ThirdwebProviderProps) {
  return (
    <ThirdwebProviderBase
      activeChain={Ethereum}
      supportedChains={[
        Ethereum,
        Polygon,
        Binance,
        Arbitrum,
        Optimism,
        Fantom,
        Avalanche,
        Base,
      ]}
      clientId={process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID}
    >
      {children}
    </ThirdwebProviderBase>
  );
}
